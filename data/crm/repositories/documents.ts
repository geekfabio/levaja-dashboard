import type { ClientDocument, DocumentCategory } from "@/data/documents";

export type DocumentUpload = {
  companyId: string;
  name: string;
  mime: string;
  size: number;
  category: DocumentCategory;
  expiresAt?: string;
  url?: string;
};

export interface DocumentsRepository {
  list(): Promise<ClientDocument[]>;
  upload(input: DocumentUpload): Promise<ClientDocument>;
  remove(id: string): Promise<ClientDocument>;
  restore(document: ClientDocument): Promise<ClientDocument>;
}
