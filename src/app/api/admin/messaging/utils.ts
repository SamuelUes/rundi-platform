import { NextRequest } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import {
  CampaignCategory,
  CampaignChannel,
  CampaignStatus,
  MessagingCampaign,
  MessagingCampaignStats,
} from "@/types/messaging";

export const COLLECTION = "messaging";
export const LEGACY_COLLECTION = "messagingCampaigns";
export const ALLOWED_STATUS: CampaignStatus[] = ["draft", "scheduled", "active", "completed"];
export const ALLOWED_CHANNELS: CampaignChannel[] = ["push", "in_app", "email"];
export const ALLOWED_CATEGORIES: CampaignCategory[] = ["campaign", "experiment"];

export class AdminRouteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function computeCampaignStats(campaigns: MessagingCampaign[]): MessagingCampaignStats {
  const base: MessagingCampaignStats = {
    total: 0,
    draft: 0,
    scheduled: 0,
    active: 0,
    completed: 0,
  };

  return campaigns.reduce((acc, campaign) => {
    acc.total += 1;
    acc[campaign.status] += 1;
    return acc;
  }, { ...base });
}

export async function listCampaigns(limit = 200): Promise<MessagingCampaign[]> {
  const snapshot = await adminFirestore
    .collection(COLLECTION)
    .orderBy("lastUpdate", "desc")
    .limit(limit)
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(docToCampaign);
}

export async function createCampaign(payload: CampaignPayload): Promise<MessagingCampaign> {
  const nowIso = new Date().toISOString();
  const docRef = await adminFirestore.collection(COLLECTION).add({
    ...payload,
    impressions: null,
    clicks: null,
    lastUpdate: nowIso,
    createdAt: nowIso,
  });

  const savedDoc = await docRef.get();
  return docToCampaign(savedDoc);
}

export async function getCampaignSnapshot(campaignId: string) {
  const docRef = adminFirestore.collection(COLLECTION).doc(campaignId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new AdminRouteError("Campaña no encontrada", 404);
  }
  return snapshot;
}

export async function updateCampaign(
  campaignId: string,
  payload: CampaignPayload
): Promise<MessagingCampaign> {
  const docRef = adminFirestore.collection(COLLECTION).doc(campaignId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new AdminRouteError("Campaña no encontrada", 404);
  }

  await docRef.update({
    ...payload,
    lastUpdate: new Date().toISOString(),
  });

  const updatedDoc = await docRef.get();
  return docToCampaign(updatedDoc);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const docRef = adminFirestore.collection(COLLECTION).doc(campaignId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new AdminRouteError("Campaña no encontrada", 404);
  }

  await docRef.delete();
}

const MIGRATION_BATCH_SIZE = 200;

export async function migrateLegacyCampaigns(): Promise<number> {
  let migrated = 0;

  while (true) {
    const legacySnapshot = await adminFirestore
      .collection(LEGACY_COLLECTION)
      .limit(MIGRATION_BATCH_SIZE)
      .get();

    if (legacySnapshot.empty) {
      break;
    }

    for (const legacyDoc of legacySnapshot.docs) {
      const targetRef = adminFirestore.collection(COLLECTION).doc(legacyDoc.id);
      const targetSnap = await targetRef.get();
      const data = legacyDoc.data() ?? {};
      const nowIso = new Date().toISOString();

      if (!targetSnap.exists) {
        const normalizedData: Record<string, unknown> = { ...data };
        if (!normalizedData.lastUpdate) {
          normalizedData.lastUpdate = nowIso;
        }
        if (!normalizedData.createdAt) {
          normalizedData.createdAt = nowIso;
        }

        normalizedData.migratedAt = nowIso;
        normalizedData.migratedFrom = LEGACY_COLLECTION;

        await targetRef.set(normalizedData, { merge: true });
      }

      await legacyDoc.ref.delete();
      migrated += 1;
    }
  }

  return migrated;
}

export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    throw new AdminRouteError("Falta el encabezado Authorization", 401);
  }

  const decoded = await adminAuth.verifyIdToken(token).catch(() => {
    throw new AdminRouteError("Token inválido", 401);
  });

  const cmsDoc = await adminFirestore.doc(`cms-users/${decoded.uid}`).get();
  if (!cmsDoc.exists) {
    throw new AdminRouteError("No tienes acceso al CMS", 403);
  }

  const cmsData = cmsDoc.data() as { role?: string };
  if (cmsData.role !== "admin") {
    throw new AdminRouteError("Solo administradores pueden gestionar campañas", 403);
  }

  return decoded.uid;
}

function normalizeString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AdminRouteError(`El campo ${field} es obligatorio`, 400);
  }
  return value.trim();
}

function normalizeDate(value: unknown, field: string, required = true) {
  if (!value) {
    if (required) throw new AdminRouteError(`El campo ${field} es obligatorio`, 400);
    return null;
  }

  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    throw new AdminRouteError(`El campo ${field} es inválido`, 400);
  }
  return date.toISOString();
}

export interface CampaignPayload {
  name: string;
  description: string;
  status: CampaignStatus;
  startAt: string;
  endAt: string | null;
  segment: string;
  channel: CampaignChannel;
  category: CampaignCategory;
}

export function validatePayload(input: Partial<CampaignPayload>): CampaignPayload {
  const status = normalizeString(input.status, "status") as CampaignStatus;
  if (!ALLOWED_STATUS.includes(status)) {
    throw new AdminRouteError("Estado de campaña inválido", 400);
  }

  const channel = normalizeString(input.channel, "channel") as CampaignChannel;
  if (!ALLOWED_CHANNELS.includes(channel)) {
    throw new AdminRouteError("Canal de campaña inválido", 400);
  }

  const category = normalizeString(input.category, "category") as CampaignCategory;
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new AdminRouteError("Categoría de campaña inválida", 400);
  }

  return {
    name: normalizeString(input.name, "name"),
    description: normalizeString(input.description, "description"),
    segment: normalizeString(input.segment, "segment"),
    status,
    channel,
    category,
    startAt: normalizeDate(input.startAt, "startAt", true)!,
    endAt: normalizeDate(input.endAt, "endAt", false),
  };
}

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

export function docToCampaign(doc: FirebaseFirestore.DocumentSnapshot): MessagingCampaign {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: data.name ?? "",
    description: data.description ?? "",
    status: (data.status as CampaignStatus) ?? "draft",
    startAt: serializeDate(data.startAt) ?? new Date().toISOString(),
    endAt: serializeDate(data.endAt),
    segment: data.segment ?? "",
    lastUpdate: serializeDate(data.lastUpdate) ?? new Date().toISOString(),
    impressions: typeof data.impressions === "number" ? data.impressions : null,
    clicks: typeof data.clicks === "number" ? data.clicks : null,
    channel: (data.channel as CampaignChannel) ?? "push",
    category: (data.category as CampaignCategory) ?? "campaign",
    createdAt: serializeDate(data.createdAt),
    lastSentAt: serializeDate(data.lastSentAt),
    lastSentCount: typeof data.lastSentCount === "number" ? data.lastSentCount : null,
  };
}
