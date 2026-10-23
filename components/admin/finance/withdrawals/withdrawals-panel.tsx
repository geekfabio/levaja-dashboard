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
import { useWithdrawals } from "@/hooks/admin/use-finance";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { WITHDRAWAL_STATUS_LABELS } from "@/lib/leva-ja/services";
import type { Withdrawal, WithdrawalStatus } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import WithdrawalDialog, { type WithdrawalAction } from "./withdrawal-dialogs";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  ...(Object.keys(WITHDRAWAL_STATUS_LABELS) as WithdrawalStatus[]).map((status) => ({ value: status, label: WITHDRAWAL_STATUS_LABELS[status] })),
];

const STATUS_TONES = { pending: "warning", approved: "info", rejected: "danger", paid: "success" } as const;

export default function WithdrawalsPanel({ canDecide }: { canDecide: boolean }) {
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<{ withdrawal: Withdrawal; action: WithdrawalAction } | null>(null);
  const list = useWithdrawals({ status: status === "all" ? undefined : [status as WithdrawalStatus], q: q || undefined, page, pageSize: 15 });

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
          <span className="sr-only">Pesquisar por prestador, IBAN ou referência</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Prestador, IBAN ou referência" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: status === "pending" ? "Sem levantamentos pendentes" : "Sem levantamentos", description: "Não há levantamentos com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Levantamentos" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Prestador</TableHead>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                    <TableHead scope="col">IBAN</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Pedido em</TableHead>
                    <TableHead scope="col">Decisão</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Acções</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${withdrawal.providerId}`}>
                          {withdrawal.providerName}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatKz(withdrawal.amount)}</TableCell>
                      <TableCell className="text-soft caption-style tabular-nums">{withdrawal.iban}</TableCell>
                      <TableCell>
                        <ToneBadge tone={STATUS_TONES[withdrawal.status]} label={WITHDRAWAL_STATUS_LABELS[withdrawal.status]} />
                      </TableCell>
                      <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(withdrawal.requestedAt)}</TableCell>
                      <TableCell className="text-soft caption-style max-w-[220px] truncate" title={withdrawal.reason ?? withdrawal.paymentReference}>
                        {withdrawal.status === "pending"
                          ? "—"
                          : withdrawal.status === "paid"
                            ? `Ref. ${withdrawal.paymentReference}`
                            : withdrawal.status === "rejected"
                              ? withdrawal.reason
                              : `${withdrawal.decidedBy ?? ""}${withdrawal.decidedAt ? ` · ${formatDateTimeNumeric(withdrawal.decidedAt)}` : ""}`}
                      </TableCell>
                      <TableCell>
                        {canDecide && (
                          <span className="flex justify-end gap-1.5">
                            {withdrawal.status === "pending" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ withdrawal, action: "approve" })}>
                                Aprovar
                              </Button>
                            )}
                            {withdrawal.status === "approved" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ withdrawal, action: "paid" })}>
                                Marcar como pago
                              </Button>
                            )}
                            {(withdrawal.status === "pending" || withdrawal.status === "approved") && (
                              <Button variant="ghost" size="sm" onClick={() => setActive({ withdrawal, action: "reject" })}>
                                Rejeitar
                              </Button>
                            )}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação dos levantamentos" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
      {active && <WithdrawalDialog key={`${active.withdrawal.id}-${active.action}`} withdrawal={active.withdrawal} action={active.action} onClose={() => setActive(null)} />}
    </div>
  );
}
