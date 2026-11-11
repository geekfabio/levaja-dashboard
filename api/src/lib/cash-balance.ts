import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cashDeposits } from "../db/schema/finance";
import { serviceRequests } from "../db/schema/ops";

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

/**
 * Only payment method today is cash in hand: the client pays the provider
 * directly, so the provider ends up holding the platform's cut too (platform
 * fee + commission) for every cash ride. This is what the provider owes back;
 * admin-billing.ts tracks the same debt for the "Facturação" screen (its
 * pricingFee/commissionOf are duplicated here on purpose, to add this gate
 * without touching that already-tested module).
 */
export async function cashBalanceKz(providerAccountId: string) {
  const [requests, deposits] = await Promise.all([
    db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, providerAccountId)),
    db.select().from(cashDeposits).where(eq(cashDeposits.providerAccountId, providerAccountId)),
  ]);
  const owedKz = requests.filter(isSettledCashRequest).reduce((sum, row) => sum + pricingFee(row) + commissionOf(row), 0);
  const depositedKz = deposits.reduce((sum, row) => sum + row.amountKz, 0);
  return { owedKz, depositedKz, balanceKz: depositedKz - owedKz };
}

/** Negative balance: the provider owes more than deposited and must top up (deposit) before working again. */
export function isBlockedByCashBalance(balanceKz: number) {
  return balanceKz < 0;
}
