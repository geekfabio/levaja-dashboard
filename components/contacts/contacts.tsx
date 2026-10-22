"use client";

import { useMemo } from "react";
import ModuleHeader from "@/components/_common/module-header";
import ContactsToolbar from "./toolbar/toolbar";
import ContactsTotals from "./contacts-totals";
import ContactsTable from "./table/contacts-table";
import ContactDetail from "./detail/contact-detail";
import NewContactDialog from "./new-contact/new-contact-dialog";
import MergeContactsDialog from "./merge-contacts/merge-contacts-dialog";
import { filterContacts } from "@/lib/contacts";
import { useContactsStore } from "@/stores/contacts-store";

export default function Contacts() {
  const contacts = useContactsStore((state) => state.contacts);
  const companyId = useContactsStore((state) => state.companyId);
  const contactability = useContactsStore((state) => state.contactability);
  const search = useContactsStore((state) => state.search);

  const visible = useMemo(
    () => filterContacts(contacts, { companyId, contactability, search }),
    [contacts, companyId, contactability, search],
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Contactos" count={visible.length} />
      <ContactsTotals contacts={visible} />
      <ContactsToolbar />
      <ContactsTable contacts={visible} />
      <ContactDetail />
      <NewContactDialog />
      <MergeContactsDialog />
    </section>
  );
}
