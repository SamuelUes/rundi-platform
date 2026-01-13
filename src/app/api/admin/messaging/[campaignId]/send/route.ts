import { NextRequest, NextResponse } from "next/server";
import { AdminRouteError, requireAdmin } from "@/app/api/admin/messaging/utils";
import { sendCampaignNow } from "@/lib/messaging/campaign-delivery";

export const dynamic = "force-dynamic";

async function getCampaignId(
  req: NextRequest,
  params?: { campaignId?: string } | Promise<{ campaignId?: string }>
) {
  const resolvedParams = params ? await Promise.resolve(params) : undefined;
  if (resolvedParams?.campaignId) return resolvedParams.campaignId;
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const messagingIndex = segments.findIndex((segment) => segment === "messaging");
  if (messagingIndex >= 0 && messagingIndex + 1 < segments.length) {
    return segments[messagingIndex + 1];
  }
  throw new AdminRouteError("campaignId requerido", 400);
}

export async function POST(
  req: NextRequest,
  context: { params: { campaignId?: string } | Promise<{ campaignId?: string }> }
) {
  try {
    await requireAdmin(req);
    const campaignId = await getCampaignId(req, context.params);
    const result = await sendCampaignNow(campaignId);
    return NextResponse.json({
      campaign: result.campaign,
      stats: {
        requestedTokens: result.requestedTokens,
        sentTokens: result.sentTokens,
        failedTokens: result.failedTokens,
        errors: result.errors,
      },
    });
  } catch (error) {
    if (error instanceof AdminRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/messaging/:id/send] Error", error);
    return NextResponse.json({ error: "Error interno al enviar la campaña" }, { status: 500 });
  }
}
