"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import Tag from "@/components/_ui/tag";
import type { AttentionItems } from "@/data/leva-ja";
import { formatDateTimeNumeric, formatElapsed, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { DOCUMENT_STATE_LABELS, SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { canAccessSection } from "@/lib/leva-ja/permissions";
import type { AdminSection } from "@/lib/leva-ja/permissions";
import type { AdminRole } from "@/types/leva-ja";

type Row = { id: string; title: ReactNode; detail: string; meta: ReactNode; href?: string };

type GroupProps = {
  title: string;
  total: number;
  empty: string;
  rows: Row[];
  section: AdminSection;
  role: AdminRole;
};

function Group({ title, total, empty, rows, section, role }: GroupProps) {
  const allowed = canAccessSection(role, section);
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="lead-style flex items-center gap-2 font-medium">
          {title}
          <CountBadge>{total}</CountBadge>
        </h3>
        {allowed && total > rows.length && (
          <Button variant="link" size="none" className="caption-style" href={SECTION_ROUTES[section]}>
            Ver todos
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="caption-style text-subtle">{empty}</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {rows.map((row) => {
            const content = (
              <>
                <span className="flex min-w-0 flex-col gap-1 text-left">
                  <span className="lead-style truncate">{row.title}</span>
                  <span className="caption-style text-subtle truncate">{row.detail}</span>
                </span>
                <span className="caption-style text-soft shrink-0 tabular-nums">{row.meta}</span>
              </>
            );
            return (
              <li key={row.id}>
                {allowed && row.href ? (
                  <Button variant="item" size="none" href={row.href} className="items-center justify-between gap-3 px-2 py-2.5">
                    {content}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between gap-3 px-2 py-2.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function AttentionList({ items, role, now }: { items: AttentionItems; role: AdminRole; now: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Group
        title="Pedidos à procura de prestador"
        total={items.stalledSearching.length}
        empty="Nenhum pedido parado. Todos foram atribuídos a tempo."
        section="requests"
        role={role}
        rows={items.stalledSearching.slice(0, 5).map((request) => ({
          id: request.id,
          title: `${request.code} · ${SERVICE_SHORT_LABELS[request.kind]}`,
          detail: `${request.client?.name ?? "Cliente"} · ${request.origin.area}`,
          meta: <Tag tone="amber" size="sm">há {formatElapsed(request.createdAt, now)}</Tag>,
          href: `${SECTION_ROUTES.requests}/${request.id}`,
        }))}
      />
      <Group
        title="Alertas SOS abertos"
        total={items.openSos.length}
        empty="Sem alertas SOS abertos."
        section="support"
        role={role}
        rows={items.openSos.map((alert) => ({
          id: alert.id,
          title: `${alert.raisedByName} · ${alert.requestCode}`,
          detail: alert.message,
          meta: <Tag tone="red" size="sm">há {formatElapsed(alert.createdAt, now)}</Tag>,
          href: SECTION_ROUTES.support,
        }))}
      />
      <Group
        title="Documentos por validar"
        total={items.pendingDocumentsTotal}
        empty="A fila de documentos está vazia."
        section="documents"
        role={role}
        rows={items.pendingDocuments.map((item) => ({
          id: item.document.id,
          title: `${item.document.title} · ${item.providerName}`,
          detail: `${DOCUMENT_STATE_LABELS[item.document.state]} · enviado a ${formatDateTimeNumeric(item.submittedAt)}`,
          meta: item.vehiclePlate,
          href: SECTION_ROUTES.documents,
        }))}
      />
      <Group
        title="Levantamentos pendentes"
        total={items.pendingWithdrawalsTotal}
        empty="Sem levantamentos por aprovar."
        section="finance"
        role={role}
        rows={items.pendingWithdrawals.map((withdrawal) => ({
          id: withdrawal.id,
          title: withdrawal.providerName,
          detail: `Pedido a ${formatDateTimeNumeric(withdrawal.requestedAt)}`,
          meta: formatKz(withdrawal.amount),
          href: SECTION_ROUTES.finance,
        }))}
      />
    </div>
  );
}
