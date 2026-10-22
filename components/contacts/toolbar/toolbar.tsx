"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import { COMPANY_OPTIONS, CONTACTABILITY_OPTIONS } from "./filter-options";
import { useContactsStore } from "@/stores/contacts-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import UsersIcon from "@/public/assets/images/companies/sidebar/users.svg";

export default function ContactsToolbar() {
  const companyId = useContactsStore((state) => state.companyId);
  const contactability = useContactsStore((state) => state.contactability);
  const search = useContactsStore((state) => state.search);
  const setCompanyId = useContactsStore((state) => state.setCompanyId);
  const setContactability = useContactsStore((state) => state.setContactability);
  const setSearch = useContactsStore((state) => state.setSearch);
  const setNewContactOpen = useContactsStore((state) => state.setNewContactOpen);
  const setMergeOpen = useContactsStore((state) => state.setMergeOpen);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Pesquisar contactos"
          data-page-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar nome, cliente ou e-mail…"
          className="h-[30px] w-full sm:w-[220px]"
        />
        <FilterMenu
          label="Cliente"
          value={companyId}
          options={COMPANY_OPTIONS}
          onChange={setCompanyId}
        />
        <FilterMenu
          label="Estado"
          value={contactability}
          options={CONTACTABILITY_OPTIONS}
          onChange={setContactability}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMergeOpen(true)}
        >
          <UsersIcon aria-hidden className="size-3" />
          Fundir Duplicados
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setNewContactOpen(true)}
        >
          <PlusIcon aria-hidden className="size-3" />
          Novo Contacto
        </Button>
      </div>
    </div>
  );
}
