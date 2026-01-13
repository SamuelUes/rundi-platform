import { NextRequest, NextResponse } from "next/server";
import {
  AdminRouteError,
  CampaignPayload,
  computeCampaignStats,
  createCampaign,
  listCampaigns,
  migrateLegacyCampaigns,
  requireAdmin,
  validatePayload,
} from "./utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    try {
      await migrateLegacyCampaigns();
    } catch (migrateError) {
      console.warn("[admin/messaging] migrateLegacyCampaigns error", migrateError);
    }

    const campaigns = await listCampaigns();
    const stats = computeCampaignStats(campaigns);

    return NextResponse.json({ campaigns, stats });
  } catch (error) {
    if (error instanceof AdminRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/messaging] GET error", error);
    return NextResponse.json({ error: "Error interno al obtener campañas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const payload = (await req.json().catch(() => null)) as Partial<CampaignPayload> | null;
    if (!payload) {
      throw new AdminRouteError("Body inválido", 400);
    }

    const validPayload = validatePayload(payload);
    const campaign = await createCampaign(validPayload);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/messaging] POST error", error);
    return NextResponse.json({ error: "Error interno al crear campaña" }, { status: 500 });
  }
}
