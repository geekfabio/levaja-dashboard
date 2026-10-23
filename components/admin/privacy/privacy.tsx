"use client";

import { useCallback, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SearchField from "@/components/admin/shared/search-field";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { usePrivacyRequests, usePrivacySummary } from "@/hooks/admin/use-trust";
import { formatDateNumeric, formatNumber } from "@/lib/format";
import { PRIVACY_CHANNEL_LABELS, PRIVACY_KIND_LABELS, PRIVACY_STATUS_LABELS, PRIVACY_STATUS_TONES } from "@/lib/leva-ja/trust";
import type { PrivacyRequestKind, PrivacyRequestStatus } from "@/types/leva-ja";
import DeadlineBadge from "./detail/deadline-badge";
import PrivacySheet from "./detail/privacy-sheet";

const STATUS_OPTIONS = [
  { value: "open", label: "Em aberto" },
  ...(Object.keys(PRIVACY_STATUS_LABELS) as PrivacyRequestStatus[]).map((status) => ({ value: status, label: PRIVACY_STATUS_LABELS[status] })),
  { value: "all", label: "Todos" },
];
const KIND_OPTIONS = [
  { value: "all", label: "Todos" },
  ...(Object.keys(PRIVACY_KIND_LABELS) as PrivacyRequestKind[]).map((kind) => ({
    value: kind,
    label: PRIVACY_KIND_LABELS[kind],
  })),
];

export default function Privacy() {
  const now = useClock();
  const summary = usePrivacySummary();
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = usePrivacyRequests({
    status: status === "all" ? undefined : status === "open" ? ["received", "in_progress"] : [status as PrivacyRequestStatus],
    kind: kind === "all" ? undefined : [kind as PrivacyRequestKind],
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  const data = summary.data;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Protecção de dados" count={data?.open} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <p className="caption-style text-subtle max-w-[64em]">
            Pedidos dos titulares sobre os seus dados pessoais (Lei n.º 22/11). A plataforma responde a cada pedido em 30 dias; a eliminação anonimiza a conta e mantém os pedidos e as facturas.
          </p>
          <SummaryTiles
            tiles={
              data
                ? [
                    {
                      label: "Em aberto",
                      value: data.open,
                      display: formatNumber(data.open),
                    },
                    {
                      label: "Prazo a terminar em 7 dias",
                      value: data.dueSoon,
                      display: formatNumber(data.dueSoon),
                    },
                    {
                      label: "Fora do prazo",
                      value: data.overdue,
                      display: formatNumber(data.overdue),
                    },
                    {
                      label: "Concluídos em 30 dias",
                      value: data.completedLast30,
                      display: formatNumber(data.completedLast30),
                    },
                  ]
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchField label="Pesquisar pedidos de dados" placeholder="Código, titular ou descrição" onSearch={onSearch} />
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
              label="Tipo"
              value={kind}
              options={KIND_OPTIONS}
              onChange={(value) => {
                setKind(value);
                setPage(1);
              }}
            />
          </div>
          <AsyncState
            query={list}
            skeleton={<Skeleton className="h-72 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(result) => result.items.length === 0}
            empty={{
              title: "Sem pedidos",
              description: "Não há pedidos de dados com estes filtros.",
            }}
          >
            {(result) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Pedidos de dados pessoais" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Pedido</TableHead>
                        <TableHead scope="col">Titular</TableHead>
                        <TableHead scope="col">Tipo</TableHead>
                        <TableHead scope="col">Recebido</TableHead>
                        <TableHead scope="col">Prazo</TableHead>
                        <TableHead scope="col">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.items.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <Button variant="link" size="none" onClick={() => setOpenId(request.id)}>
                              {request.code}
                            </Button>
                            <span className="caption-style text-subtle block pt-0.5">{PRIVACY_CHANNEL_LABELS[request.channel]}</span>
                          </TableCell>
                          <TableCell>
                            {request.subjectName}
                            <span className="caption-style text-subtle ml-1.5">{request.subjectKind === "client" ? "cliente" : "prestador"}</span>
                          </TableCell>
                          <TableCell className="text-soft">{PRIVACY_KIND_LABELS[request.kind]}</TableCell>
                          <TableCell className="text-soft tabular-nums">{formatDateNumeric(request.receivedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <DeadlineBadge request={request} now={now} />
                          </TableCell>
                          <TableCell>
                            <ToneBadge tone={PRIVACY_STATUS_TONES[request.status]} label={PRIVACY_STATUS_LABELS[request.status]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} label="Paginação dos pedidos de dados" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <PrivacySheet requestId={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
