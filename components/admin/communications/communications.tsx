"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useBroadcastAction, useBroadcasts } from "@/hooks/admin/use-commerce";
import { useZones } from "@/hooks/admin/use-zones";
import { formatDateTimeNumeric, formatNumber, formatPercent } from "@/lib/format";
import { BROADCAST_CHANNEL_LABELS, BROADCAST_SEGMENT_LABELS, BROADCAST_STATUS_LABELS, BROADCAST_STATUS_TONES } from "@/lib/leva-ja/commerce";
import type { Broadcast, BroadcastChannel, BroadcastStatus } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import BroadcastDialog from "./broadcast-dialog";

const STATUS_OPTIONS = [{ value: "all", label: "Todas" }, ...(Object.keys(BROADCAST_STATUS_LABELS) as BroadcastStatus[]).map((status) => ({ value: status, label: BROADCAST_STATUS_LABELS[status] }))];
const CHANNEL_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(BROADCAST_CHANNEL_LABELS) as BroadcastChannel[]).map((channel) => ({ value: channel, label: BROADCAST_CHANNEL_LABELS[channel] }))];

type Action = { broadcast: Broadcast; kind: "send" | "schedule" | "cancel" } | null;

export default function Communications() {
  const zones = useZones();
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [at, setAt] = useState("");
  const mutate = useBroadcastAction();
  const list = useBroadcasts({
    status: status === "all" ? undefined : [status as BroadcastStatus],
    channel: channel === "all" ? undefined : [channel as BroadcastChannel],
    page,
    pageSize: 15,
  });
  const zoneName = (id: string) => zones.data?.find((zone) => zone.id === id)?.name ?? id;
  const close = (open: boolean) => {
    if (!open) {
      setAction(null);
      setAt("");
      mutate.reset();
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Comunicações" count={list.data?.total} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <div role="note" className="flex flex-col gap-1 rounded-xl border border-(--tag-amber-border) bg-(--tag-amber-bg) p-4 text-(--tag-amber-text)">
            <span className="lead-style font-medium">Modo de demonstração</span>
            <span className="caption-style">
              Os envios são simulados: o painel calcula o público e regista o resultado, mas nenhuma notificação, SMS ou e-mail sai para clientes ou prestadores.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              label="Canal"
              value={channel}
              options={CHANNEL_OPTIONS}
              onChange={(value) => {
                setChannel(value);
                setPage(1);
              }}
            />
            <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden className="size-3" />
              Nova comunicação
            </Button>
          </div>
          <AsyncState
            query={list}
            skeleton={<Skeleton className="h-60 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(data) => data.items.length === 0}
            empty={{ title: "Sem comunicações", description: "Não há comunicações com estes filtros." }}
          >
            {(data) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Comunicações" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Comunicação</TableHead>
                        <TableHead scope="col">Canal</TableHead>
                        <TableHead scope="col">Público</TableHead>
                        <TableHead scope="col">Quando</TableHead>
                        <TableHead scope="col" className="text-right">
                          Entregues
                        </TableHead>
                        <TableHead scope="col">Estado</TableHead>
                        <TableHead scope="col">
                          <span className="sr-only">Acções</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((broadcast) => {
                        const open = broadcast.status === "draft" || broadcast.status === "scheduled";
                        return (
                          <TableRow key={broadcast.id}>
                            <TableCell className="max-w-[180px]">
                              <span className="lead-style block truncate" title={broadcast.title}>
                                {broadcast.title}
                              </span>
                              <span className="caption-style text-subtle block truncate pt-0.5" title={broadcast.message}>
                                {broadcast.subject ? `${broadcast.subject} · ` : ""}
                                {broadcast.message}
                              </span>
                            </TableCell>
                            <TableCell className="text-soft">{BROADCAST_CHANNEL_LABELS[broadcast.channel]}</TableCell>
                            <TableCell className="text-soft max-w-[150px] min-w-[120px] whitespace-normal">
                              {broadcast.audience.kind === "clients" ? "Clientes" : "Prestadores"} · {BROADCAST_SEGMENT_LABELS[broadcast.audience.segment].toLowerCase()}
                              {broadcast.audience.zoneIds.length ? ` · ${broadcast.audience.zoneIds.map(zoneName).join(", ")}` : ""}
                            </TableCell>
                            <TableCell className="text-soft tabular-nums">
                              {broadcast.sentAt ? formatDateTimeNumeric(broadcast.sentAt) : broadcast.scheduledFor ? formatDateTimeNumeric(broadcast.scheduledFor) : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {broadcast.recipients ? (
                                <>
                                  {formatNumber(broadcast.delivered ?? 0)} de {formatNumber(broadcast.recipients)}
                                  <span className="caption-style text-subtle block pt-0.5">{formatPercent(((broadcast.delivered ?? 0) / broadcast.recipients) * 100)}</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <ToneBadge tone={BROADCAST_STATUS_TONES[broadcast.status]} label={BROADCAST_STATUS_LABELS[broadcast.status]} />
                            </TableCell>
                            <TableCell>
                              {open && (
                                <span className="flex flex-wrap justify-end gap-1.5">
                                  <Button variant="primary" size="sm" onClick={() => setAction({ broadcast, kind: "send" })} aria-label={`Simular envio de ${broadcast.title}`}>
                                    Enviar
                                  </Button>
                                  {broadcast.status === "draft" && (
                                    <Button variant="secondary" size="sm" onClick={() => setAction({ broadcast, kind: "schedule" })}>
                                      Agendar
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => setAction({ broadcast, kind: "cancel" })}>
                                    Cancelar
                                  </Button>
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das comunicações" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <BroadcastDialog key={creating ? "open" : "closed"} open={creating} onOpenChange={setCreating} zones={zones.data ?? []} />
      <ConfirmDialog
        open={action?.kind === "send"}
        onOpenChange={close}
        title="Simular envio"
        description="O painel calcula os destinatários e regista uma entrega simulada. Nenhuma mensagem real é enviada."
        confirmLabel="Simular envio"
        pending={mutate.isPending}
        error={mutationError(mutate.error)}
        onConfirm={() => (action ? mutate.mutateAsync({ id: action.broadcast.id, action: "send" }).then(() => setAction(null), () => undefined) : undefined)}
      />
      <ConfirmDialog
        open={action?.kind === "schedule"}
        onOpenChange={close}
        title="Agendar comunicação"
        confirmLabel="Agendar"
        canConfirm={Boolean(at)}
        pending={mutate.isPending}
        error={mutationError(mutate.error)}
        onConfirm={() => (action ? mutate.mutateAsync({ id: action.broadcast.id, action: "schedule", at: new Date(`${at}:00+01:00`).toISOString() }).then(() => setAction(null), () => undefined) : undefined)}
      >
        <Field label="Data e hora (Luanda)" htmlFor="broadcast-at" required>
          <Input id="broadcast-at" type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={action?.kind === "cancel"}
        onOpenChange={close}
        title="Cancelar comunicação"
        confirmLabel="Cancelar comunicação"
        tone="danger"
        requireReason
        pending={mutate.isPending}
        error={mutationError(mutate.error)}
        onConfirm={(reason) => (action ? mutate.mutateAsync({ id: action.broadcast.id, action: "cancel", reason }).then(() => setAction(null), () => undefined) : undefined)}
      />
    </section>
  );
}
