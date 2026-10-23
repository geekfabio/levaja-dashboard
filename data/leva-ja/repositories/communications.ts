import type { Broadcast, BroadcastChannel, BroadcastStatus } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type BroadcastFilters = PageQuery & { status?: BroadcastStatus[]; channel?: BroadcastChannel[] };

export type BroadcastInput = Pick<Broadcast, "title" | "channel" | "audience" | "subject" | "message">;

export type AudienceEstimate = { recipients: number; sample: string[] };

export interface CommunicationsRepository {
  list(filters?: BroadcastFilters): Promise<Page<Broadcast>>;
  estimate(audience: Broadcast["audience"]): Promise<AudienceEstimate>;
  create(input: BroadcastInput): Promise<Broadcast>;
  schedule(id: string, at: string): Promise<Broadcast>;
  send(id: string): Promise<Broadcast>;
  cancel(id: string, reason: string): Promise<Broadcast>;
}
