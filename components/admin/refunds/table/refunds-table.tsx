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
import { useRefunds } from "@/hooks/admin/use-refunds";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { REFUND_SOURCE_LABELS, REFUND_STATUS_LABELS, REFUND_STATUS_TONES } from "@/lib/leva-ja/refunds";
import type { Refund, RefundSource, RefundStatus } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import RefundDialog from "../dialogs/refund-dialogs";
import type { RefundAction } from "../dialogs/refund-dialogs";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  ...(Object.keys(REFUND_STATUS_LABELS) as RefundStatus[]).map((status) => ({ value: status, label: REFUND_STATUS_LABELS[status] })),
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Todas" },
  ...(Object.keys(REFUND_SOURCE_LABELS) as RefundSource[]).map((source) => ({ value: source, label: REFUND_SOURCE_LABELS[source] })),
];

function decisionText(refund: Refund) {
  if (refund.status === "pending") return "—";
  if (refund.status === "paid") return `Ref. ${refund.paymentReference}`;
  if (refund.status === "rejected") return refund.decisionReason ?? "—";
  return `${refund.decidedBy ?? ""}${refund.decidedAt ? ` · ${formatDateTimeNumeric(refund.decidedAt)}` : ""}`;
}

export default function RefundsTable({ canDecide, canOpenRequest }: { canDecide: boolean; canOpenRequest: boolean }) {
  const [status, setStatus] = useState("pending");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<{ refund: Refund; action: RefundAction } | null>(null);
  const list = useRefunds({
    status: status === "all" ? undefined : [status as RefundStatus],
    source: source === "all" ? undefined : [source as RefundSource],
    q: q || undefined,
    page,
    pageSize: 15,
  });

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
          <span className="sr-only">Pesquisar por código, pedido, cliente ou referência</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Código, pedido, cliente ou referência" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
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
        <FilterMenu
          label="Origem"
          value={source}
          options={SOURCE_OPTIONS}
          onChange={(value) => {
            setSource(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: status === "pending" ? "Sem reembolsos por aprovar" : "Sem reembolsos", description: "Não há reembolsos com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Reembolsos" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Reembolso</TableHead>
                    <TableHead scope="col">Pedido</TableHead>
                    <TableHead scope="col">Cliente</TableHead>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                    <TableHead scope="col">Suportado por</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Pedido em</TableHead>
                    <TableHead scope="col">Decisão</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Acções</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell>
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium tabular-nums">{refund.code}</span>
                          <span className="caption-style text-subtle">{REFUND_SOURCE_LABELS[refund.source]}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {canOpenRequest ? (
                          <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${refund.requestId}`}>
                            {refund.requestCode}
                          </Button>
                        ) : (
                          refund.requestCode
                        )}
                      </TableCell>
                      <TableCell>{refund.clientName}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatKz(refund.amount)}</TableCell>
                      <TableCell className="text-soft">{refund.chargeProvider ? (refund.providerName ?? "Prestador") : "Plataforma"}</TableCell>
                      <TableCell>
                        <ToneBadge tone={REFUND_STATUS_TONES[refund.status]} label={REFUND_STATUS_LABELS[refund.status]} />
                      </TableCell>
                      <TableCell className="text-soft tabular-nums">
                        <span className="flex flex-col gap-0.5">
                          {formatDateTimeNumeric(refund.requestedAt)}
                          <span className="caption-style text-subtle">{refund.requestedBy}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-soft caption-style max-w-[220px] truncate" title={decisionText(refund)}>
                        {decisionText(refund)}
                      </TableCell>
                      <TableCell>
                        {canDecide && (
                          <span className="flex justify-end gap-1.5">
                            {refund.status === "pending" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ refund, action: "approve" })}>
                                Aprovar
                              </Button>
                            )}
                            {refund.status === "approved" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ refund, action: "paid" })}>
                                Marcar como pago
                              </Button>
                            )}
                            {(refund.status === "pending" || refund.status === "approved") && (
                              <Button variant="ghost" size="sm" onClick={() => setActive({ refund, action: "reject" })}>
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
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação dos reembolsos" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
      {active && <RefundDialog key={`${active.refund.id}-${active.action}`} refund={active.refund} action={active.action} onClose={() => setActive(null)} />}
    </div>
  );
}
