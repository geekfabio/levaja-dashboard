import { create } from "zustand";
import { CONTACTS, type Contact } from "@/data/contacts";
import { DEFAULT_FILTERS } from "@/lib/contacts";

export type MergeFieldKey = "role" | "phone" | "whatsapp" | "email";

export type MergeChoices = Record<MergeFieldKey, "primary" | "secondary">;

const DEFAULT_MERGE_CHOICES: MergeChoices = {
  role: "primary",
  phone: "primary",
  whatsapp: "primary",
  email: "primary",
};

type ContactsState = {
  contacts: Contact[];
  companyId: string;
  contactability: string;
  search: string;
  detailId: string | null;
  detailOpen: boolean;
  newContactOpen: boolean;
  mergeOpen: boolean;
  mergePrimaryId: string | null;
  mergeSecondaryId: string | null;
  mergeChoices: MergeChoices;
  setCompanyId: (companyId: string) => void;
  setContactability: (contactability: string) => void;
  setSearch: (search: string) => void;
  resetFilters: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewContactOpen: (open: boolean) => void;
  setMergeOpen: (open: boolean) => void;
  setMergePrimaryId: (id: string | null) => void;
  setMergeSecondaryId: (id: string | null) => void;
  setMergeChoice: (field: MergeFieldKey, winner: "primary" | "secondary") => void;
};

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: CONTACTS,
  ...DEFAULT_FILTERS,
  detailId: null,
  detailOpen: false,
  newContactOpen: false,
  mergeOpen: false,
  mergePrimaryId: null,
  mergeSecondaryId: null,
  mergeChoices: DEFAULT_MERGE_CHOICES,

  setCompanyId: (companyId) => set({ companyId }),
  setContactability: (contactability) => set({ contactability }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),

  openDetail: (detailId) => set({ detailId, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),
  setNewContactOpen: (newContactOpen) => set({ newContactOpen }),

  setMergeOpen: (mergeOpen) =>
    set({
      mergeOpen,
      ...(mergeOpen ? {} : { mergePrimaryId: null, mergeSecondaryId: null, mergeChoices: DEFAULT_MERGE_CHOICES }),
    }),
  setMergePrimaryId: (mergePrimaryId) => set({ mergePrimaryId }),
  setMergeSecondaryId: (mergeSecondaryId) => set({ mergeSecondaryId }),
  setMergeChoice: (field, winner) => set((state) => ({ mergeChoices: { ...state.mergeChoices, [field]: winner } })),
}));
