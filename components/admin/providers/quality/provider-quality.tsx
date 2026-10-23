"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClock } from "@/hooks/admin/use-clock";
import { usePenalties, useProviderQuality, useRevokePenalty } from "@/hooks/admin/use-network";
import { formatDateNumeric, formatDateTimeNumeric, formatDecimal, formatKz, formatNumber, formatPercent } from "@/lib/format";
import { PENALTY_KIND_LABELS, QUALITY_FLAG_LABELS, isPenaltyActive } from "@/lib/leva-ja/quality";
import type { Penalty, ProviderAccount } from "@/types/leva-ja";
import PenaltyDialog from "./penalty-dialog";

export function scoreTone(score: number) {
  return score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
}

export default function ProviderQuality({ provider, canPenalize }: { provider: ProviderAccount; canPenalize: boolean }) {
  const now = useClock();
  const quality = useProviderQuality(provider.id);
  const penalties = usePenalties({ providerId: provider.id, pageSize: 50 });
  const revoke = useRevokePenalty();
  const [penalizing, setPenalizing] = useState(false);
  const [revoking, setRevoking] = useState<Penalty | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <AsyncState query={quality} skeleton={<Skeleton className="h-28 rounded-xl" />} errorDescription={errorMessage}>
        {(data) => (
          <div className="flex flex-col gap-3">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Pontuação de qualidade", value: `${formatNumber(data.score)} / 100` },
                { label: "Cancelamentos (30 dias)", value: `${formatNumber(data.cancelled)} · ${formatPercent(data.cancellationRate * 100)}` },
                { label: "Chegadas atrasadas", value: `${formatNumber(data.lateArrivals)} · ${formatPercent(data.lateRate * 100)}` },
                { label: "Chegada média", value: data.averageArrivalMinutes === null ? "—" : `${formatNumber(data.averageArrivalMinutes)} min` },
              ].map((item) => (
                <div key={item.label} className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
                  <dt className="caption-style text-subtle">{item.label}</dt>
                  <dd className="text-[20px] leading-none font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone={scoreTone(data.score)} label={data.score >= 80 ? "Qualidade boa" : data.score >= 60 ? "Qualidade a acompanhar" : "Qualidade baixa"} />
              {data.flags.map((flag) => (
                <Tag key={flag} tone="red" size="sm">
                  {QUALITY_FLAG_LABELS[flag]}
                </Tag>
              ))}
              <span className="caption-style text-subtle">
                {formatNumber(data.completed)} serviço(s) e {data.rating === null ? "sem avaliações" : `avaliação ${formatDecimal(data.rating, 1)} ★`} nos últimos 30 dias.
              </span>
            </div>
          </div>
        )}
      </AsyncState>

      <SettingsPanel
        title="Penalizações"
        className="bg-card"
        actions={
          canPenalize && provider.accountStatus !== "pending_approval" ? (
            <Button variant="secondary" size="sm" onClick={() => setPenalizing(true)}>
              Aplicar penalização
            </Button>
          ) : undefined
        }
      >
        <AsyncState
          query={penalties}
          skeleton={<Skeleton className="h-24" />}
          errorDescription={errorMessage}
          isEmpty={(data) => data.items.length === 0}
          empty={{ title: "Sem penalizações", description: "Este prestador nunca foi penalizado." }}
        >
          {(data) => (
            <ul className="divide-border flex flex-col divide-y">
              {data.items.map((penalty) => {
                const active = isPenaltyActive(penalty, now);
                return (
                  <li key={penalty.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="lead-style">
                        {PENALTY_KIND_LABELS[penalty.kind]}
                        {penalty.amount ? ` · ${formatKz(penalty.amount)}` : ""}
                        {penalty.until ? ` · até ${formatDateNumeric(penalty.until)}` : ""}
                      </span>
                      <span className="caption-style text-soft">{penalty.reason}</span>
                      <span className="caption-style text-subtle">
                        {penalty.createdBy} · {formatDateTimeNumeric(penalty.createdAt)}
                        {penalty.revokedAt ? ` · anulada por ${penalty.revokedBy}: ${penalty.revokeReason}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ToneBadge tone={penalty.revokedAt ? "neutral" : active ? "danger" : "info"} label={penalty.revokedAt ? "Anulada" : active ? "Activa" : "Cumprida"} />
                      {canPenalize && !penalty.revokedAt && (
                        <Button variant="ghost" size="sm" onClick={() => setRevoking(penalty)} aria-label={`Anular ${PENALTY_KIND_LABELS[penalty.kind].toLowerCase()} de ${formatDateNumeric(penalty.createdAt)}`}>
                          Anular
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </AsyncState>
      </SettingsPanel>

      <PenaltyDialog providerId={provider.id} providerName={provider.name} open={penalizing} onOpenChange={setPenalizing} />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null);
            revoke.reset();
          }
        }}
        title="Anular penalização"
        description="Uma multa anulada volta à carteira; uma suspensão anulada reactiva o prestador."
        confirmLabel="Anular"
        requireReason
        pending={revoke.isPending}
        error={mutationError(revoke.error)}
        onConfirm={(reason) => (revoking ? revoke.mutateAsync({ id: revoking.id, reason }).then(() => setRevoking(null), () => undefined) : undefined)}
      />
    </div>
  );
}
