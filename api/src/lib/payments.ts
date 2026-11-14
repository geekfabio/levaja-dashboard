import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { payments, providers, serviceRequests } from "../db/schema/ops";
import { cashBalanceKz, isBlockedByCashBalance } from "./cash-balance";
import { rewardInviterFor } from "./discounts";
import { newId } from "./ids";
import { notifyRealtimeChange } from "./realtime-bus";
import { recordRequestEvent } from "./request-events";

const BANK_REFERENCE_ENTITY = "00123";

/**
 * How long the simulated "bank" takes to confirm a Multicaixa reference.
 * This is a demo-only delay (the real integration is a webhook from the
 * payments processor), kept short so the demo is not slow. Tests override it
 * with setBankConfirmationMsForTests() so they don't have to sleep for the
 * real value.
 */
export let BANK_CONFIRMATION_MS = 5000;

export function setBankConfirmationMsForTests(ms: number) {
  BANK_CONFIRMATION_MS = ms;
}

function generateBankReferenceDigits() {
  let digits = "";
  for (let i = 0; i < 9; i += 1) digits += Math.floor(Math.random() * 10).toString();
  return digits;
}

type PaymentRow = typeof payments.$inferSelect;

export function presentPayment(row: PaymentRow) {
  return {
    id: row.id,
    request_id: row.requestId,
    payment_method: row.paymentMethod,
    status: row.status,
    amount_kz: row.amountKz,
    bank_reference: row.bankReference,
    created_at: row.createdAt.toISOString(),
    confirmed_at: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  };
}

export async function findPendingPayment(requestId: string, paymentMethod: "bank_reference" | "card" | "cash") {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.requestId, requestId), eq(payments.paymentMethod, paymentMethod), eq(payments.status, "pending")))
    .limit(1);
  return row;
}

/**
 * Marks a pending payment confirmed and, if the request is still waiting for
 * payment, moves it to "paid". Safe to call more than once for the same
 * payment: a payment that is not (or no longer) pending is left untouched.
 */
export async function confirmPayment(paymentId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.status !== "pending") return;

  const now = new Date();
  await db.update(payments).set({ status: "confirmed", confirmedAt: now }).where(eq(payments.id, paymentId));

  const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, payment.requestId)).limit(1);
  if (!request || request.status !== "delivered") return;

  await db.update(serviceRequests).set({ status: "paid", updatedAt: now }).where(eq(serviceRequests.id, payment.requestId));
  await recordRequestEvent(payment.requestId, "paid", "system", now);
  await rewardInviterFor(request.clientAccountId);
  // Bank confirmations arrive on a timer, outside any HTTP request: tell the real-time channel by hand.
  notifyRealtimeChange();

  // Cash ride settled: the provider now owes this ride's platform fee + commission.
  // If that tips their cash balance negative, take them offline until they deposit.
  if (payment.paymentMethod === "cash" && request.providerAccountId) {
    const { balanceKz } = await cashBalanceKz(request.providerAccountId);
    if (isBlockedByCashBalance(balanceKz)) {
      await db.update(providers).set({ online: false }).where(eq(providers.accountId, request.providerAccountId));
    }
  }
}

export async function createBankReferencePayment(requestId: string, amountKz: number) {
  const now = new Date();
  const [row] = await db
    .insert(payments)
    .values({
      id: newId("pay"),
      requestId,
      paymentMethod: "bank_reference",
      status: "pending",
      amountKz,
      bankReference: {
        entity: BANK_REFERENCE_ENTITY,
        reference: generateBankReferenceDigits(),
        expires_at: new Date(now.getTime() + 48 * 3600_000).toISOString(),
      },
      createdAt: now,
    })
    .returning();

  setTimeout(() => {
    void confirmPayment(row!.id).catch(() => undefined);
  }, BANK_CONFIRMATION_MS);

  return row!;
}

export async function createConfirmedPayment(requestId: string, paymentMethod: "card" | "cash", amountKz: number) {
  const [row] = await db
    .insert(payments)
    .values({
      id: newId("pay"),
      requestId,
      paymentMethod,
      status: "pending",
      amountKz,
      bankReference: null,
      createdAt: new Date(),
    })
    .returning();

  await confirmPayment(row!.id);
  const [confirmed] = await db.select().from(payments).where(eq(payments.id, row!.id)).limit(1);
  return confirmed!;
}
