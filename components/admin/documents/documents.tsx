"use client";

import { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import FilterMenu from "@/components/_common/filter-menu";
import SettingsPanel from "@/components/settings/settings-panel";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import type { DocumentReviewItem } from "@/data/leva-ja";
import { useDocumentQueue } from "@/hooks/admin/use-documents";
import { useClock } from "@/hooks/admin/use-clock";
import { luandaDay } from "@/lib/format";
import type { DocumentState } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import ExpiringAlert from "./expiring/expiring-alert";
import DocumentsQueue from "./table/documents-queue";
import ReviewDocumentDialog from "./dialogs/review-document-dialog";

const STATE_OPTIONS = [
  { value: "all", label: "Por validar e a actualizar" },
  { value: "pending", label: "Por validar" },
  { value: "needs_update", label: "Requer actualização" },
];

const PAGE_SIZE = 10;

export default function Documents() {
  const now = useClock();
  const [state, setState] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<DocumentReviewItem | null>(null);
  const queue = useDocumentQueue({
    state: state === "all" ? undefined : [state as DocumentState],
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Validação de documentos" count={queue.data?.total} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-5">
          <ExpiringAlert today={luandaDay(new Date(now))} onReview={setReviewing} />
          <SettingsPanel
            title="Fila de validação"
            description="Os prestadores só recebem pedidos com os quatro documentos verificados: carta de condução, BI, documento da viatura e seguro."
            className="bg-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
                <span className="sr-only">Pesquisar por prestador, matrícula ou documento</span>
                <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
                <Input
                  type="search"
                  value={query}
                  placeholder="Prestador, matrícula ou documento"
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-[30px] pl-8 text-[13px]"
                />
              </label>
              <FilterMenu
                label="Estado"
                value={state}
                options={STATE_OPTIONS}
                onChange={(value) => {
                  setState(value);
                  setPage(1);
                }}
              />
            </div>
            <DocumentsQueue query={queue} now={now} onReview={setReviewing} onPageChange={setPage} />
          </SettingsPanel>
        </div>
      </ScrollArea>
      <ReviewDocumentDialog item={reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </section>
  );
}
