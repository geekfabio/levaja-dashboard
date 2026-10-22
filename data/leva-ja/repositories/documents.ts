import type { DocumentState, ProviderDocument } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type DocumentReviewItem = {
  document: ProviderDocument;
  providerId: string;
  providerName: string;
  providerInitials: string;
  vehiclePlate: string;
  submittedAt: string;
};

export type DocumentQueueFilters = PageQuery & { state?: DocumentState[]; q?: string };

export interface DocumentsRepository {
  queue(filters?: DocumentQueueFilters): Promise<Page<DocumentReviewItem>>;
  expiring(withinDays?: number): Promise<DocumentReviewItem[]>;
  approve(documentId: string, validUntil: string): Promise<DocumentReviewItem>;
  reject(documentId: string, reason: string): Promise<DocumentReviewItem>;
}
