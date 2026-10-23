"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClock } from "@/hooks/admin/use-clock";
import { useAcknowledgeSos, useResolveSos, useSosAlerts } from "@/hooks/admin/use-support";
import { formatDateTimeNumeric, formatElapsed } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { SOS_STATUS_LABELS } from "@/lib/leva-ja/services";
import { cn } from "@/lib/utils";
import type { SosAlert } from "@/types/leva-ja";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";

export default function SosAlerts({ canOpenRequest }: { canOpenRequest: boolean }) {
  const query = useSosAlerts();
  const acknowledge = useAcknowledgeSos();
  const resolve = useResolveSos();
  const now = useClock();
  const [resolving, setResolving] = useState<SosAlert | null>(null);

  return (
    <section aria-labelledby="sos-title" className="flex flex-col gap-3">
      <h2 id="sos-title" className="eyebrow-style text-faint flex items-center gap-2 font-normal">
        <AlertIcon aria-hidden className="text-danger size-3.5" />
        Alertas SOS
      </h2>
      <AsyncState query={query} skeleton={<Skeleton className="h-32 rounded-xl" />} errorDescription={errorMessage}>
        {(alerts) => {
          const open = alerts.filter((alert) => alert.status !== "resolved");
          const resolved = alerts.filter((alert) => alert.status === "resolved").slice(0, 5);
          return (
            <div className="flex flex-col gap-3">
              {open.length === 0 ? (
                <p className="border-border bg-card caption-style text-subtle rounded-xl border p-4" role="status">
                  Sem alertas SOS abertos.
                </p>
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2" aria-live="polite">
                  {open.map((alert) => (
                    <li
                      key={alert.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border p-4",
                        alert.status === "open" ? "border-(--tag-red-border) bg-(--tag-red-bg)" : "border-(--tag-amber-border) bg-(--tag-amber-bg)",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="flex flex-col gap-1">
                          <span className="lead-style font-semibold">
                            {alert.raisedByName} · {alert.raisedBy === "client" ? "cliente" : "prestador"}
                          </span>
                          <span className="caption-style text-soft">
                            {alert.area} · pedido{" "}
                            {canOpenRequest ? (
                              <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${alert.requestId}`}>
                                {alert.requestCode}
                              </Button>
                            ) : (
                              alert.requestCode
                            )}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <Tag tone={alert.status === "open" ? "red" : "amber"} size="sm">
                            {SOS_STATUS_LABELS[alert.status]}
                          </Tag>
                          <span className="caption-style text-foreground font-medium tabular-nums">aberto há {formatElapsed(alert.createdAt, now)}</span>
                        </span>
                      </div>
                      <p className="p-style">«{alert.message}»</p>
                      {alert.handledBy && <span className="caption-style text-soft">Em acompanhamento por {alert.handledBy}</span>}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" href={`tel:${alert.phone.replace(/\s/g, "")}`}>
                          Ligar {alert.phone}
                        </Button>
                        {alert.status === "open" && (
                          <Button variant="primary" size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(alert.id)}>
                            Acompanhar
                          </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => setResolving(alert)}>
                          Resolver
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {resolved.length > 0 && (
                <details className="border-border bg-card rounded-xl border p-4">
                  <summary className="caption-style text-soft cursor-pointer">Resolvidos recentemente ({resolved.length})</summary>
                  <ul className="divide-border mt-3 flex flex-col divide-y">
                    {resolved.map((alert) => (
                      <li key={alert.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                        <span className="lead-style">
                          {alert.raisedByName} · {alert.requestCode}
                        </span>
                        <span className="caption-style text-subtle">
                          {formatDateTimeNumeric(alert.createdAt)} · {alert.resolution}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        }}
      </AsyncState>
      <ConfirmDialog
        open={resolving !== null}
        onOpenChange={(next) => {
          if (!next) {
            setResolving(null);
            resolve.reset();
          }
        }}
        title={resolving ? `Resolver o SOS de ${resolving.raisedByName}` : "Resolver SOS"}
        description="Confirme que a pessoa está em segurança e descreva o que foi feito."
        confirmLabel="Resolver alerta"
        requireReason
        reasonLabel="Resolução"
        reasonPlaceholder="Por exemplo: contactada a Polícia Nacional; o cliente confirmou que está em segurança."
        pending={resolve.isPending}
        error={mutationError(resolve.error)}
        onConfirm={(resolution) => (resolving ? resolve.mutateAsync({ id: resolving.id, resolution }).then(() => setResolving(null), () => undefined) : undefined)}
      />
    </section>
  );
}
