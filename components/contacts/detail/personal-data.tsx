"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { CURRENT_USER } from "@/data/companies";
import type { Contact } from "@/data/contacts";
import { nowLuandaLocal } from "@/lib/format";
import { ANONYMIZED_NAME, contactDataExport } from "@/lib/privacy";
import { slugify } from "@/lib/utils";
import { useActivitiesStore } from "@/stores/activities-store";
import { recordEvent } from "@/stores/audit-store";
import { useAuditStore } from "@/stores/audit-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useConversationsStore } from "@/stores/conversations-store";
import { useMessagingStore } from "@/stores/messaging-store";

export function exportContactData(contact: Contact) {
  const data = contactDataExport(contact, {
    activities: useActivitiesStore.getState().activities,
    conversations: useConversationsStore.getState().conversations,
    outbox: useMessagingStore.getState().outbox,
    audit: useAuditStore.getState().events,
    generatedAt: nowLuandaLocal(),
    generatedBy: CURRENT_USER.name,
  });
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `dados-pessoais-${slugify(contact.name)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  recordEvent({
    action: "exportou os dados pessoais de",
    target: { module: "Contactos", id: contact.id, label: contact.name },
    companyId: contact.companyId,
    sensitive: true,
    notify: false,
  });
}

export default function PersonalData({ contact }: { contact: Contact }) {
  const anonymize = useContactsStore((state) => state.anonymize);
  const [confirming, setConfirming] = useState(false);
  const anonymized = contact.name === ANONYMIZED_NAME;

  if (anonymized) {
    return <p className="caption-style text-subtle">Dados pessoais removidos. Fica só a ligação ao cliente para as estatísticas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="caption-style text-subtle">
        Pedidos do titular ao abrigo da Lei n.º 22/11: acesso aos dados (exportação) e apagamento (anonimização).
      </span>
      {confirming ? (
        <div role="alertdialog" aria-label="Confirmar anonimização" className="flex flex-col gap-3 rounded-lg border border-(--tag-red-border) bg-(--tag-red-bg) p-3">
          <span className="lead-style text-(--tag-red-text)">
            Remover nome, telefone, e-mail e WhatsApp de {contact.name}, retirar todos os consentimentos e apagar as conversas? Não é possível anular.
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="subtle" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                anonymize(contact.id);
                setConfirming(false);
              }}
            >
              Anonimizar definitivamente
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportContactData(contact)}>
            Exportar dados (JSON)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Anonimizar contacto
          </Button>
        </div>
      )}
    </div>
  );
}
