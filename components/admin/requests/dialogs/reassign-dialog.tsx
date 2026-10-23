"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import { ErrorState } from "@/components/_common/async-state";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useReassignCandidates, useReassignRequest } from "@/hooks/admin/use-requests";
import { formatDecimal, formatKm } from "@/lib/format";
import { ELIGIBILITY_ISSUE_LABELS } from "@/lib/leva-ja/eligibility";
import { cn } from "@/lib/utils";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void };

export default function ReassignDialog({ request, open, onOpenChange }: Props) {
  const candidates = useReassignCandidates(request.id, open);
  const mutation = useReassignRequest();
  const [selected, setSelected] = useState<string | null>(null);

  function change(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSelected(null);
      mutation.reset();
    }
  }

  const eligible = (candidates.data ?? []).filter((candidate) => candidate.issues.length === 0);
  const blocked = (candidates.data ?? []).filter((candidate) => candidate.issues.length > 0).slice(0, 6);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={change}
      title={`Reatribuir o pedido ${request.code}`}
      description={`Actual: ${request.provider?.name ?? "sem prestador"}. O pedido volta a «Prestador atribuído» com o novo prestador.`}
      confirmLabel="Reatribuir"
      requireReason
      reasonLabel="Motivo da reatribuição"
      canConfirm={selected !== null}
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) =>
        selected ? mutation.mutateAsync({ id: request.id, providerId: selected, reason }).then(() => change(false), () => undefined) : undefined
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="caption-style text-soft mb-2">Novo prestador</legend>
        {candidates.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : candidates.isError ? (
          <ErrorState className="py-4" description={errorMessage(candidates.error)} onRetry={() => candidates.refetch()} retrying={candidates.isFetching} />
        ) : (
          <>
            {eligible.length === 0 && (
              <p className="caption-style text-subtle">Não há prestadores elegíveis livres neste momento.</p>
            )}
            <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
              {eligible.map((candidate) => (
                <li key={candidate.provider.id}>
                  <label
                    className={cn(
                      "border-border has-checked:border-primary has-focus-visible:ring-ring/60 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 has-focus-visible:ring-2",
                    )}
                  >
                    <input
                      type="radio"
                      name="reassign-provider"
                      value={candidate.provider.id}
                      checked={selected === candidate.provider.id}
                      onChange={() => setSelected(candidate.provider.id)}
                      className="accent-primary size-4 shrink-0"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="lead-style truncate">{candidate.provider.name}</span>
                      <span className="caption-style text-subtle truncate">
                        {candidate.provider.vehicle.brand} {candidate.provider.vehicle.model} · {candidate.provider.vehicle.plate}
                      </span>
                    </span>
                    <span className="caption-style text-soft flex shrink-0 flex-col items-end gap-1 tabular-nums">
                      <span>{formatKm(candidate.distanceKm)}</span>
                      <span>{formatDecimal(candidate.provider.rating, 1)} ★</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {blocked.length > 0 && (
              <details className="caption-style text-subtle">
                <summary className="cursor-pointer">Prestadores não elegíveis ({blocked.length})</summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {blocked.map((candidate) => (
                    <li key={candidate.provider.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-soft">{candidate.provider.name}</span>
                      {candidate.issues.map((issue) => (
                        <Tag key={issue} tone="neutral" size="sm">
                          {ELIGIBILITY_ISSUE_LABELS[issue]}
                        </Tag>
                      ))}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </fieldset>
    </ConfirmDialog>
  );
}
