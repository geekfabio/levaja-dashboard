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
import { useClaims, useClaimSummary } from "@/hooks/admin/use-operations";
import { formatDateTimeNumeric, formatKz, formatNumber } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from "@/lib/leva-ja/scheduling";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { ClaimKind, ClaimStatus } from "@/types/leva-ja";
import ClaimSheet from "./detail/claim-sheet";

const STATUS_OPTIONS = [
  { value: "open", label: "Em aberto" },
  ...(Object.keys(CLAIM_STATUS_LABELS) as ClaimStatus[]).map((status) => ({ value: status, label: CLAIM_STATUS_LABELS[status] })),
  { value: "all", label: "Todos" },
];
const KIND_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(CLAIM_KIND_LABELS) as ClaimKind[]).map((kind) => ({ value: kind, label: CLAIM_KIND_LABELS[kind] }))];

export default function Claims() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const summary = useClaimSummary();
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useClaims({
    status: status === "all" ? undefined : status === "open" ? ["reported", "under_review"] : [status as ClaimStatus],
    kind: kind === "all" ? undefined : [kind as ClaimKind],
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  if (!role) return null;
  const data = summary.data;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Sinistros" count={data?.open} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <SummaryTiles
            tiles={
              data
                ? [
                    { label: "Em aberto", value: data.open, display: formatNumber(data.open) },
                    { label: "Em análise", value: data.underReview, display: formatNumber(data.underReview) },
                    { label: "Prejuízo estimado em aberto", value: data.openEstimated, display: formatKz(data.openEstimated) },
                    { label: "Indemnizado em 90 dias", value: data.paidLast90, display: formatKz(data.paidLast90) },
                  ]
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchField label="Pesquisar sinistros" placeholder="Código, pedido, cliente ou seguradora" onSearch={onSearch} />
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
            isEmpty={(page) => page.items.length === 0}
            empty={{ title: "Sem sinistros", description: "Não há sinistros com estes filtros." }}
          >
            {(page) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Sinistros" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Sinistro</TableHead>
                        <TableHead scope="col">Tipo</TableHead>
                        <TableHead scope="col">Cliente</TableHead>
                        <TableHead scope="col">Prestador</TableHead>
                        <TableHead scope="col" className="text-right">
                          Estimado
                        </TableHead>
                        <TableHead scope="col">Participado</TableHead>
                        <TableHead scope="col">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {page.items.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell>
                            <Button variant="link" size="none" onClick={() => setOpenId(claim.id)}>
                              {claim.code}
                            </Button>
                            <span className="caption-style text-subtle block pt-0.5 tabular-nums">{claim.requestCode}</span>
                          </TableCell>
                          <TableCell className="text-soft">{CLAIM_KIND_LABELS[claim.kind]}</TableCell>
                          <TableCell>{claim.clientName}</TableCell>
                          <TableCell>{claim.providerName ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatKz(claim.estimatedAmount)}</TableCell>
                          <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(claim.reportedAt)}</TableCell>
                          <TableCell>
                            <ToneBadge tone={CLAIM_STATUS_TONES[claim.status]} label={CLAIM_STATUS_LABELS[claim.status]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPageChange={setPage} label="Paginação dos sinistros" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <ClaimSheet claimId={openId} onClose={() => setOpenId(null)} canManage={hasPermission(role, "claims.manage")} canOpenRequest={hasPermission(role, "requests.view")} />
    </section>
  );
}
