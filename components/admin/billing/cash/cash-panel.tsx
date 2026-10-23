"use client";

import { useEffect, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import type { CashDebtFilters } from "@/data/leva-ja";
import { useCashDebts } from "@/hooks/admin/use-billing";
import { useClock } from "@/hooks/admin/use-clock";
import { formatDateTimeNumeric, formatElapsed, formatKz, formatNumber } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import type { CashDebt } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import CashDepositDialog from "./cash-deposit-dialog";

const STATE_OPTIONS = [
  { value: "owing", label: "Com dívida" },
  { value: "overdue", label: "Fora do prazo" },
  { value: "all", label: "Todos" },
];

export default function CashPanel({ canManage, settlementDays }: { canManage: boolean; settlementDays: number | undefined }) {
  const now = useClock();
  const [state, setState] = useState("owing");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<CashDebt | null>(null);
  const list = useCashDebts({ state: state as CashDebtFilters["state"], q: q || undefined, page, pageSize: 15 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
          <span className="sr-only">Pesquisar prestador</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Prestador ou telefone" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu
          label="Estado"
          value={state}
          options={STATE_OPTIONS}
          onChange={(value) => {
            setState(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem dívidas de numerário", description: "Todos os prestadores entregaram o numerário devido." }}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <dl className="caption-style text-soft flex flex-wrap gap-x-6 gap-y-1 tabular-nums" aria-label="Totais do numerário">
              <div className="flex gap-1.5">
                <dt>Por entregar</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.balance)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Prestadores com dívida</dt>
                <dd className="text-foreground font-medium">{formatNumber(data.totals.owingProviders)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Fora do prazo</dt>
                <dd className="text-danger font-medium">{formatNumber(data.totals.overdueProviders)}</dd>
              </div>
              {settlementDays !== undefined && (
                <div className="flex gap-1.5">
                  <dt>Prazo de entrega</dt>
                  <dd className="text-foreground font-medium">{settlementDays} dias</dd>
                </div>
              )}
            </dl>
            <div className="border-border bg-card flex flex-col rounded-xl border">
              <div className="overflow-x-auto">
                <Table aria-label="Numerário por entregar" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Prestador</TableHead>
                      <TableHead scope="col" className="text-right">
                        Serviços em numerário
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Devido
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Entregue
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Em dívida
                      </TableHead>
                      <TableHead scope="col">Mais antigo</TableHead>
                      <TableHead scope="col">Última entrega</TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">Acções</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((debt) => (
                      <TableRow key={debt.providerId}>
                        <TableCell>
                          <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${debt.providerId}`}>
                            {debt.providerName}
                          </Button>
                          <span className="caption-style text-subtle block pt-0.5 tabular-nums">{debt.providerPhone}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(debt.cashRequests)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(debt.owed)}</TableCell>
                        <TableCell className="text-soft text-right tabular-nums">{formatKz(debt.deposited)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatKz(Math.max(0, debt.balance))}</TableCell>
                        <TableCell>
                          {debt.oldestUnsettledAt ? (
                            <ToneBadge tone={debt.overdue ? "danger" : "warning"} label={`há ${formatElapsed(debt.oldestUnsettledAt, now)}`} />
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-soft tabular-nums">{debt.lastDepositAt ? formatDateTimeNumeric(debt.lastDepositAt) : "—"}</TableCell>
                        <TableCell>
                          <Button variant={canManage && debt.balance > 0 ? "primary" : "secondary"} size="sm" onClick={() => setActive(debt)}>
                            {canManage && debt.balance > 0 ? "Registar entrega" : "Ver entregas"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação do numerário" className="border-border border-t" />
            </div>
          </div>
        )}
      </AsyncState>
      {active && <CashDepositDialog key={active.providerId} debt={active} canManage={canManage} onClose={() => setActive(null)} />}
    </div>
  );
}
