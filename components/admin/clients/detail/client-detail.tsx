"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import DetailList from "@/components/admin/shared/detail-list";
import EntityAudit from "@/components/admin/shared/entity-audit";
import RequestHistory from "@/components/admin/shared/request-history";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import ReviewList from "@/components/admin/shared/review-list";
import AsyncState, { ErrorState } from "@/components/_common/async-state";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { errorMessage, isRepositoryError } from "@/data/leva-ja";
import { useClient, useClientRequests, useClientReviews, useClientTickets } from "@/hooks/admin/use-clients";
import { formatDateNumeric, formatDateTimeNumeric, formatDecimal, formatKz, formatNumber } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { PAYMENT_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/leva-ja/services";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import ClientBlockDialog from "../dialogs/client-block-dialog";

const TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "pedidos", label: "Pedidos" },
  { value: "avaliacoes", label: "Avaliações dadas" },
  { value: "ocorrencias", label: "Ocorrências" },
];

const TICKET_TONES = { open: "warning", in_progress: "info", resolved: "success" } as const;

function ClientRequests({ id, canOpen }: { id: string; canOpen: boolean }) {
  const [page, setPage] = useState(1);
  const query = useClientRequests(id, { page, pageSize: 10 });
  return <RequestHistory query={query} counterpart="provider" onPageChange={setPage} canOpen={canOpen} />;
}

