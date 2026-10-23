"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import { errorMessage } from "@/data/leva-ja";
import { useRequestRefunds } from "@/hooks/admin/use-refunds";
import { useRequest } from "@/hooks/admin/use-requests";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import type { Dispute, ServiceRequest } from "@/types/leva-ja";
import ResolveDisputeDialog from "../dialogs/resolve-dispute-dialog";
import DisputePanel from "./dispute-panel";

type Props = { requestId: string | null; onClose: () => void; canEdit: boolean; canRefund: boolean; canSeeRefunds: boolean };

function SheetBody({ request, canEdit, canRefund, canSeeRefunds }: { request: ServiceRequest & { dispute: Dispute }; canEdit: boolean; canRefund: boolean; canSeeRefunds: boolean }) {
  const refunds = useRequestRefunds(request.id, canSeeRefunds);
  const [resolving, setResolving] = useState(false);
  const refundable = refunds.data?.refundable ?? 0;
  const open = !request.dispute.resolvedAt;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6">
          <DisputePanel request={request} refunds={refunds.data?.refunds ?? []} refundable={refunds.data ? refundable : null} canEdit={canEdit} />
        </div>
      </ScrollArea>
      <div className="border-line-strong flex flex-wrap items-center justify-between gap-2 border-t p-4">
        <Button variant="ghost" size="md" href={`${SECTION_ROUTES.requests}/${request.id}`}>
          Abrir pedido
        </Button>
        {open && canEdit && (
          <Button variant="primary" size="md" onClick={() => setResolving(true)} disabled={canSeeRefunds && refunds.isPending}>
            Resolver disputa
          </Button>
        )}
      </div>
      <ResolveDisputeDialog
        key={`${request.id}-${refundable}`}
        request={request}
        refundable={refundable}
        canRefund={canRefund}
        open={resolving}
        onOpenChange={setResolving}
      />
    </div>
  );
}

export default function DisputeSheet({ requestId, onClose, canEdit, canRefund, canSeeRefunds }: Props) {
  const query = useRequest(requestId);
  const request = query.data;

  return (
    <Sheet open={requestId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{request ? `Disputa · ${request.code} · ${SERVICE_SHORT_LABELS[request.kind]}` : "Disputa"}</SheetTitle>
            <SheetDescription className="sr-only">Detalhe da disputa, notas internas, reembolsos e resolução.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) =>
            data.dispute ? (
              <SheetBody request={{ ...data, dispute: data.dispute }} canEdit={canEdit} canRefund={canRefund} canSeeRefunds={canSeeRefunds} />
            ) : (
              <p className="caption-style text-subtle p-6">Este pedido não tem disputa.</p>
            )
          }
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
