"use client";

import { useMemo, useState } from "react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { DEFAULT_MONTHLY_TARGET, OVERACHIEVEMENT_BONUS, OVERACHIEVEMENT_THRESHOLD } from "@/data/commissions";
import { profileByName } from "@/data/companies";
import { useToday } from "@/hooks/use-today";
import { sellerResults, shiftMonth } from "@/lib/commissions";
import { downloadCsv } from "@/lib/csv";
import { formatMoney, formatMoneyCompact, formatPercentDecimal, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCommissionsStore } from "@/stores/commissions-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSalesStore } from "@/stores/sales-store";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" });

function monthLabel(month: string) {
  const label = MONTH_FORMATTER.format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function TargetInput({ owner, value }: { owner: string; value: number }) {
  const setTarget = useCommissionsStore((state) => state.setTarget);
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) return setDraft(String(value));
    setTarget(owner, next);
  };
  return (
    <Input
      type="number"
      min={0}
      step={500000}
      inputMode="numeric"
      aria-label={`Objetivo mensal de ${owner} (Kz)`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      className="h-[30px] w-[130px] tabular-nums"
    />
  );
}

export default function CommissionsPanel() {
  const sales = useSalesStore((state) => state.sales);
  const companies = useCompaniesStore((state) => state.companies);
  const targets = useCommissionsStore((state) => state.targets);
  const tiers = useCommissionsStore((state) => state.tiers);
  const setTierRate = useCommissionsStore((state) => state.setTierRate);
  const today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7));

  const results = useMemo(
    () =>
      sellerResults(sales, companies, month, today, (owner) => targets[owner] ?? DEFAULT_MONTHLY_TARGET, tiers),
    [sales, companies, month, today, targets, tiers],
  );
  const totalCommission = results.reduce((sum, item) => sum + item.commission, 0);
  const current = month === today.slice(0, 7);

  function exportCsv() {
    downloadCsv(`comissoes-${month}.csv`, [
      ["Gestor", "Objetivo", "Vendido", "Recebido", "Por receber", "Cumprimento (%)", "Taxa (%)", "Prémio", "Comissão", "Comissão pendente"],
      ...results.map((item) => [
        item.owner,
        item.target,
        item.sold,
        item.paid,
        item.unpaid,
        item.achievement,
        item.rate,
        item.bonus,
        item.commission,
        item.pending,
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronIcon aria-hidden className="size-3 rotate-90" />
          </Button>
          <span className="lead-style min-w-[150px] text-center font-medium">{monthLabel(month)}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Mês seguinte" disabled={current} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronIcon aria-hidden className="size-3 -rotate-90" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="caption-style text-soft">
            Comissões {current ? "a pagar até hoje" : "do mês"}: <span className="text-foreground font-medium tabular-nums">{formatMoney(totalCommission)}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <ShareIcon aria-hidden className="size-3" />
            Exportar
          </Button>
        </div>
      </div>

      <ScrollArea orientation="both" className="max-h-[520px]">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Gestor</TableHead>
              <TableHead>Objetivo mensal</TableHead>
              <TableHead>Cumprimento</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              {current && <TableHead className="text-right">Projeção</TableHead>}
              <TableHead className="text-right">Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item) => {
              const profile = profileByName(item.owner);
              return (
                <TableRow key={item.owner}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar src={profile.avatar} alt="" />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.owner}</span>
                        <span className="caption-style text-subtle">{plural(item.clients, "cliente comprou", "clientes compraram")}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <TargetInput key={item.target} owner={item.owner} value={item.target} />
                  </TableCell>
                  <TableCell>
                    <span className="flex min-w-[160px] flex-col gap-1">
                      <span
                        role="progressbar"
                        aria-label={`Cumprimento de ${item.owner}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(item.achievement, 100)}
                        className="h-1.5 overflow-hidden rounded-full bg-white/8"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            item.achievement >= 100 ? "bg-success" : item.achievement >= 80 ? "bg-primary" : "bg-warning",
                          )}
                          style={{ width: `${Math.min(item.achievement, 100)}%` }}
                        />
                      </span>
                      <span className="caption-style text-soft tabular-nums">
                        {item.achievement}% · taxa {formatPercentDecimal(item.rate)}
                        {item.bonus > 0 && " · com prémio"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="flex flex-col gap-0.5">
                      {formatMoneyCompact(item.sold)}
                      {item.unpaid > 0 && (
                        <span className="caption-style text-subtle">{formatMoneyCompact(item.unpaid)} por receber</span>
                      )}
                    </span>
                  </TableCell>
                  {current && (
                    <TableCell className={cn("text-right tabular-nums", item.projection >= item.target ? "text-(--tag-green-text)" : "text-soft")}>
                      {formatMoneyCompact(item.projection)}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{formatMoney(item.commission)}</span>
                      {item.pending > 0 && (
                        <span className="caption-style text-subtle">+{formatMoney(item.pending)} quando pagarem</span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex flex-wrap items-center gap-3">
        <span className="caption-style text-subtle">Taxa sobre o valor recebido:</span>
        {tiers.map((tier, index) => (
          <label key={tier.from} className="caption-style text-soft flex items-center gap-1.5">
            {index === 0 ? `até ${tiers[1]?.from ?? 100}%` : index === tiers.length - 1 ? `≥ ${tier.from}%` : `${tier.from}–${tiers[index + 1].from}%`}
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              inputMode="decimal"
              aria-label={`Taxa de comissão a partir de ${tier.from}% do objetivo`}
              value={tier.rate}
              onChange={(event) => setTierRate(tier.from, Number(event.target.value) || 0)}
              className="h-[30px] w-16 tabular-nums"
            />
            %
          </label>
        ))}
        <span className="caption-style text-subtle">
          Prémio de {formatMoney(OVERACHIEVEMENT_BONUS)} acima de {OVERACHIEVEMENT_THRESHOLD}%. Vendas a crédito só contam para a comissão quando pagas.
        </span>
      </div>
    </div>
  );
}
