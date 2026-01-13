export type CampaignStatus = "draft" | "scheduled" | "active" | "completed";
export type CampaignCategory = "campaign" | "experiment";
export type CampaignChannel = "push" | "in_app" | "email";

export interface MessagingCampaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  startAt: string;
  endAt: string | null;
  segment: string;
  lastUpdate: string;
  impressions: number | null;
  clicks: number | null;
  channel: CampaignChannel;
  category: CampaignCategory;
  createdAt?: string | null;
  lastSentAt?: string | null;
  lastSentCount?: number | null;
}

export type CampaignUpsertInput = Omit<MessagingCampaign, "id" | "lastUpdate" | "impressions" | "clicks" | "createdAt" | "lastSentAt" | "lastSentCount">;

export interface MessagingCampaignStats {
  total: number;
  draft: number;
  scheduled: number;
  active: number;
  completed: number;
}

export interface MessagingCampaignListResponse {
  campaigns: MessagingCampaign[];
  stats: MessagingCampaignStats;
}
