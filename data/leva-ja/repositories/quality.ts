import type { PenaltyInput } from "@/lib/leva-ja/quality";
import type { Penalty, PenaltyKind, ProviderQuality, QualityFlag } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type QualityFilters = PageQuery & { flag?: QualityFlag[]; fleetId?: string; q?: string; sort?: "score" | "cancellations" | "late" };

export type QualityPage = Page<ProviderQuality> & { totals: { flagged: number; averageScore: number; activePenalties: number } };

export type PenaltyFilters = PageQuery & { providerId?: string; kind?: PenaltyKind[]; active?: boolean };

export type { PenaltyInput } from "@/lib/leva-ja/quality";

export interface QualityRepository {
  scores(filters?: QualityFilters): Promise<QualityPage>;
  provider(providerId: string): Promise<ProviderQuality>;
  penalties(filters?: PenaltyFilters): Promise<Page<Penalty>>;
  penalize(providerId: string, input: PenaltyInput): Promise<Penalty>;
  revoke(id: string, reason: string): Promise<Penalty>;
}
