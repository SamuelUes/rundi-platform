import { adminFirestore, adminMessaging } from "@/lib/firebase-admin";
import { COLLECTION, docToCampaign } from "@/app/api/admin/messaging/utils";
import type { MessagingCampaign } from "@/types/messaging";

const TOKENS_SUBCOLLECTION = "fcmTokens";
const MAX_TOKENS_PER_BATCH = 500;
const DEFAULT_EXPIRES_IN_MS = 120_000;

interface TokenEntry {
  token: string;
  userId: string;
  platform?: string | null;
}

interface SendCampaignResult {
  campaign: MessagingCampaign;
  requestedTokens: number;
  sentTokens: number;
  failedTokens: number;
  errors: { token: string; code?: string; message?: string }[];
}

async function collectAllTokens(): Promise<TokenEntry[]> {
  const userRefs = await adminFirestore.collection("users").listDocuments();
  const tokenEntries: TokenEntry[] = [];

  for (const userRef of userRefs) {
    const tokensSnapshot = await userRef.collection(TOKENS_SUBCOLLECTION).get();
    tokensSnapshot.forEach((doc) => {
      const token = doc.id;
      if (token) {
        const data = doc.data() ?? {};
        tokenEntries.push({
          token,
          userId: userRef.id,
          platform: (data.platform as string | undefined) ?? null,
        });
      }
    });
  }

  const uniqueTokens = new Map<string, TokenEntry>();
  tokenEntries.forEach((entry) => {
    if (!uniqueTokens.has(entry.token)) {
      uniqueTokens.set(entry.token, entry);
    }
  });

  return Array.from(uniqueTokens.values());
}

function chunkTokens<T>(tokens: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
    chunks.push(tokens.slice(i, i + MAX_TOKENS_PER_BATCH));
  }
  return chunks;
}

const buildCampaignPayload = (campaign: MessagingCampaign) => {
  const notificationKey = `campaign-${campaign.id}`;
  const expiresInSeconds = Math.max(1, Math.round(DEFAULT_EXPIRES_IN_MS / 1000));

  return {
    notification: {
      title: campaign.name,
      body: campaign.description,
    },
    data: {
      campaignId: campaign.id,
      segment: campaign.segment || "",
      category: campaign.category,
      type: "messaging_campaign",
      notificationKey,
      expiresInMs: String(DEFAULT_EXPIRES_IN_MS),
    },
    android: {
      priority: "high" as const,
      ttl: expiresInSeconds,
      notification: {
        channelId: "rundi_default",
        tag: notificationKey,
      },
    },
    apns: {
      headers: {
        "apns-expiration": String(Math.floor(Date.now() / 1000) + expiresInSeconds),
        "apns-collapse-id": notificationKey,
      },
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };
};

export async function sendCampaignNow(campaignId: string): Promise<SendCampaignResult> {
  const docRef = adminFirestore.collection(COLLECTION).doc(campaignId);
  const docSnapshot = await docRef.get();
  if (!docSnapshot.exists) {
    throw new Error("Campaña no encontrada");
  }

  const campaign = docToCampaign(docSnapshot);
  if (campaign.channel !== "push") {
    throw new Error("Solo las campañas de tipo push se pueden enviar desde la plataforma");
  }

  const tokens = await collectAllTokens();
  if (!tokens.length) {
    const now = new Date().toISOString();
    await docRef.update({ lastSentAt: now, lastSentCount: 0, lastUpdate: now });
    const refreshed = await docRef.get();
    return {
      campaign: docToCampaign(refreshed),
      requestedTokens: 0,
      sentTokens: 0,
      failedTokens: 0,
      errors: [],
    };
  }

  const errors: { token: string; code?: string; message?: string }[] = [];
  let successCount = 0;

  const payloadBase = buildCampaignPayload(campaign);

  for (const chunk of chunkTokens(tokens)) {
    const tokenValues = chunk.map((entry) => entry.token);
    try {
      const response = await adminMessaging.sendEachForMulticast({
        tokens: tokenValues,
        ...payloadBase,
      });

      successCount += response.successCount;
      response.responses.forEach((res, index) => {
        if (!res.success) {
          errors.push({
            token: tokenValues[index]?.slice(0, 24) ?? "unknown",
            code: res.error?.code,
            message: res.error?.message,
          });
        }
      });
    } catch (err) {
      errors.push({
        token: tokenValues[0]?.slice(0, 24) ?? "chunk",
        code: "multicast-error",
        message: err instanceof Error ? err.message : "Error desconocido al enviar",
      });
    }
  }

  const now = new Date().toISOString();
  await docRef.update({ lastSentAt: now, lastSentCount: successCount, lastUpdate: now });
  const refreshed = await docRef.get();

  return {
    campaign: docToCampaign(refreshed),
    requestedTokens: tokens.length,
    sentTokens: successCount,
    failedTokens: tokens.length - successCount,
    errors,
  };
}
