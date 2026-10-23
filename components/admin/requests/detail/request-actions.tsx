"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { FORCE_COMPLETE_STATUSES, canCancel, canDispute, canReassign } from "@/lib/leva-ja/status";
import type { AdminRole, ServiceRequest } from "@/types/leva-ja";
import CancelDialog from "../dialogs/cancel-dialog";
import DisputeDialog from "../dialogs/dispute-dialog";
import ForceCompleteDialog from "../dialogs/force-complete-dialog";
import ReassignDialog from "../dialogs/reassign-dialog";
import ResolveDisputeDialog from "@/components/admin/disputes/dialogs/resolve-dispute-dialog";
import { useRequestRefunds } from "@/hooks/admin/use-refunds";

type Dialog = "reassign" | "cancel" | "dispute" | "resolve" | "force" | null;

export function availableActions(request: ServiceRequest, role: AdminRole) {
  const operate = hasPermission(role, "requests.operate");
  const disputeOpen = Boolean(request.dispute && !request.dispute.resolvedAt);
  return {
    reassign: operate && canReassign(request.status),
    cancel: operate && canCancel(request.status),
    dispute: hasPermission(role, "requests.dispute") && canDispute(request.status) && !disputeOpen,
    resolve: hasPermission(role, "requests.dispute") && disputeOpen,
    force: operate && disputeOpen && FORCE_COMPLETE_STATUSES.includes(request.status),
  };
}

export default function RequestActions({ request, role }: { request: ServiceRequest; role: AdminRole }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const actions = availableActions(request, role);
  const canRefund = hasPermission(role, "refunds.request");
  const refunds = useRequestRefunds(request.id, actions.resolve && (canRefund || hasPermission(role, "refunds.decide")));
  const refundable = refunds.data?.refundable ?? 0;
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.reassign && (
          <Button variant="secondary" size="sm" onClick={() => setDialog("reassign")}>
            Reatribuir
          </Button>
        )}
        {actions.dispute && (
          <Button variant="secondary" size="sm" onClick={() => setDialog("dispute")}>
            Marcar disputa
          </Button>
        )}
        {actions.resolve && (
          <Button variant="primary" size="sm" onClick={() => setDialog("resolve")}>
            Resolver disputa
          </Button>
        )}
        {actions.force && (
          <Button variant="secondary" size="sm" onClick={() => setDialog("force")}>
            Forçar conclusão
          </Button>
        )}
        {actions.cancel && (
          <Button variant="danger" size="sm" onClick={() => setDialog("cancel")}>
            Cancelar
          </Button>
        )}
      </div>
      <ReassignDialog request={request} open={dialog === "reassign"} onOpenChange={close} />
      <CancelDialog request={request} open={dialog === "cancel"} onOpenChange={close} />
      <DisputeDialog request={request} open={dialog === "dispute"} onOpenChange={close} />
      <ForceCompleteDialog request={request} open={dialog === "force"} onOpenChange={close} />
      {actions.resolve && (
        <ResolveDisputeDialog key={`${request.id}-${refundable}`} request={request} refundable={refundable} canRefund={canRefund} open={dialog === "resolve"} onOpenChange={close} />
      )}
    </>
  );
}