function ClientReviews({ id, canOpen }: { id: string; canOpen: boolean }) {
  const query = useClientReviews(id);
  return (
    <AsyncState
      query={query}
      skeleton={<Skeleton className="h-40" />}
      errorDescription={errorMessage}
      isEmpty={(items) => items.length === 0}
      empty={{ title: "Sem avaliações", description: "Este cliente ainda não avaliou nenhum serviço." }}
    >
      {(items) => (
        <ReviewList
          reviews={items}
          title={(review) =>
            canOpen ? (
              <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${review.requestId}`}>
                Ver pedido avaliado
              </Button>
            ) : (
              "Pedido avaliado"
            )
          }
        />
      )}
    </AsyncState>
  );
}

function ClientTickets({ id }: { id: string }) {
  const query = useClientTickets(id);
  return (
    <AsyncState
      query={query}
      skeleton={<Skeleton className="h-40" />}
      errorDescription={errorMessage}
      isEmpty={(items) => items.length === 0}
      empty={{ title: "Sem ocorrências", description: "Este cliente não abriu nenhuma ocorrência." }}
    >
      {(items) => (
        <ul className="divide-border flex flex-col divide-y">
          {items.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="lead-style">
                  {ticket.code} · {ticket.subject}
                </span>
                <span className="caption-style text-subtle">
                  {formatDateTimeNumeric(ticket.createdAt)} · prioridade {TICKET_PRIORITY_LABELS[ticket.priority].toLowerCase()}
                  {ticket.assigneeName ? ` · ${ticket.assigneeName}` : ""}
                </span>
              </span>
              <ToneBadge tone={TICKET_TONES[ticket.status]} label={TICKET_STATUS_LABELS[ticket.status]} />
            </li>
          ))}
        </ul>
      )}
    </AsyncState>
  );
}

export default function ClientDetail({ id }: { id: string }) {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const query = useClient(id);
  const [tab, setTab] = useState("resumo");
  const [blockOpen, setBlockOpen] = useState(false);
  const client = query.data;
  if (!role) return null;

  const back = (
    <Button variant="ghost" size="sm" href={SECTION_ROUTES.clients} className="self-start">
      <ChevronIcon aria-hidden className="size-3 rotate-90" />
      Clientes
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title={client?.name ?? "Cliente"}
        badge={client ? <ToneBadge tone={client.blocked ? "danger" : "success"} label={client.blocked ? "Bloqueado" : "Activo"} /> : undefined}
      />
      <ScrollArea className="min-h-0 flex-1">
        {query.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-4 p-5">
            <span className="sr-only">A carregar o cliente…</span>
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : query.isError || !client ? (
          <div className="flex flex-col gap-2 p-5">
            {back}
            <ErrorState
              title={isRepositoryError(query.error) && query.error.code === "not_found" ? "Cliente não encontrado" : undefined}
              description={errorMessage(query.error)}
              onRetry={isRepositoryError(query.error) && query.error.code === "not_found" ? undefined : () => query.refetch()}
              retrying={query.isFetching}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {back}
              {hasPermission(role, "clients.block") && (
                <Button variant={client.blocked ? "primary" : "danger"} size="sm" onClick={() => setBlockOpen(true)}>
                  {client.blocked ? "Desbloquear" : "Bloquear"}
                </Button>
              )}
            </div>

            {client.blocked && client.blockedReason && (
              <div role="status" className="flex flex-col gap-1 rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg) p-4 text-(--tag-red-text)">
                <span className="lead-style font-medium">Cliente bloqueado</span>
                <span className="caption-style">{client.blockedReason}</span>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label="Secções do cliente" className="border-border overflow-x-auto border-b *:whitespace-nowrap">
                {TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="resumo" className="flex flex-col gap-4 pt-4">
                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Pedidos", value: formatNumber(client.requestsCount) },
                    { label: "Total gasto", value: formatKz(client.totalSpent) },
                    { label: "Avaliação como cliente", value: `${formatDecimal(client.rating, 1)} ★` },
                  ].map((item) => (
                    <div key={item.label} className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
                      <dt className="caption-style text-subtle">{item.label}</dt>
                      <dd className="text-[20px] leading-none font-semibold tabular-nums">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-4 lg:grid-cols-2">
                  <SettingsPanel title="Contacto" className="bg-card">
                    <DetailList
                      items={[
                        { label: "Telefone", value: <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="hover:underline">{client.phone}</a> },
                        { label: "E-mail", value: client.email },
                        { label: "Cliente desde", value: formatDateNumeric(client.createdAt) },
                      ]}
                    />
                  </SettingsPanel>
                  <SettingsPanel title="Métodos de pagamento" className="bg-card">
                    <ul className="flex flex-col gap-2">
                      {client.paymentMethods.map((method) => (
                        <li key={method.id} className="flex items-center justify-between gap-2">
                          <span className="lead-style">
                            {method.label}
                            {method.label !== PAYMENT_LABELS[method.kind] && (
                              <span className="caption-style text-subtle ml-2">{PAYMENT_LABELS[method.kind]}</span>
                            )}
                          </span>
                          {method.isDefault && (
                            <Tag tone="green" size="sm">
                              Predefinido
                            </Tag>
                          )}
                        </li>
                      ))}
                    </ul>
                  </SettingsPanel>
                </div>
                <SettingsPanel title="Moradas guardadas" className="bg-card">
                  <ul className="flex flex-col gap-2">
                    {client.addresses.map((address) => (
                      <li key={address.id} className="lead-style">
                        {address.label}
                        <span className="caption-style text-subtle ml-2">
                          {address.area}, {address.city}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SettingsPanel>
                {hasPermission(role, "audit.view") && (
                  <SettingsPanel title="Registo de auditoria" className="bg-card">
                    <EntityAudit entityId={client.id} />
                  </SettingsPanel>
                )}
              </TabsContent>
              <TabsContent value="pedidos" className="pt-4">
                <ClientRequests id={client.id} canOpen={hasPermission(role, "requests.view")} />
              </TabsContent>
              <TabsContent value="avaliacoes" className="pt-4">
                <SettingsPanel title="Avaliações dadas" className="bg-card">
                  <ClientReviews id={client.id} canOpen={hasPermission(role, "requests.view")} />
                </SettingsPanel>
              </TabsContent>
              <TabsContent value="ocorrencias" className="pt-4">
                <SettingsPanel title="Ocorrências" className="bg-card">
                  <ClientTickets id={client.id} />
                </SettingsPanel>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </ScrollArea>
      {client && <ClientBlockDialog client={client} open={blockOpen} onOpenChange={setBlockOpen} />}
    </section>
  );
}
