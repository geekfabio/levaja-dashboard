"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import DetailList from "@/components/admin/shared/detail-list";
import EntityAudit from "@/components/admin/shared/entity-audit";
import RequestHistory from "@/components/admin/shared/request-history";
import { ProviderStatusBadge, VerificationBadge } from "@/components/admin/shared/provider-badges";
import AsyncState, { ErrorState } from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { errorMessage, isRepositoryError } from "@/data/leva-ja";
import { useProvider, useProviderRequests, useProviderReviews } from "@/hooks/admin/use-providers";
import { useZones } from "@/hooks/admin/use-zones";
import { useClock } from "@/hooks/admin/use-clock";
import { formatDateNumeric, formatDecimal, formatKz, formatNumber, luandaDay } from "@/lib/format";
import { eligibilityIssues, ELIGIBILITY_ISSUE_LABELS } from "@/lib/leva-ja/eligibility";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import ProviderStatusDialog, { type ProviderStatusAction } from "../dialogs/provider-status-dialog";
import ProviderCoverage from "./provider-coverage";
import ProviderDocuments from "./provider-documents";
import ProviderWallet from "./provider-wallet";
import ReviewList from "@/components/admin/shared/review-list";

const TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "documentos", label: "Documentos" },
  { value: "cobertura", label: "Cobertura" },
  { value: "carteira", label: "Carteira" },
  { value: "avaliacoes", label: "Avaliações" },
  { value: "historico", label: "Histórico" },
];

