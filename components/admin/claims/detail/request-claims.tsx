"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useRequestClaims } from "@/hooks/admin/use-operations";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { CLAIMABLE_STATUSES, CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from "@/lib/leva-ja/scheduling";
import type { ServiceRequest } from "@/types/leva-ja";
import ReportClaimDialog from "../dialogs/report-claim-dialog";

export default function RequestClaims({ request, canOpenClaims }: { request: ServiceRequest; canOpenClaims: boolean }) {
  const query = useRequestClaims(request.id, true);
  const [open, setOpen] = useState(false);
  const claimable = CLAIMABLE_STATUSES.includes(request.status);

  return (
    <AsyncState query={query} skeleton={<Skeleton className="h-20" />} errorDescription={errorMessage}>
      {(claims) => (
        <div className="flex flex-col gap-3">
          {claims.length ? (
            <ul className="divide-border flex flex-col divide-y">
              {claims.map((claim) => (
                <li key={claim.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="lead-style tabular-nums">
                      {claim.code} · {formatKz(claim.estimatedAmount)}
                    </span>
                    <span className="caption-style text-subtle">
                      {CLAIM_KIND_LABELS[claim.kind]} · {formatDateTimeNumeric(claim.reportedAt)}
                    </span>
                  </span>
                  <ToneBadge tone={CLAIM_STATUS_TONES[claim.status]} label={CLAIM_STATUS_LABELS[claim.status]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption-style text-subtle">{claimable ? "Sem sinistros neste pedido." : "Só é possível participar um sinistro depois da recolha."}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {claimable && (
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Participar sinistro
              </Button>
            )}
            {canOpenClaims && claims.length > 0 && (
              <Button variant="ghost" size="sm" href={SECTION_ROUTES.claims}>
                Ver sinistros
              </Button>
            )}
          </div>
          <ReportClaimDialog request={request} open={open} onOpenChange={setOpen} />
        </div>
      )}
    </AsyncState>
  );
}
