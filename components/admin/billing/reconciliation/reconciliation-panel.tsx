"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useSettlements } from "@/hooks/admin/use-billing";
import { formatDateNumeric, formatKz, formatNumber, shiftDay } from "@/lib/format";
import { SETTLEMENT_METHOD_LABELS, SETTLEMENT_STATUS_LABELS, SETTLEMENT_STATUS_TONES } from "@/lib/leva-ja/billing";
import { cn } from "@/lib/utils";
import type { Settlement, SettlementMethod, SettlementStatus } from "@/types/leva-ja";
import SettlementDialog from "./settlement-dialog";
import type { SettlementAction } from "./settlement-dialog";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
];
const METHOD_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(SETTLEMENT_METHOD_LABELS) as SettlementMethod[]).map((method) => ({ value: method, label: SETTLEMENT_METHOD_LABELS[method] }))];
const STATUS_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(SETTLEMENT_STATUS_LABELS) as SettlementStatus[]).map((status) => ({ value: status, label: SETTLEMENT_STATUS_LABELS[status] }))];

export default function ReconciliationPanel({ today, canManage }: { today: string; canManage: boolean }) {
  const [period, setPeriod] = useState("14");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [active, setActive] = useState<{ settlement: Settlement; action: SettlementAction } | null>(null);
  const report = useSettlements({
    from: shiftDay(today, -(Number(period) - 1)),
    to: today,
    method: method === "all" ? undefined : [method as SettlementMethod],
    status: status === "all" ? undefined : [status as SettlementStatus],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu label="Período" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
        <FilterMenu label="Canal" value={method} options={METHOD_OPTIONS} onChange={setMethod} />
        <FilterMenu label="Estado" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </div>
      <AsyncState
        query={report}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem movimentos", description: "Não há pagamentos por cartão ou Multicaixa neste período." }}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <dl className="caption-style text-soft flex flex-wrap gap-x-6 gap-y-1 tabular-nums" aria-label="Totais da reconciliação">
              <div className="flex gap-1.5">
                <dt>Esperado</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.expected)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Recebido</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.received)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Diferença nos dias recebidos</dt>
                <dd className={cn("font-medium", data.totals.difference === 0 ? "text-foreground" : "text-danger")}>{formatKz(data.totals.difference)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Por tratar</dt>
                <dd className="text-foreground font-medium">{formatNumber(data.totals.open)}</dd>
              </div>
            </dl>
            <div className="border-border bg-card overflow-x-auto rounded-xl border">
              <Table aria-label="Reconciliação de recebimentos" className={report.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Dia</TableHead>
                    <TableHead scope="col">Canal</TableHead>
                    <TableHead scope="col" className="text-right">
                      Pagamentos
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Esperado
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Recebido
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Diferença
                    </TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Referência</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Acções</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((settlement) => {
                    const difference = settlement.received === null ? null : settlement.received - settlement.expected;
                    return (
                      <TableRow key={settlement.id}>
                        <TableCell className="tabular-nums">{formatDateNumeric(settlement.day)}</TableCell>
                        <TableCell className="text-soft">{SETTLEMENT_METHOD_LABELS[settlement.method]}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(settlement.count)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(settlement.expected)}</TableCell>
                        <TableCell className="text-right tabular-nums">{settlement.received === null ? "—" : formatKz(settlement.received)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", difference ? "text-danger" : "text-soft")}>{difference === null ? "—" : formatKz(difference)}</TableCell>
                        <TableCell>
                          <ToneBadge tone={SETTLEMENT_STATUS_TONES[settlement.status]} label={SETTLEMENT_STATUS_LABELS[settlement.status]} />
                        </TableCell>
                        <TableCell className="text-soft caption-style max-w-[160px] truncate" title={settlement.resolution ?? settlement.reference}>
                          {settlement.resolution ?? settlement.reference ?? "—"}
                        </TableCell>
                        <TableCell>
                          {canManage && settlement.status === "pending" && settlement.day < today && (
                            <Button variant="primary" size="sm" onClick={() => setActive({ settlement, action: "register" })} aria-label={`Registar recebimento de ${formatDateNumeric(settlement.day)}, ${SETTLEMENT_METHOD_LABELS[settlement.method]}`}>
                              Registar
                            </Button>
                          )}
                          {canManage && settlement.status === "mismatch" && (
                            <Button variant="secondary" size="sm" onClick={() => setActive({ settlement, action: "resolve" })}>
                              Justificar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="caption-style text-subtle">
              O esperado soma os pagamentos por cartão e Multicaixa dos pedidos pagos em cada dia. O dia de hoje fica por receber até o banco enviar o extracto.
            </p>
          </div>
        )}
      </AsyncState>
      {active && <SettlementDialog key={`${active.settlement.id}-${active.action}`} settlement={active.settlement} action={active.action} onClose={() => setActive(null)} />}
    </div>
  );
}
