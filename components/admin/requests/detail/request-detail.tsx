"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import RequestStatusBadge from "@/components/admin/shared/status-badge";
import DetailList from "@/components/admin/shared/detail-list";
import { ErrorState } from "@/components/_common/async-state";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { errorMessage, isRepositoryError } from "@/data/leva-ja";
import { useRequest } from "@/hooks/admin/use-requests";
import { useZones } from "@/hooks/admin/use-zones";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { canAccessSection, hasPermission } from "@/lib/leva-ja/permissions";
import { PAYMENT_LABELS } from "@/lib/leva-ja/services";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import Stars from "@/components/admin/shared/stars";
import RequestRefunds from "@/components/admin/refunds/request/request-refunds";
import { DISPUTE_CATEGORY_LABELS, DISPUTE_OUTCOME_LABELS } from "@/lib/leva-ja/refunds";
import RequestActions from "./request-actions";
import RequestPrice from "./request-price";
import RequestRoute from "./request-route";
import RequestServiceDetails from "./request-service-details";
import RequestTimeline from "./request-timeline";
import { ClientCard, ProviderCard } from "./request-parties";

function DetailSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <span className="sr-only">A carregar o pedido…</span>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function RequestDetail({ id }: { id: string }) {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const query = useRequest(id);
  const zones = useZones();
  const request = query.data;

  const back = (
    <Button variant="ghost" size="sm" href={SECTION_ROUTES.requests} className="self-start">
      <ChevronIcon aria-hidden className="size-3 rotate-90" />
      Pedidos
    </Button>
  );

  if (!role) return null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title={request ? `Pedido ${request.code}` : "Pedido"}
        badge={request ? <RequestStatusBadge status={request.status} /> : undefined}
      />
      <ScrollArea className="min-h-0 flex-1">
        {query.isPending ? (
          <DetailSkeleton />
        ) : query.isError || !request ? (
          <div className="flex flex-col gap-2 p-5">
            {back}
            <ErrorState
              title={isRepositoryError(query.error) && query.error.code === "not_found" ? "Pedido não encontrado" : undefined}
              description={errorMessage(query.error)}
              onRetry={isRepositoryError(query.error) && query.error.code === "not_found" ? undefined : () => query.refetch()}
              retrying={query.isFetching}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {back}
              <RequestActions request={request} role={role} />
            </div>

            {request.dispute && (
              <div
                role="status"
                className={
                  request.dispute.resolvedAt
                    ? "border-border bg-card flex flex-col gap-1 rounded-xl border p-4"
                    : "flex flex-col gap-1 rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg) p-4 text-(--tag-red-text)"
                }
              >
                <span className="lead-style font-medium">
                  {request.dispute.resolvedAt ? "Disputa resolvida" : "Disputa aberta"} · {DISPUTE_CATEGORY_LABELS[request.dispute.category ?? "other"]}
                </span>
                <span className="caption-style">
                  {request.dispute.reason} · aberta por {request.dispute.openedBy} a {formatDateTimeNumeric(request.dispute.openedAt)}
                </span>
                {request.dispute.resolution && (
                  <span className="caption-style">
                    {request.dispute.outcome ? `${DISPUTE_OUTCOME_LABELS[request.dispute.outcome]}: ` : "Resolução: "}
                    {request.dispute.resolution}
                    {request.dispute.resolvedAt && ` (${formatDateTimeNumeric(request.dispute.resolvedAt)})`}
                  </span>
                )}
                {canAccessSection(role, "disputes") && (
                  <Button variant="link" size="none" href={SECTION_ROUTES.disputes} className="caption-style self-start text-current">
                    {request.dispute.notes?.length ? `${request.dispute.notes.length} nota(s) interna(s) · ` : ""}Ver disputas
                  </Button>
                )}
              </div>
            )}

            {request.status === "cancelled" && request.cancelReason && (
              <div role="status" className="flex flex-col gap-1 rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg) p-4 text-(--tag-red-text)">
                <span className="lead-style font-medium">Pedido cancelado</span>
                <span className="caption-style">{request.cancelReason}</span>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex min-w-0 flex-col gap-4">
                <SettingsPanel title="Trajecto" className="bg-card">
                  <RequestRoute request={request} zones={zones.data ?? []} />
                </SettingsPanel>
                <SettingsPanel title="Serviço" className="bg-card">
                  <RequestServiceDetails request={request} zoneName={zones.data?.find((zone) => zone.id === request.zoneId)?.name ?? "—"} />
                </SettingsPanel>
                <SettingsPanel title="Linha temporal" className="bg-card">
                  <RequestTimeline request={request} />
                </SettingsPanel>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <SettingsPanel title="Cliente" className="bg-card">
                  <ClientCard request={request} canOpenClient={canAccessSection(role, "clients")} />
                </SettingsPanel>
                <SettingsPanel title="Prestador" className="bg-card">
                  <ProviderCard request={request} canOpenProvider={hasPermission(role, "providers.view")} />
                </SettingsPanel>
                <SettingsPanel title="Preço" className="bg-card">
                  <RequestPrice request={request} />
                </SettingsPanel>
                <SettingsPanel title="Pagamento" className="bg-card">
                  <DetailList
                    items={[
                      { label: "Método", value: request.paymentMethod ? PAYMENT_LABELS[request.paymentMethod] : "Por definir" },
                      {
                        label: "Estado",
                        value: ["paid", "rated"].includes(request.status) ? (
                          <Tag tone="green" size="sm">Pago</Tag>
                        ) : request.status === "cancelled" ? (
                          <Tag tone="neutral" size="sm">Sem cobrança</Tag>
                        ) : (
                          <Tag tone="amber" size="sm">Por pagar</Tag>
                        ),
                      },
                    ]}
                  />
                </SettingsPanel>
                {(hasPermission(role, "refunds.request") || hasPermission(role, "refunds.decide")) && (
                  <SettingsPanel title="Reembolsos" className="bg-card">
                    <RequestRefunds request={request} canRequest={hasPermission(role, "refunds.request")} canOpenRefunds={canAccessSection(role, "refunds")} />
                  </SettingsPanel>
                )}
                <SettingsPanel title="Comprovativo e avaliação" className="bg-card">
                  {request.proof ? (
                    <div className="flex flex-col gap-3">
                      <div
                        role="img"
                        aria-label={request.proof.photoLabel}
                        className="bg-muted text-subtle caption-style flex aspect-[4/3] items-center justify-center rounded-lg text-center"
                      >
                        {request.proof.photoLabel}
                      </div>
                      <DetailList
                        items={[
                          { label: "Recebido por", value: request.proof.receivedBy },
                          { label: "Entregue em", value: formatDateTimeNumeric(request.proof.at) },
                        ]}
                      />
                    </div>
                  ) : (
                    <p className="caption-style text-subtle">Ainda sem comprovativo de entrega.</p>
                  )}
                  {request.rating !== undefined ? (
                    <div className="border-border flex flex-col gap-2 border-t pt-3">
                      <Stars rating={request.rating} />
                      {request.review && <p className="caption-style text-soft">«{request.review}»</p>}
                    </div>
                  ) : (
                    <p className="caption-style text-subtle">Sem avaliação do cliente.</p>
                  )}
                </SettingsPanel>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
