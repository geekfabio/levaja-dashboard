"use client";

import AsyncState from "@/components/_common/async-state";
import Skeleton from "@/components/_ui/skeleton";
import { errorMessage } from "@/data/leva-ja";
import { useAuditLog } from "@/hooks/admin/use-audit";
import { AUDIT_ACTION_LABELS } from "@/lib/leva-ja/audit";
import { formatDateTimeNumeric } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";

export default function EntityAudit({ entityId }: { entityId: string }) {
  const query = useAuditLog({ entityId, pageSize: 20 });

  return (
    <AsyncState
      query={query}
      skeleton={<Skeleton className="h-32" />}
      errorDescription={errorMessage}
      isEmpty={(page) => page.items.length === 0}
      empty={{ title: "Sem registos na auditoria", description: "As acções da equipa sobre este registo aparecem aqui." }}
    >
      {(page) => (
        <ol className="divide-border flex flex-col divide-y">
          {page.items.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="lead-style font-medium">{AUDIT_ACTION_LABELS[entry.action]}</span>
                <span className="caption-style text-subtle tabular-nums">{formatDateTimeNumeric(entry.at)}</span>
              </div>
              <span className="caption-style text-soft">
                {entry.actorName} · {ROLE_LABELS[entry.actorRole]}
              </span>
              {entry.reason && <span className="caption-style text-soft">Motivo: {entry.reason}</span>}
              {entry.changes?.map((change) => (
                <span key={change.field} className="caption-style text-subtle">
                  {change.field}: {change.from} → {change.to}
                </span>
              ))}
            </li>
          ))}
        </ol>
      )}
    </AsyncState>
  );
}
