import type { Contact } from "@/data/contacts";

export const ALL_COMPANIES = "all";
export const ANY_STATUS = "any";

export type ContactFilters = {
  companyId: string;
  contactability: string;
  search: string;
};

export const DEFAULT_FILTERS: ContactFilters = {
  companyId: ALL_COMPANIES,
  contactability: ANY_STATUS,
  search: "",
};

export function activeFilterCount({
  companyId,
  contactability,
  search,
}: ContactFilters) {
  return [
    companyId !== DEFAULT_FILTERS.companyId,
    contactability !== DEFAULT_FILTERS.contactability,
    search.trim() !== "",
  ].filter(Boolean).length;
}

export function filterContacts(
  contacts: Contact[],
  { companyId, contactability, search }: ContactFilters,
): Contact[] {
  const query = search.trim().toLowerCase();

  return contacts.filter((contact) => {
    if (companyId !== ALL_COMPANIES && contact.companyId !== companyId) {
      return false;
    }
    if (
      contactability !== ANY_STATUS &&
      contact.contactability !== contactability
    ) {
      return false;
    }
    if (
      query &&
      !contact.name.toLowerCase().includes(query) &&
      !contact.companyName.toLowerCase().includes(query) &&
      !contact.email.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}
