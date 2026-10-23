"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { DocumentStateBadge } from "@/components/admin/shared/provider-badges";
import ReviewDocumentDialog from "@/components/admin/documents/dialogs/review-document-dialog";
import { errorMessage } from "@/data/leva-ja";
import type { DocumentReviewItem } from "@/data/leva-ja";
import { useDocumentQueue } from "@/hooks/admin/use-documents";
import { formatDateNumeric, formatDateTimeNumeric } from "@/lib/format";
import { DOCUMENT_ICONS } from "@/lib/leva-ja/services";
import type { ProviderAccount } from "@/types/leva-ja";

export default function ProviderDocuments({ provider, canReview }: { provider: ProviderAccount; canReview: boolean }) {
  const [reviewing, setReviewing] = useState<DocumentReviewItem | null>(null);
  const query = useDocumentQueue({ q: provider.vehicle.plate, state: ["verified", "pending", "expired", "needs_update"], pageSize: 20 });

  return (
    <>
      <AsyncState
        query={query}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        }
        errorDescription={errorMessage}
      >
        {(page) => {
          const items = DOCUMENT_ICONS.map((icon) => page.items.find((item) => item.providerId === provider.id && item.document.icon === icon)).filter(
            (item): item is DocumentReviewItem => Boolean(item),
          );
          return (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.document.id} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="lead-style font-medium">{item.document.title}</span>
                    <DocumentStateBadge state={item.document.state} />
                  </div>
                  <dl className="caption-style text-soft flex flex-col gap-1">
                    <div className="flex justify-between gap-2">
                      <dt className="text-subtle">Válido até</dt>
                      <dd className="tabular-nums">{formatDateNumeric(item.document.validUntil)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-subtle">Enviado em</dt>
                      <dd className="tabular-nums">{formatDateTimeNumeric(item.submittedAt)}</dd>
                    </div>
                  </dl>
                  {canReview && (
                    <Button
                      variant={item.document.state === "verified" ? "secondary" : "primary"}
                      size="sm"
                      className="self-start"
                      onClick={() => setReviewing(item)}
                      aria-label={`Rever ${item.document.title}`}
                    >
                      {item.document.state === "verified" ? "Rever" : "Validar"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </AsyncState>
      <ReviewDocumentDialog item={reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </>
  );
}
