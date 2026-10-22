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
import type { DisputeFilters } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useDisputes } from "@/hooks/admin/use-disputes";
import { formatDateTimeNumeric, formatElapsed, formatKz } from "@/lib/format";
import { DISPUTE_CATEGORIES, DISPUTE_CATEGORY_LABELS } from "@/lib/leva-ja/refunds";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import type { DisputeCategory } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import { disputeBadge } from "../detail/dispute-panel";

const STATE_OPTIONS = [
  { value: "open", label: "Abertas" },
  { value: "overdue", label: "Fora do prazo" },
  { value: "resolved", label: "Resolvidas" },
  { value: "all", label: "Todas" },
];

const CATEGORY_OPTIONS = [{ value: "all", label: "Todas" }, ...DISPUTE_CATEGORIES.map((category) => ({ value: category, label: DISPUTE_CATEGORY_LABELS[category] }))];

export default function DisputesTable({ onOpen }: { onOpen: (requestId: string) => void }) {
  const now = useClock();
  const [state, setState] = useState("open");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useDisputes({
    state: state === "all" ? undefined : (state as DisputeFilters["state"]),
    category: category === "all" ? undefined : [category as DisputeCategory],
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
          <span className="sr-only">Pesquisar por pedido, cliente, prestador ou motivo</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Pedido, cliente, prestador ou motivo" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
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
        <FilterMenu
          label="Categoria"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: state === "open" ? "Sem disputas abertas" : "Sem disputas", description: "Não há disputas com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Disputas" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Pedido</TableHead>
                    <TableHead scope="col">Categoria</TableHead>
                    <TableHead scope="col">Cliente</TableHead>
                    <TableHead scope="col">Prestador</TableHead>
                    <TableHead scope="col">Aberta</TableHead>
                    <TableHead scope="col" className="text-right">
                      Pago
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Reembolsado
                    </TableHead>
                    <TableHead scope="col">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map(({ request, refunded }) => {
                    const dispute = request.dispute;
                    if (!dispute) return null;
                    const badge = disputeBadge(dispute, now);
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Button variant="link" size="none" onClick={() => onOpen(request.id)} aria-label={`Abrir disputa do pedido ${request.code}`}>
                            {request.code}
                          </Button>
                          <span className="caption-style text-subtle block pt-0.5">{SERVICE_SHORT_LABELS[request.kind]}</span>
                        </TableCell>
                        <TableCell className="text-soft">{DISPUTE_CATEGORY_LABELS[dispute.category ?? "other"]}</TableCell>
                        <TableCell>{request.client?.name ?? "—"}</TableCell>
                        <TableCell>{request.provider?.name ?? "—"}</TableCell>
                        <TableCell className="text-soft tabular-nums">
                          <span className="flex flex-col gap-0.5">
                            {formatDateTimeNumeric(dispute.openedAt)}
                            {!dispute.resolvedAt && <span className="caption-style text-subtle">há {formatElapsed(dispute.openedAt, now)}</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(request.price.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{refunded ? formatKz(refunded) : "—"}</TableCell>
                        <TableCell>
                          <ToneBadge tone={badge.tone} label={badge.label} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das disputas" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
