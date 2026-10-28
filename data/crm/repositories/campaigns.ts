import type { Campaign, Channel } from "@/data/campaigns";

export interface CampaignsRepository {
  list(): Promise<Campaign[]>;
  createFromTemplate(channel: Channel, templateId: string): Promise<Campaign>;
  submitForReview(id: string): Promise<Campaign>;
  backToDraft(id: string): Promise<Campaign>;
  recordTest(id: string): Promise<Campaign>;
  schedule(id: string, scheduledAt: string, recipients: number, cost?: number): Promise<Campaign>;
  cancelSchedule(id: string): Promise<Campaign>;
}
