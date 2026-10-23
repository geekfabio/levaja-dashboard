"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateBatch, usePayoutBatches, useWithdrawals } from "@/hooks/admin/use-finance";
import { formatDateTimeNumeric, formatKz, formatNumber } from "@/lib/format";
import { BATCH_STATUS_LABELS, BATCH_STATUS_TONES } from "@/lib/leva-ja/billing";
import type { PayoutBatch } from "@/types/leva-ja";
import BatchDialog from "./batch-dialogs";
import type { BatchAction } from "./batch-dialogs";

function OpenWithdrawals({ openBatchIds, canManage }: { openBatchIds: Set<string>; canManage: boolean }) {
  const approved = useWithdrawals({ status: ["approved"], pageSize: 100 });
  const create = useCreateBatch();
  const [selected, setSelected] = useState<string[]>([]);
  const items = (approved.data?.items ?? []).filter((withdrawal) => !withdrawal.batchId || !openBatchIds.has(withdrawal.batchId));
  const chosen = items.filter((withdrawal) => selected.includes(withdrawal.id));
  const total = chosen.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  const allChecked = items.length > 0 && chosen.length === items.length;

  return (
    <SettingsPanel title="Levantamentos aprovados fora de lote" description="Escolha os levantamentos a juntar num ficheiro de transferências." className="bg-card">
      <AsyncState
        query={approved}
        skeleton={<Skeleton className="h-32" />}
        errorDescription={errorMessage}
        isEmpty={() => items.length === 0}
        empty={{ title: "Nada para pagar", description: "Não há levantamentos aprovados à espera de lote." }}
      >
        {() => (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <Table aria-label="Levantamentos aprovados fora de lote">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="w-8">
                      {canManage && (
                        <Checkbox
                          aria-label="Escolher todos"
                          checked={allChecked}
                          onCheckedChange={(next) => setSelected(next === true ? items.map((withdrawal) => withdrawal.id) : [])}
                        />
                      )}
                    </TableHead>
                    <TableHead scope="col">Prestador</TableHead>
                    <TableHead scope="col">IBAN</TableHead>
                    <TableHead scope="col">Aprovado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        {canManage && (
                          <Checkbox
                            aria-label={`Escolher levantamento de ${withdrawal.providerName}`}
                            checked={selected.includes(withdrawal.id)}
                            onCheckedChange={(next) =>
                              setSelected((current) => (next === true ? [...current, withdrawal.id] : current.filter((id) => id !== withdrawal.id)))
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>{withdrawal.providerName}</TableCell>
                      <TableCell className="text-soft caption-style tabular-nums">{withdrawal.iban}</TableCell>
                      <TableCell className="text-soft tabular-nums">{withdrawal.decidedAt ? formatDateTimeNumeric(withdrawal.decidedAt) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatKz(withdrawal.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {create.error ? (
                  <span role="alert" className="caption-style text-danger">
                    {mutationError(create.error)}
                  </span>
                ) : null}
                <span className="caption-style text-soft tabular-nums">
                  {formatNumber(chosen.length)} escolhido(s) · {formatKz(total)}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={chosen.length === 0 || create.isPending}
                  onClick={() => create.mutateAsync(chosen.map((withdrawal) => withdrawal.id)).then(() => setSelected([]), () => undefined)}
                >
                  {create.isPending ? "A criar…" : "Criar lote"}
                </Button>
              </div>
            )}
          </div>
        )}
      </AsyncState>
    </SettingsPanel>
  );
}

export default function BatchesPanel({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const batches = usePayoutBatches({ page, pageSize: 10 });
  const open = usePayoutBatches({ status: ["draft", "sent"], pageSize: 100 });
  const [active, setActive] = useState<{ batch: PayoutBatch; action: BatchAction } | null>(null);
  const openBatchIds = new Set((open.data?.items ?? []).map((batch) => batch.id));

  return (
    <div className="flex flex-col gap-5">
      <OpenWithdrawals openBatchIds={openBatchIds} canManage={canManage} />
      <AsyncState
        query={batches}
        skeleton={<Skeleton className="h-60 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem lotes", description: "Ainda não foi criado nenhum lote de pagamento." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Lotes de pagamento" className={batches.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Lote</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Levantamentos
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Total
                    </TableHead>
                    <TableHead scope="col">Criado</TableHead>
                    <TableHead scope="col">Banco</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Acções</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium tabular-nums">{batch.code}</TableCell>
                      <TableCell>
                        <ToneBadge tone={BATCH_STATUS_TONES[batch.status]} label={BATCH_STATUS_LABELS[batch.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(batch.count)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatKz(batch.total)}</TableCell>
                      <TableCell className="text-soft tabular-nums">
                        <span className="flex flex-col gap-0.5">
                          {formatDateTimeNumeric(batch.createdAt)}
                          <span className="caption-style text-subtle">{batch.createdBy}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-soft caption-style max-w-[220px] truncate" title={batch.cancelReason ?? batch.bankReference}>
                        {batch.status === "paid"
                          ? `Ref. ${batch.bankReference}`
                          : batch.status === "sent" && batch.sentAt
                            ? `Enviado a ${formatDateTimeNumeric(batch.sentAt)}`
                            : batch.status === "cancelled"
                              ? batch.cancelReason
                              : "—"}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <span className="flex justify-end gap-1.5">
                            {batch.status === "draft" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ batch, action: "send" })}>
                                Enviar ao banco
                              </Button>
                            )}
                            {batch.status === "sent" && (
                              <Button variant="primary" size="sm" onClick={() => setActive({ batch, action: "paid" })}>
                                Marcar como pago
                              </Button>
                            )}
                            {(batch.status === "draft" || batch.status === "sent") && (
                              <Button variant="ghost" size="sm" onClick={() => setActive({ batch, action: "cancel" })}>
                                Cancelar
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
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação dos lotes" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
      {active && <BatchDialog key={`${active.batch.id}-${active.action}`} batch={active.batch} action={active.action} onClose={() => setActive(null)} />}
    </div>
  );
}
