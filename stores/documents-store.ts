import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import {
  DOCUMENTS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type ClientDocument,
  type DocumentCategory,
} from "@/data/documents";
import { nowLuandaLocal } from "@/lib/format";
import { recordEvent } from "./audit-store";
import { useCompaniesStore } from "./companies-store";

type DocumentsState = {
  documents: ClientDocument[];
  upload: (companyId: string, file: File, category: DocumentCategory, expiresAt?: string) => string | undefined;
  remove: (id: string) => void;
};

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function companyName(id: string) {
  return useCompaniesStore.getState().companies.find((company) => company.id === id)?.name ?? id;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: DOCUMENTS,

  upload: (companyId, file, category, expiresAt) => {
    if (!DOCUMENT_TYPES.includes(file.type)) return "Só PDF, JPG, PNG ou WebP.";
    if (file.size > MAX_DOCUMENT_BYTES) return `O ficheiro tem ${formatBytes(file.size)}; o máximo é 10 MB.`;
    const document: ClientDocument = {
      id: `doc-${crypto.randomUUID().slice(0, 8)}`,
      companyId,
      name: file.name,
      category,
      mime: file.type,
      size: file.size,
      uploadedAt: nowLuandaLocal(),
      uploadedBy: CURRENT_USER.name,
      expiresAt: expiresAt || undefined,
      url: URL.createObjectURL(file),
    };
    set((state) => ({ documents: [document, ...state.documents] }));
    recordEvent({
      action: `anexou «${document.name}» a`,
      target: { module: "Clientes", id: companyId, label: companyName(companyId) },
      companyId,
      notify: false,
      changes: [{ field: "Categoria", to: category }, ...(expiresAt ? [{ field: "Validade", to: expiresAt.split("-").reverse().join("/") }] : [])],
      toast: { title: "Documento anexado", description: document.name, tone: "success" },
    });
    return undefined;
  },

  remove: (id) => {
    const document = get().documents.find((item) => item.id === id);
    if (!document) return;
    const previous = get().documents;
    set((state) => ({ documents: state.documents.filter((item) => item.id !== id) }));
    recordEvent({
      action: `removeu «${document.name}» de`,
      target: { module: "Clientes", id: document.companyId, label: companyName(document.companyId) },
      companyId: document.companyId,
      sensitive: true,
      notify: false,
      toast: {
        title: "Documento removido",
        description: document.name,
        action: { label: "Anular", run: () => set({ documents: previous }) },
      },
    });
  },
}));
