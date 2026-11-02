import { create } from "zustand";
import { DOCUMENTS, type ClientDocument } from "@/data/documents";

type DocumentsState = {
  documents: ClientDocument[];
};

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

export const useDocumentsStore = create<DocumentsState>(() => ({
  documents: DOCUMENTS,
}));
