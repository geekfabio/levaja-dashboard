"use client";

import AsyncState from "@/components/_common/async-state";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { errorMessage } from "@/data/leva-ja";
import type { DocumentReviewItem } from "@/data/leva-ja";
import { useExpiringDocuments } from "@/hooks/admin/use-documents";
import { formatDateNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";

function daysUntil(day: string, today: string) {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

export default function ExpiringAlert({ today, onReview }: { today: string; onReview: (item: DocumentReviewItem) => void }) {
  const query = useExpiringDocuments();

  return (
    <SettingsPanel
      title="Documentos a expirar"
      description="Documentos verificados que deixam de ser válidos em breve. Quando expiram, o prestador deixa de receber pedidos."
      className="bg-card"
    >
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-24" />}
        errorDescription={errorMessage}
        isEmpty={(items) => items.length === 0}
        empty={{ title: "Nenhum documento a expirar", description: "Todos os documentos verificados são válidos por mais de 30 dias." }}
      >
        {(items) => (
          <ul className="divide-border flex flex-col divide-y" role="list">
            {items.map((item) => {
              const days = daysUntil(item.document.validUntil, today);
              return (
                <li key={item.document.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="lead-style truncate">
                      {item.document.title} ·{" "}
                      <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${item.providerId}`}>
                        {item.providerName}
                      </Button>
                    </span>
                    <span className="caption-style text-subtle">Válido até {formatDateNumeric(item.document.validUntil)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Tag tone={days <= 7 ? "red" : "amber"} size="sm">
                      {days === 0 ? "Expira hoje" : days === 1 ? "Expira amanhã" : `Expira em ${days} dias`}
                    </Tag>
                    <Button variant="secondary" size="sm" onClick={() => onReview(item)}>
                      Rever
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncState>
    </SettingsPanel>
  );
}