function ProviderReviews({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useProviderReviews(id, { page, pageSize: 10 });
  return (
    <AsyncState
      query={query}
      skeleton={<Skeleton className="h-48" />}
      errorDescription={errorMessage}
      isEmpty={(data) => data.items.length === 0}
      empty={{ title: "Sem avaliações", description: "Ainda nenhum cliente avaliou este prestador." }}
    >
      {(data) => (
        <div className="flex flex-col gap-2">
          <ReviewList reviews={data.items} />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das avaliações" className="px-0" />
        </div>
      )}
    </AsyncState>
  );
}

function ProviderHistory({ id, canOpen, canAudit }: { id: string; canOpen: boolean; canAudit: boolean }) {
  const [page, setPage] = useState(1);
  const query = useProviderRequests(id, { page, pageSize: 10 });
  return (
    <div className="flex flex-col gap-4">
      <RequestHistory query={query} counterpart="client" onPageChange={setPage} canOpen={canOpen} />
      {canAudit && (
        <SettingsPanel title="Registo de auditoria" className="bg-card">
          <EntityAudit entityId={id} />
        </SettingsPanel>
      )}
    </div>
  );
}

export default function ProviderDetail({ id }: { id: string }) {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const query = useProvider(id);
  const zones = useZones();
  const now = useClock();
  const [tab, setTab] = useState("resumo");
  const [action, setAction] = useState<ProviderStatusAction | null>(null);
  const provider = query.data;
  if (!role) return null;

  const today = luandaDay(new Date(now));
  const canManage = hasPermission(role, "providers.manage");
  const back = (
    <Button variant="ghost" size="sm" href={SECTION_ROUTES.providers} className="self-start">
      <ChevronIcon aria-hidden className="size-3 rotate-90" />
      Prestadores
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title={provider?.name ?? "Prestador"} badge={provider ? <ProviderStatusBadge provider={provider} /> : undefined} />
      <ScrollArea className="min-h-0 flex-1">
        {query.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-4 p-5">
            <span className="sr-only">A carregar o prestador…</span>
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : query.isError || !provider ? (
          <div className="flex flex-col gap-2 p-5">
            {back}
            <ErrorState
              title={isRepositoryError(query.error) && query.error.code === "not_found" ? "Prestador não encontrado" : undefined}
              description={errorMessage(query.error)}
              onRetry={isRepositoryError(query.error) && query.error.code === "not_found" ? undefined : () => query.refetch()}
              retrying={query.isFetching}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {back}
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {provider.accountStatus === "pending_approval" && (
                    <>
                      {!provider.verified && (
                        <span className="caption-style text-subtle">Valide os documentos exigidos para poder aprovar.</span>
                      )}
                      <Button variant="primary" size="sm" disabled={!provider.verified} onClick={() => setAction("approve")}>
                        Aprovar
                      </Button>
                    </>
                  )}
                  {provider.accountStatus === "active" && (
                    <Button variant="danger" size="sm" onClick={() => setAction("suspend")}>
                      Suspender
                    </Button>
                  )}
                  {provider.accountStatus === "suspended" && (
                    <Button variant="primary" size="sm" onClick={() => setAction("reactivate")}>
                      Reactivar
                    </Button>
                  )}
                </div>
              )}
            </div>

            {provider.accountStatus === "suspended" && provider.suspensionReason && (
              <div role="status" className="flex flex-col gap-1 rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg) p-4 text-(--tag-red-text)">
                <span className="lead-style font-medium">Conta suspensa</span>
                <span className="caption-style">{provider.suspensionReason}</span>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label="Secções do prestador" className="border-border overflow-x-auto border-b *:whitespace-nowrap">
                {TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="resumo" className="flex flex-col gap-4 pt-4">
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Avaliação", value: `${formatDecimal(provider.rating, 1)} ★ (${formatNumber(provider.reviewsCount)})` },
                    { label: "Serviços concluídos", value: formatNumber(provider.completedCount) },
                    { label: "Ganhos totais", value: formatKz(provider.totalEarnings) },
                    { label: "Saldo", value: formatKz(provider.balance) },
                  ].map((item) => (
                    <div key={item.label} className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
                      <dt className="caption-style text-subtle">{item.label}</dt>
                      <dd className="text-[20px] leading-none font-semibold tabular-nums">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-4 lg:grid-cols-2">
                  <SettingsPanel title="Contacto e conta" className="bg-card">
                    <DetailList
                      items={[
                        { label: "Telefone", value: <a href={`tel:${provider.phone.replace(/\s/g, "")}`} className="hover:underline">{provider.phone}</a> },
                        { label: "E-mail", value: provider.email },
                        { label: "Na plataforma desde", value: formatDateNumeric(provider.joinedAt) },
                        { label: "Verificação", value: <VerificationBadge verified={provider.verified} /> },
                      ]}
                    />
                  </SettingsPanel>
                  <SettingsPanel title="Viatura" className="bg-card">
                    <DetailList
                      items={[
                        { label: "Viatura", value: `${provider.vehicle.brand} ${provider.vehicle.model} (${provider.vehicle.year})` },
                        { label: "Matrícula", value: provider.vehicle.plate },
                        { label: "Categoria", value: provider.vehicle.categoryLabel },
                        { label: "Cor e capacidade", value: `${provider.vehicle.color} · ${formatNumber(provider.vehicle.capacityKg)} kg` },
                      ]}
                    />
                  </SettingsPanel>
                </div>
                <SettingsPanel title="Elegibilidade para receber pedidos" className="bg-card">
                  <ul className="flex flex-col gap-2">
                    {provider.services.map((service) => {
                      const issues = eligibilityIssues(provider, { kind: service, zoneId: provider.zoneIds[0] }, today, []).filter((issue) => issue !== "zone");
                      if (!provider.verified) issues.push("documents");
                      return (
                        <li key={service} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="lead-style">{SERVICE_SHORT_LABELS[service]}</span>
                          <span className="caption-style text-soft">
                            {issues.length === 0 ? "Elegível" : issues.map((issue) => ELIGIBILITY_ISSUE_LABELS[issue]).join(" · ")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </SettingsPanel>
              </TabsContent>
              <TabsContent value="documentos" className="pt-4">
                <ProviderDocuments provider={provider} canReview={hasPermission(role, "documents.review")} />
              </TabsContent>
              <TabsContent value="cobertura" className="pt-4">
                <ProviderCoverage provider={provider} zones={zones.data ?? []} />
              </TabsContent>
              <TabsContent value="carteira" className="pt-4">
                <ProviderWallet provider={provider} />
              </TabsContent>
              <TabsContent value="avaliacoes" className="pt-4">
                <ProviderReviews id={provider.id} />
              </TabsContent>
              <TabsContent value="historico" className="pt-4">
                <ProviderHistory id={provider.id} canOpen={hasPermission(role, "requests.view")} canAudit={hasPermission(role, "audit.view")} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </ScrollArea>
      {provider && action && <ProviderStatusDialog provider={provider} action={action} open onOpenChange={(open) => !open && setAction(null)} />}
    </section>
  );
}
