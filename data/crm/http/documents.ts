import type { ClientDocument } from "@/data/documents";
import type { DocumentsRepository, DocumentUpload } from "../repositories/documents";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpDocuments(http: HttpClient): DocumentsRepository {
  return {
    list: () => http.get<ClientDocument[]>("/crm/documents"),
    upload: (input: DocumentUpload) => http.post<ClientDocument>("/crm/documents", input),
    remove: (documentId) => http.del<ClientDocument>(`/crm/documents/${id(documentId)}`),
    restore: (document: ClientDocument) => http.put<ClientDocument>(`/crm/documents/${id(document.id)}/restore`, document),
  };
}
