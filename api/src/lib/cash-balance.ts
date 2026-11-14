import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { cashDeposits } from "../db/schema/finance";
import { serviceRequests, walletTransactions } from "../db/schema/ops";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const SETTLED_STATUSES = ["paid", "rated"] as const;

function pricingTotal(row: ServiceRequestRow) {
  const pricing = row.pricing as { total_kz?: number } | null;
  return pricing?.total_kz ?? 0;
}

function pricingFee(row: ServiceRequestRow) {
  const pricing = row.pricing as { platform_fee_kz?: number } | null;
  return pricing?.platform_fee_kz ?? 0;
}

function commissionOf(row: ServiceRequestRow) {
  if (row.providerEarningKz === null) return 0;
  return Math.max(0, pricingTotal(row) - pricingFee(row) - row.providerEarningKz);
}

function isSettledCashRequest(row: ServiceRequestRow) {
  return (SETTLED_STATUSES as readonly string[]).includes(row.status) && row.paymentMethod === "cash";
}

function discountOf(row: ServiceRequestRow) {
  const pricing = row.pricing as { discount_kz?: number } | null;
  return pricing?.discount_kz ?? 0;
}

/**
 * Only payment method today is cash in hand: the client pays the provider
 * directly, so the provider ends up holding the platform's cut too (platform
 * fee + commission) for every cash ride. This is what the provider owes back;
 * admin-billing.ts tracks the same debt for the "Facturação" screen (its
 * pricingFee/commissionOf are duplicated here on purpose, to add this gate
 * without touching that already-tested module).
 *
 * The other way round, the platform owes the provider: the promotion/invite
 * discounts the client did not pay in cash, and the per-ride bonus. Those are
 * credits, so they pay off the debt before any deposit is needed.
 */
export async function cashBalanceKz(providerAccountId: string) {
  const [requests, deposits, bonuses] = await Promise.all([
    db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, providerAccountId)),
    db.select().from(cashDeposits).where(eq(cashDeposits.providerAccountId, providerAccountId)),
    db
      .select()
      .from(walletTransactions)
      .where(and(eq(walletTransactions.providerAccountId, providerAccountId), eq(walletTransactions.type, "bonus"), eq(walletTransactions.status, "completed"))),
  ]);
  const settled = requests.filter(isSettledCashRequest);
  const owedKz = settled.reduce((sum, row) => sum + pricingFee(row) + commissionOf(row), 0);
  const depositedKz = deposits.reduce((sum, row) => sum + row.amountKz, 0);
  const discountsKz = settled.reduce((sum, row) => sum + discountOf(row), 0);
  const bonusKz = bonuses.reduce((sum, row) => sum + row.amountKz, 0);
  const creditsKz = discountsKz + bonusKz;
  return { owedKz, depositedKz, creditsKz, bonusKz, discountsKz, balanceKz: depositedKz + creditsKz - owedKz };
}

/** Negative balance: the provider owes more than deposited and must top up (deposit) before working again. */
export function isBlockedByCashBalance(balanceKz: number) {
  return balanceKz < 0;
}
