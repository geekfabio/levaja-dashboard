"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import Stars from "@/components/admin/shared/stars";
import { errorMessage } from "@/data/leva-ja";
import type { LowRatingItem } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useLowRatings, useMarkReviewHandled } from "@/hooks/admin/use-support";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";

const FILTERS = [
  { value: "pending", label: "Por rever" },
  { value: "handled", label: "Revistas" },
  { value: "all", label: "Todas" },
];

export default function LowRatingsPanel({ canOpenRequest, canOpenProvider }: { canOpenRequest: boolean; canOpenProvider: boolean }) {
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [handling, setHandling] = useState<LowRatingItem | null>(null);
  const query = useLowRatings({ handled: filter === "all" ? undefined : filter === "handled", page, pageSize: 10 });
  const mark = useMarkReviewHandled();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caption-style text-subtle">Avaliações de 2 estrelas ou menos. Reveja com o prestador e registe o que foi feito.</p>
        <FilterMenu
          label="Mostrar"
          value={filter}
          options={FILTERS}
          align="end"
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-60 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: filter === "pending" ? "Nada por rever" : "Sem avaliações", description: "Não há avaliações baixas com este filtro." }}
      >
        {(data) => (
          <div className="flex flex-col gap-2">
            <ul className="grid gap-3 lg:grid-cols-2">
              {data.items.map((item) => (
                <li key={item.id} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="flex flex-col gap-1">
                      <span className="lead-style font-medium">{item.authorName}</span>
                      <span className="caption-style text-soft">
                        {canOpenRequest ? (
                          <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${item.requestId}`}>
                            {item.requestCode}
                          </Button>
                        ) : (
                          item.requestCode
                        )}{" "}
                        · prestador{" "}
                        {item.providerId && canOpenProvider ? (
                          <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${item.providerId}`}>
                            {item.providerName}
                          </Button>
                        ) : (
                          (item.providerName ?? "—")
                        )}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Stars rating={item.rating} />
                      <span className="caption-style text-subtle tabular-nums">{formatDateTimeNumeric(item.at)}</span>
                    </span>
                  </div>
                  {item.comment ? <p className="p-style">«{item.comment}»</p> : <p className="caption-style text-subtle">Sem comentário.</p>}
                  {item.handled ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Tag tone="green" size="sm">
                        Revista
                      </Tag>
                      <span className="caption-style text-soft">{item.handledNote}</span>
                    </span>
                  ) : (
                    <Button variant="secondary" size="sm" className="self-start" onClick={() => setHandling(item)}>
                      Marcar como revista
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das avaliações" className="px-0" />
          </div>
        )}
      </AsyncState>
      <ConfirmDialog
        open={handling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHandling(null);
            mark.reset();
          }
        }}
        title="Marcar avaliação como revista"
        description={handling ? `${handling.rating} estrela(s) em ${handling.requestCode}${handling.comment ? `: «${handling.comment}»` : "."}` : undefined}
        confirmLabel="Marcar como revista"
        requireReason
        reasonLabel="Nota da revisão"
        reasonPlaceholder="Por exemplo: prestador contactado e advertido."
        pending={mark.isPending}
        error={mutationError(mark.error)}
        onConfirm={(note) => (handling ? mark.mutateAsync({ id: handling.id, note }).then(() => setHandling(null), () => undefined) : undefined)}
      />
    </div>
  );
}
