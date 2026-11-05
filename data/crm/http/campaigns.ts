import type { Campaign, Channel } from "@/data/campaigns";
import type { CampaignsRepository } from "../repositories/campaigns";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpCampaigns(http: HttpClient): CampaignsRepository {
  return {
    list: () => http.get<Campaign[]>("/crm/campaigns"),
    createFromTemplate: (channel: Channel, templateId: string) => http.post<Campaign>("/crm/campaigns", { channel, templateId }),
    submitForReview: (campaignId) => http.post<Campaign>(`/crm/campaigns/${id(campaignId)}/submit-for-review`, {}),
    backToDraft: (campaignId) => http.post<Campaign>(`/crm/campaigns/${id(campaignId)}/back-to-draft`, {}),
    recordTest: (campaignId) => http.post<Campaign>(`/crm/campaigns/${id(campaignId)}/record-test`, {}),
    schedule: (campaignId, scheduledAt, recipients, cost) => http.post<Campaign>(`/crm/campaigns/${id(campaignId)}/schedule`, { scheduledAt, recipients, cost }),
    cancelSchedule: (campaignId) => http.post<Campaign>(`/crm/campaigns/${id(campaignId)}/cancel-schedule`, {}),
  };
}
