"use client";

import { useCallback, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SearchField from "@/components/admin/shared/search-field";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import type { PromotionSummary } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClock } from "@/hooks/admin/use-clock";
import { usePromotionAction, usePromotions } from "@/hooks/admin/use-commerce";
import { formatDateNumeric, formatKz, formatNumber, luandaDay } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { PROMOTION_STATUS_LABELS, PROMOTION_STATUS_TONES } from "@/lib/leva-ja/commerce";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { PromotionStatus } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import PromotionDialog from "./promotion-dialog";

const STATUS_OPTIONS = [{ value: "all", label: "Todas" }, ...(Object.keys(PROMOTION_STATUS_LABELS) as PromotionStatus[]).map((status) => ({ value: status, label: PROMOTION_STATUS_LABELS[status] }))];

function discountLabel(promotion: PromotionSummary) {
  if (promotion.kind === "fixed") return formatKz(promotion.value);
  return `${promotion.value} %${promotion.maxDiscount ? ` até ${formatKz(promotion.maxDiscount)}` : ""}`;
}

export default function Promotions() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{ promotion: PromotionSummary; kind: "pause" | "end" } | null>(null);
  const list = usePromotions({ status: status === "all" ? undefined : [status as PromotionStatus], q: q || undefined, page, pageSize: 15 });
  const all = usePromotions({ pageSize: 200 });
  const mutate = usePromotionAction();
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  if (!role) return null;
  const canManage = hasPermission(role, "promotions.manage");
  const items = all.data?.items;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Promoções" count={list.data?.total} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <SummaryTiles
            tiles={
              items
                ? [
                    { label: "Activas", value: items.filter((item) => item.status === "active").length, display: formatNumber(items.filter((item) => item.status === "active").length) },
                    { label: "Descontos concedidos", value: items.reduce((sum, item) => sum + item.spent, 0), display: formatKz(items.reduce((sum, item) => sum + item.spent, 0)) },
                    { label: "Utilizações", value: items.reduce((sum, item) => sum + item.usesCount, 0), display: formatNumber(items.reduce((sum, item) => sum + item.usesCount, 0)) },
                    { label: "Volume com promoção", value: items.reduce((sum, item) => sum + item.volume, 0), display: formatKz(items.reduce((sum, item) => sum + item.volume, 0)) },
                  ]
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchField label="Pesquisar promoções" placeholder="Código ou nome" onSearch={onSearch} />
            <FilterMenu
              label="Estado"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            {canManage && (
              <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
                <PlusIcon aria-hidden className="size-3" />
                Nova promoção
              </Button>
            )}
          </div>
          <AsyncState
            query={list}
            skeleton={<Skeleton className="h-60 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(data) => data.items.length === 0}
            empty={{ title: "Sem promoções", description: "Não há promoções com estes filtros." }}
          >
            {(data) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Promoções" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Código</TableHead>
                        <TableHead scope="col">Desconto</TableHead>
                        <TableHead scope="col">Período</TableHead>
                        <TableHead scope="col">Orçamento</TableHead>
                        <TableHead scope="col" className="text-right">
                          Utilizações
                        </TableHead>
                        <TableHead scope="col">Estado</TableHead>
                        <TableHead scope="col">
                          <span className="sr-only">Acções</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((promotion) => {
                        const used = promotion.budget ? Math.min(100, Math.round((promotion.spent / promotion.budget) * 100)) : 0;
                        return (
                          <TableRow key={promotion.id}>
                            <TableCell>
                              <span className="lead-style font-semibold tabular-nums">{promotion.code}</span>
                              <span className="caption-style text-subtle block pt-0.5">{promotion.name}</span>
                            </TableCell>
                            <TableCell>
                              {discountLabel(promotion)}
                              <span className="caption-style text-subtle block pt-0.5">
                                {promotion.services.length ? promotion.services.map((service) => SERVICE_SHORT_LABELS[service]).join(", ") : "Todos os serviços"}
                                {promotion.minOrder ? ` · mínimo ${formatKz(promotion.minOrder)}` : ""}
                                {promotion.firstOrderOnly ? " · 1.º pedido" : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-soft tabular-nums">
                              {formatDateNumeric(promotion.startsAt)} a {formatDateNumeric(promotion.endsAt)}
                            </TableCell>
                            <TableCell className="min-w-[160px]">
                              <span className="caption-style tabular-nums">
                                {formatKz(promotion.spent)} de {formatKz(promotion.budget)}
                              </span>
                              <span aria-hidden className="bg-track mt-1 block h-1.5 overflow-hidden rounded-full">
                                <span className="bg-brand-vivid block h-full rounded-full" style={{ width: `${used}%` }} />
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(promotion.usesCount)}
                              <span className="caption-style text-subtle block pt-0.5">{formatNumber(promotion.clients)} cliente(s)</span>
                            </TableCell>
                            <TableCell>
                              <ToneBadge tone={PROMOTION_STATUS_TONES[promotion.status]} label={PROMOTION_STATUS_LABELS[promotion.status]} />
                            </TableCell>
                            <TableCell>
                              {canManage && (
                                <span className="flex justify-end gap-1.5">
                                  {(promotion.status === "active" || promotion.status === "scheduled") && (
                                    <Button variant="secondary" size="sm" onClick={() => setAction({ promotion, kind: "pause" })}>
                                      Pausar
                                    </Button>
                                  )}
                                  {promotion.status === "paused" && (
                                    <Button variant="secondary" size="sm" disabled={mutate.isPending} onClick={() => mutate.mutate({ id: promotion.id, action: "resume" })}>
                                      Retomar
                                    </Button>
                                  )}
                                  {promotion.status !== "ended" && (
                                    <Button variant="ghost" size="sm" onClick={() => setAction({ promotion, kind: "end" })}>
                                      Terminar
                                    </Button>
                                  )}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das promoções" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <PromotionDialog key={creating ? "open" : "closed"} open={creating} onOpenChange={setCreating} today={luandaDay(new Date(now))} />
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            mutate.reset();
          }
        }}
        title={action ? `${action.kind === "pause" ? "Pausar" : "Terminar"} ${action.promotion.code}` : ""}
        description={action?.kind === "pause" ? "O código deixa de ser aceite até ser retomado." : "O código deixa de ser aceite de vez."}
        confirmLabel={action?.kind === "pause" ? "Pausar" : "Terminar"}
        tone={action?.kind === "end" ? "danger" : "primary"}
        requireReason
        pending={mutate.isPending}
        error={mutationError(mutate.error)}
        onConfirm={(reason) => (action ? mutate.mutateAsync({ id: action.promotion.id, action: action.kind, reason }).then(() => setAction(null), () => undefined) : undefined)}
      />
    </section>
  );
}
