import { CURRENT_USER } from "@/data/companies";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, type ClientDocument } from "@/data/documents";
import { useDocumentsStore } from "@/stores/documents-store";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { DocumentsRepository } from "../repositories/documents";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function documents() {
  return useDocumentsStore.getState().documents;
}

function setDocuments(next: ClientDocument[]) {
  useDocumentsStore.setState({ documents: next });
}

export function createMockDocuments(latencyMs: number): DocumentsRepository {
  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(documents());
    },

    upload: async (input) => {
      await sleep(latencyMs);
      if (!DOCUMENT_TYPES.includes(input.mime)) throw new RepositoryError("validation", "Só PDF, JPG, PNG ou WebP.", [{ field: "mime", message: "Só PDF, JPG, PNG ou WebP." }]);
      if (input.size > MAX_DOCUMENT_BYTES) throw new RepositoryError("validation", "O ficheiro é demasiado grande; o máximo é 10 MB.", [{ field: "size", message: "O máximo é 10 MB." }]);
      const document: ClientDocument = {
        id: `doc-${crypto.randomUUID().slice(0, 8)}`,
        companyId: input.companyId,
        name: input.name,
        category: input.category,
        mime: input.mime,
        size: input.size,
        uploadedAt: nowLuandaLocal(),
        uploadedBy: CURRENT_USER.name,
        expiresAt: input.expiresAt || undefined,
        url: input.url,
      };
      setDocuments([document, ...documents()]);
      return structuredClone(document);
    },

    remove: async (id) => {
      await sleep(latencyMs);
      const document = documents().find((item) => item.id === id);
      if (!document) throw new RepositoryError("not_found", "O documento não existe ou já foi removido.");
      setDocuments(documents().filter((item) => item.id !== id));
      return structuredClone(document);
    },

    restore: async (document) => {
      await sleep(latencyMs);
      setDocuments([document, ...documents().filter((item) => item.id !== document.id)]);
      return structuredClone(document);
    },
  };
}
