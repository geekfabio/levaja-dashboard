import type { PromotionInput } from "@/lib/leva-ja/commerce";
import type { Promotion, PromotionStatus } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type { PromotionInput } from "@/lib/leva-ja/commerce";

export type PromotionFilters = PageQuery & { status?: PromotionStatus[]; q?: string };

export type PromotionSummary = Omit<Promotion, "uses"> & { status: PromotionStatus; spent: number; usesCount: number; clients: number; volume: number };

export type PromotionDetail = PromotionSummary & { recentUses: (Promotion["uses"][number] & { requestCode: string; clientName: string })[] };

export interface PromotionsRepository {
  list(filters?: PromotionFilters): Promise<Page<PromotionSummary>>;
  get(id: string): Promise<PromotionDetail>;
  create(input: PromotionInput): Promise<PromotionSummary>;
  pause(id: string, reason: string): Promise<PromotionSummary>;
  resume(id: string): Promise<PromotionSummary>;
  end(id: string, reason: string): Promise<PromotionSummary>;
}
