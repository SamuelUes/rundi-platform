import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SupabaseCardRow {
  id: string;
  user_id: string;
  local_card_id?: string | null;
  last_four_digits?: string | null;
  expiration_month?: number | null;
  expiration_year?: number | null;
  bank_name?: string | null;
  card_brand?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

type UserCardsParams = { userId?: string };

function isPromise<T>(value: any): value is Promise<T> {
  return Boolean(value) && typeof value.then === "function";
}

export async function GET(
  req: NextRequest,
  context: { params: UserCardsParams } | { params: Promise<UserCardsParams> }
) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const cmsDoc = await adminFirestore.doc(`cms-users/${uid}`).get();

    if (!cmsDoc.exists) {
      return NextResponse.json({ error: "No CMS access" }, { status: 403 });
    }

    const cmsData = cmsDoc.data() as { role?: string };

    if (cmsData.role !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden ver tarjetas" },
        { status: 403 }
      );
    }

    const resolvedParams = isPromise<UserCardsParams>(context.params)
      ? await context.params
      : (context.params as UserCardsParams);

    let userId = resolvedParams?.userId;
    if (!userId) {
      const segments = req.nextUrl.pathname.split("/").filter(Boolean);
      const usersIndex = segments.findIndex((segment) => segment === "users");
      if (usersIndex >= 0 && usersIndex + 1 < segments.length) {
        userId = segments[usersIndex + 1];
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const supabaseCards = await supabaseAdminGet<SupabaseCardRow>({
      table: "cards",
      select:
        "id,user_id,local_card_id,last_four_digits,expiration_month,expiration_year,bank_name,card_brand,is_default,is_active,created_at,updated_at",
      filters: { user_id: userId },
      limit: 100,
    });

    const cards = supabaseCards.map((card) => ({
      id: card.id,
      userId: card.user_id,
      localCardId: card.local_card_id ?? null,
      lastFourDigits: card.last_four_digits ?? null,
      expirationMonth:
        typeof card.expiration_month === "number" && Number.isFinite(card.expiration_month)
          ? card.expiration_month
          : null,
      expirationYear:
        typeof card.expiration_year === "number" && Number.isFinite(card.expiration_year)
          ? card.expiration_year
          : null,
      bankName: card.bank_name ?? null,
      cardBrand: card.card_brand ?? null,
      isDefault: Boolean(card.is_default),
      isActive: card.is_active !== false,
      createdAt: card.created_at ?? null,
      updatedAt: card.updated_at ?? null,
    }));

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error("[admin/users/:userId/cards] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar tarjetas" },
      { status: 500 }
    );
  }
}
