"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import type { Contact } from "@/data/contacts";
import { formatNumber, plural } from "@/lib/format";
import { ANY_STATUS } from "@/lib/contacts";
import { useContactsStore } from "@/stores/contacts-store";

export default function ContactsTotals({ contacts }: { contacts: Contact[] }) {
  const contactability = useContactsStore((state) => state.contactability);
  const setContactability = useContactsStore((state) => state.setContactability);
  const valid = contacts.filter((contact) => contact.contactability === "Válido").length;
  const email = contacts.filter((contact) => contact.consent.email.granted).length;
  const sms = contacts.filter((contact) => contact.consent.sms.granted).length;
  const whatsapp = contacts.filter((contact) => contact.consent.whatsapp.granted).length;
  const unreachable = contacts.length - valid;

  function toggle(status: string) {
    setContactability(contactability === status ? ANY_STATUS : status);
  }

  return (
    <TotalsBar
      id="contactos"
      summary={`${plural(contacts.length, "contacto", "contactos")} · ${plural(valid, "contactável", "contactáveis")}`}
      items={[
        { key: "total", label: "Contactos", value: formatNumber(contacts.length) },
        {
          key: "validos",
          label: "Contactáveis",
          value: formatNumber(valid),
          hint: "estado válido",
          tone: "success",
          pressed: contactability === "Válido",
          onSelect: () => toggle("Válido"),
        },
        { key: "email", label: "Aceitam e-mail", value: formatNumber(email) },
        { key: "sms", label: "Aceitam SMS", value: formatNumber(sms) },
        { key: "whatsapp", label: "Aceitam WhatsApp", value: formatNumber(whatsapp) },
        {
          key: "indisponiveis",
          label: "Não contactáveis",
          value: formatNumber(unreachable),
          hint: "inválido, saiu ou pediu remoção",
          tone: unreachable > 0 ? "warning" : undefined,
        },
      ]}
    />
  );
}
