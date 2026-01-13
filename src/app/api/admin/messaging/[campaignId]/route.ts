import { NextRequest, NextResponse } from "next/server";
import {
  AdminRouteError,
  CampaignPayload,
  deleteCampaign,
  getCampaignSnapshot,
  requireAdmin,
  updateCampaign,
  validatePayload,
} from "../utils";

export const dynamic = "force-dynamic";

async function getCampaignId(
  req: NextRequest,
  params?: { campaignId?: string } | Promise<{ campaignId?: string }>
) {
  const resolvedParams = params ? await Promise.resolve(params) : undefined;
  if (resolvedParams?.campaignId) {
    return resolvedParams.campaignId;
  }
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const messagingIndex = segments.findIndex((segment) => segment === "messaging");
  if (messagingIndex >= 0 && messagingIndex + 1 < segments.length) {
    return segments[messagingIndex + 1];
  }
  throw new AdminRouteError("campaignId requerido", 400);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ campaignId?: string }> }
) {
  try {
    await requireAdmin(req);
    const campaignId = await getCampaignId(req, context.params);
    const payload = (await req.json().catch(() => null)) as Partial<CampaignPayload> | null;
    if (!payload) {
      throw new AdminRouteError("Body inválido", 400);
    }

    const validPayload = validatePayload(payload);
    const campaign = await updateCampaign(campaignId, validPayload);
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof AdminRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/messaging/:id] PATCH error", error);
    return NextResponse.json({ error: "Error interno al actualizar campaña" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ campaignId?: string }> }
) {
  try {
    await requireAdmin(req);
    const campaignId = await getCampaignId(req, context.params);
    await getCampaignSnapshot(campaignId);
    await deleteCampaign(campaignId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/messaging/:id] DELETE error", error);
    return NextResponse.json({ error: "Error interno al eliminar campaña" }, { status: 500 });
  }
}
