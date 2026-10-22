"use client";

import { useMemo, useState } from "react";
import { valuesForContact } from "@/lib/campaigns";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";

const NO_CONTACT = "none";

export function usePreviewContact() {
  const contacts = useContactsStore((state) => state.contacts);
  const companies = useCompaniesStore((state) => state.companies);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? NO_CONTACT);

  const options = useMemo(
    () => [
      { value: NO_CONTACT, label: "Valores por omissão" },
      ...contacts.map((contact) => ({ value: contact.id, label: contact.name })),
    ],
    [contacts],
  );

  const contact = contacts.find((item) => item.id === contactId);
  const company = companies.find((item) => item.id === contact?.companyId);

  return {
    contactId,
    setContactId,
    options,
    values: valuesForContact(contact, company),
  };
}
