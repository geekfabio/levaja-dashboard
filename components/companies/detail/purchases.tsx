"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { PAYMENT_TONES } from "@/data/sales";
import { useToday } from "@/hooks/use-today";
import {
  formatDateShort,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  plural,
} from "@/lib/format";
import { abcBySales, purchaseStats } from "@/lib/sales";
import { cn } from "@/lib/utils";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSalesStore } from "@/stores/sales-store";
import DiscountOffer from "./discount-offer";

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="border-line-strong flex min-w-0 flex-col gap-2 rounded-lg border p-[11px]">
      <span className="caption-style text-soft flex items-center gap-1.5">
        {tone && (
          <span aria-hidden className={cn("size-1.5 rounded-full", tone === "danger" ? "bg-danger" : "bg-warning")} />
        )}
        {label}
      </span>
      <span className="lead-style block truncate font-medium tabular-nums">{value}</span>
      {hint && <span className="caption-style text-subtle">{hint}</span>}
    </div>
  );
}

export default function Purchases({ companyId, companyName }: { companyId: string; companyName: string }) {
  const sales = useSalesStore((state) => state.sales);
  const markPaid = useSalesStore((state) => state.markPaid);
  const setSearch = useSalesStore((state) => state.setSearch);
  const companies = useCompaniesStore((state) => state.companies);
  const closeDetail = useCompaniesStore((state) => state.closeDetail);
  const router = useRouter();
  const today = useToday();

  const creditLimit = companies.find((company) => company.id === companyId)?.profile?.creditLimit;
  const stats = useMemo(
    () => purchaseStats(sales, companyId, today, creditLimit),
    [sales, companyId, today, creditLimit],
  );
  const abc = useMemo(() => abcBySales(companies, sales, today).get(companyId), [companies, sales, companyId, today]);
  const recent = useMemo(
    () => sales.filter((sale) => sale.companyId === companyId).slice(0, 5),
    [sales, companyId],
  );

  if (!stats.lastPurchaseAt) {
    return (
      <p className="caption-style text-subtle">
        Ainda sem compras registadas. As compras chegam do sistema de vendas quando o cliente se
        identifica na caixa com cartão de cliente, NIF ou telefone.
      </p>
    );
  }

  const since = stats.daysSincePurchase ?? 0;
  const utilization = stats.creditLimit ? Math.min(stats.debt / stats.creditLimit, 1) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Última compra"
          value={since === 0 ? "Hoje" : since === 1 ? "Ontem" : `Há ${since} dias`}
          hint={stats.usualInterval ? `Costuma comprar a cada ${stats.usualInterval} d` : undefined}
          tone={stats.atRisk ? "danger" : undefined}
        />
        <Stat label="Volume 90 dias" value={formatMoneyCompact(stats.volume)} hint={plural(stats.count, "compra", "compras")} />
        <Stat label="Ticket médio" value={stats.averageTicket ? formatMoneyCompact(stats.averageTicket) : "—"} />
        <Stat label="Classe ABC" value={abc ?? "—"} hint="pelo volume de 90 dias" />
      </div>

      {stats.atRisk && (
        <p role="status" className="caption-style text-danger">
          Fora do ritmo habitual: sem compras há {since} dias
          {stats.usualInterval ? `, quando costuma comprar a cada ${stats.usualInterval}` : ""}. Bom
          candidato a um contacto de seguimento.
        </p>
      )}

      <DiscountOffer companyId={companyId} />

      {stats.topCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="caption-style text-subtle">Compra sobretudo:</span>
          {stats.topCategories.map((category) => (
            <Tag key={category} tone="neutral" size="sm">
              {category}
            </Tag>
          ))}
        </div>
      )}

      {(stats.creditLimit || stats.debt > 0) && (
        <div className="flex flex-col gap-2">
          <div className="caption-style flex flex-wrap items-center justify-between gap-2">
            <span className="text-soft">
              Em dívida <span className="text-foreground font-medium tabular-nums">{formatMoney(stats.debt)}</span>
              {stats.creditLimit ? ` de ${formatMoney(stats.creditLimit)} de limite` : ""}
            </span>
            {stats.overdueDebt > 0 && (
              <Tag tone="red" size="sm">
                {formatMoneyCompact(stats.overdueDebt)} vencido
              </Tag>
            )}
          </div>
          {stats.creditLimit && (
            <div
              role="progressbar"
              aria-label="Utilização do limite de crédito"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(utilization * 100)}
              className="h-1.5 overflow-hidden rounded-full bg-white/6"
            >
              <span
                className={cn("block h-full rounded-full", utilization > 0.9 ? "bg-danger" : utilization > 0.7 ? "bg-warning" : "bg-primary")}
                style={{ width: `${utilization * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <ul className="divide-border flex flex-col divide-y">
        {recent.map((sale) => {
          const inDebt = sale.payment === "Crédito" && !sale.paid;
          return (
            <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="lead-style tabular-nums">{sale.document}</span>
                <span className="caption-style text-subtle">
                  {formatDateShort(sale.at.slice(0, 10))} · {sale.channel} · {plural(sale.lines.length, "linha", "linhas")}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Tag tone={inDebt ? "red" : PAYMENT_TONES[sale.payment]} size="sm">
                  {inDebt ? "Em dívida" : sale.payment}
                </Tag>
                <span className="lead-style font-medium tabular-nums">{formatMoney(sale.total)}</span>
                {inDebt && (
                  <Button variant="ghost" size="sm" onClick={() => markPaid(sale.id)}>
                    Pago
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => {
          setSearch(companyName);
          closeDetail();
          router.push("/vendas");
        }}
      >
        Ver todas as vendas · {formatNumber(sales.filter((sale) => sale.companyId === companyId).length)}
      </Button>
    </div>
  );
}
