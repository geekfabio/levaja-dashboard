import type { Contact, ContactabilityStatus, ConsentChannel } from "@/data/contacts";
import type { ContactPatch, ContactsRepository, MergeChoices } from "../repositories/contacts";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpContacts(http: HttpClient): ContactsRepository {
  return {
    list: () => http.get<Contact[]>("/crm/contacts"),
    get: (contactId) => http.get<Contact>(`/crm/contacts/${id(contactId)}`),
    create: (contact: Contact) => http.post<Contact>("/crm/contacts", contact),
    update: (contactId, patch: ContactPatch) => http.patch<Contact>(`/crm/contacts/${id(contactId)}`, patch),
    restore: (contact: Contact) => http.put<Contact>(`/crm/contacts/${id(contact.id)}/restore`, contact),
    setContactability: (contactId, status: ContactabilityStatus) => http.patch<Contact>(`/crm/contacts/${id(contactId)}/contactability`, { status }),
    toggleConsent: (contactId, channel: ConsentChannel) => http.post<Contact>(`/crm/contacts/${id(contactId)}/consent/toggle`, { channel }),
    merge: (primaryId, secondaryId, choices: MergeChoices) => http.post<{ merged: Contact; removedId: string }>("/crm/contacts/merge", { primaryId, secondaryId, choices }),
    restoreMerge: (snapshot: Contact[]) => http.post<Contact[]>("/crm/contacts/restore-merge", { contacts: snapshot }),
    anonymize: (contactId) => http.post<Contact>(`/crm/contacts/${id(contactId)}/anonymize`, {}),
  };
}
