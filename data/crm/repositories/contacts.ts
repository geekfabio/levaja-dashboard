import type { Contact, ContactabilityStatus, ConsentChannel } from "@/data/contacts";

export type ContactPatch = Partial<Pick<Contact, "name" | "role" | "phone" | "whatsapp" | "email" | "companyId" | "companyName">>;

export type MergeFieldKey = "role" | "phone" | "whatsapp" | "email";

export type MergeChoices = Record<MergeFieldKey, "primary" | "secondary">;

export interface ContactsRepository {
  list(): Promise<Contact[]>;
  get(id: string): Promise<Contact>;
  create(contact: Contact): Promise<Contact>;
  update(id: string, patch: ContactPatch): Promise<Contact>;
  restore(contact: Contact): Promise<Contact>;
  setContactability(id: string, status: ContactabilityStatus): Promise<Contact>;
  toggleConsent(id: string, channel: ConsentChannel): Promise<Contact>;
  merge(primaryId: string, secondaryId: string, choices: MergeChoices): Promise<{ merged: Contact; removedId: string }>;
  restoreMerge(snapshot: Contact[]): Promise<Contact[]>;
  anonymize(id: string): Promise<Contact>;
}
