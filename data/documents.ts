export const DOCUMENT_CATEGORIES = ["Contrato", "Alvará", "Documento fiscal", "Foto do estabelecimento", "Outro"] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ClientDocument = {
  id: string;
  companyId: string;
  name: string;
  category: DocumentCategory;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  expiresAt?: string;
  url?: string;
};

export const DOCUMENTS: ClientDocument[] = [
  {
    id: "doc-1",
    companyId: "mussulo-bay",
    name: "Contrato de fornecimento 2026.pdf",
    category: "Contrato",
    mime: "application/pdf",
    size: 482_000,
    uploadedAt: "2026-01-15T10:20",
    uploadedBy: "Nelson Lemos",
    expiresAt: "2026-12-31",
  },
  {
    id: "doc-2",
    companyId: "boa-esperanca",
    name: "Alvará comercial.pdf",
    category: "Alvará",
    mime: "application/pdf",
    size: 215_000,
    uploadedAt: "2025-11-02T09:00",
    uploadedBy: "Sara Neto",
    expiresAt: "2026-10-30",
  },
  {
    id: "doc-3",
    companyId: "boa-esperanca",
    name: "Certidão de NIF.pdf",
    category: "Documento fiscal",
    mime: "application/pdf",
    size: 98_000,
    uploadedAt: "2025-11-02T09:02",
    uploadedBy: "Sara Neto",
  },
];
