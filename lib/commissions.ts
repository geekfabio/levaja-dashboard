import {
  OVERACHIEVEMENT_BONUS,
  OVERACHIEVEMENT_THRESHOLD,
  type CommissionTier,
} from "@/data/commissions";
import type { Company } from "@/data/companies";
import type { Sale } from "@/data/sales";

export type SellerResult = {
  owner: string;
  target: number;
  sold: number;
  paid: number;
  unpaid: number;
  achievement: number;
  rate: number;
  commission: number;
  pending: number;
  bonus: number;
  projection: number;
  clients: number;
};

export function rateFor(achievement: number, tiers: CommissionTier[]) {
  return [...tiers].sort((a, b) => b.from - a.from).find((tier) => achievement >= tier.from)?.rate ?? 0;
}

function daysInMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).getUTCDate();
}

export function monthProgress(month: string, today: string) {
  if (today.slice(0, 7) > month) return 1;
  if (today.slice(0, 7) < month) return 0;
  return Number(today.slice(8, 10)) / daysInMonth(month);
}

export function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function sellerResults(
  sales: Sale[],
  companies: Company[],
  month: string,
  today: string,
  targets: (owner: string) => number,
  tiers: CommissionTier[],
): SellerResult[] {
  const ownerOf = new Map(companies.map((company) => [company.id, company.owner]));
  const totals = new Map<string, { sold: number; paid: number; clients: Set<string> }>();
  for (const sale of sales) {
    if (!sale.companyId || sale.at.slice(0, 7) !== month) continue;
    const owner = ownerOf.get(sale.companyId);
    if (!owner) continue;
    const entry = totals.get(owner) ?? { sold: 0, paid: 0, clients: new Set<string>() };
    entry.sold += sale.total;
    if (sale.payment !== "Crédito" || sale.paid) entry.paid += sale.total;
    entry.clients.add(sale.companyId);
    totals.set(owner, entry);
  }
  const progress = monthProgress(month, today);
  const owners = new Set([...totals.keys(), ...companies.filter((company) => !company.archived).map((company) => company.owner)]);

  return [...owners]
    .map((owner) => {
      const entry = totals.get(owner) ?? { sold: 0, paid: 0, clients: new Set<string>() };
      const target = targets(owner);
      const achievement = target > 0 ? Math.round((entry.sold / target) * 100) : 0;
      const rate = rateFor(achievement, tiers);
      const bonus = achievement >= OVERACHIEVEMENT_THRESHOLD ? OVERACHIEVEMENT_BONUS : 0;
      return {
        owner,
        target,
        sold: entry.sold,
        paid: entry.paid,
        unpaid: entry.sold - entry.paid,
        achievement,
        rate,
        commission: Math.round((entry.paid * rate) / 100) + bonus,
        pending: Math.round(((entry.sold - entry.paid) * rate) / 100),
        bonus,
        projection: progress > 0 ? Math.round(entry.sold / progress) : 0,
        clients: entry.clients.size,
      };
    })
    .sort((a, b) => b.achievement - a.achievement || b.sold - a.sold);
}
