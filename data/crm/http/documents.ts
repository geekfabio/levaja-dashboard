import type { ClientDocument } from "@/data/documents";
import type { DocumentsRepository, DocumentUpload } from "../repositories/documents";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpDocuments(http: HttpClient): DocumentsRepository {
  return {
    list: () => http.get<ClientDocument[]>("/crm/documents"),
    upload: (input: DocumentUpload) => http.post<ClientDocument>("/crm/documents", input),
    remove: (documentId) => http.post<ClientDocument>(`/crm/documents/${id(documentId)}/remove`, {}),
    restore: (document: ClientDocument) => http.post<ClientDocument>("/crm/documents/restore", document),
  };
}
