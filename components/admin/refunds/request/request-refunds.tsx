"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useRequestRefunds } from "@/hooks/admin/use-refunds";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { REFUND_SOURCE_LABELS, REFUND_STATUS_LABELS, REFUND_STATUS_TONES, isRefundable } from "@/lib/leva-ja/refunds";
import type { ServiceRequest } from "@/types/leva-ja";
import RequestRefundDialog from "../dialogs/request-refund-dialog";

export default function RequestRefunds({ request, canRequest, canOpenRefunds }: { request: ServiceRequest; canRequest: boolean; canOpenRefunds: boolean }) {
  const query = useRequestRefunds(request.id);
  const [open, setOpen] = useState(false);

  return (
    <AsyncState query={query} skeleton={<Skeleton className="h-24" />} errorDescription={errorMessage}>
      {(data) => (
        <div className="flex flex-col gap-3">
          {data.refunds.length ? (
            <ul className="divide-border flex flex-col divide-y">
              {data.refunds.map((refund) => (
                <li key={refund.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="lead-style tabular-nums">
                      {refund.code} · {formatKz(refund.amount)}
                    </span>
                    <span className="caption-style text-subtle">
                      {REFUND_SOURCE_LABELS[refund.source]} · {refund.requestedBy} · {formatDateTimeNumeric(refund.requestedAt)}
                    </span>
                    <span className="caption-style text-soft">{refund.reason}</span>
                  </span>
                  <ToneBadge tone={REFUND_STATUS_TONES[refund.status]} label={REFUND_STATUS_LABELS[refund.status]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption-style text-subtle">Sem reembolsos neste pedido.</p>
          )}
          <p className="caption-style text-soft tabular-nums">
            {isRefundable(request) ? `Por reembolsar: ${formatKz(data.refundable)} de ${formatKz(request.price.total)}` : "Só pedidos pagos podem ser reembolsados."}
          </p>
          <div className="flex flex-wrap gap-2">
            {canRequest && data.refundable > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Pedir reembolso
              </Button>
            )}
            {canOpenRefunds && data.refunds.length > 0 && (
              <Button variant="ghost" size="sm" href={SECTION_ROUTES.refunds}>
                Ver reembolsos
              </Button>
            )}
          </div>
          <RequestRefundDialog key={`${request.id}-${data.refundable}`} request={request} refundable={data.refundable} open={open} onOpenChange={setOpen} />
        </div>
      )}
    </AsyncState>
  );
}
