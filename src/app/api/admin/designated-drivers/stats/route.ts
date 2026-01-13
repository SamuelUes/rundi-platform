import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface DriverRow {
  id: string;
  user_id: string;
  profile_photo?: string | null;
  total_rides?: number | null;
  average_rating?: number | null;
}

interface RideRow {
  id: string;
  driver_id: string;
  created_at?: string | null;
}

interface RatingRow {
  id: string;
  to_user_id: string;
  rating: number;
  created_at?: string | null;
}

export async function GET(req: NextRequest) {
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
        { error: "Solo administradores pueden ver estadísticas de conductores" },
        { status: 403 }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Falta parámetro userId" },
        { status: 400 }
      );
    }

    const drivers = await supabaseAdminGet<DriverRow>({
      table: "drivers",
      select: "id,user_id,profile_photo,total_rides,average_rating,created_at",
      filters: { user_id: userId },
      limit: 1,
    });

    const driver = drivers[0];

    if (!driver) {
      return NextResponse.json(
        { error: "Conductor no encontrado" },
        { status: 404 }
      );
    }

    const rides = await supabaseAdminGet<RideRow>({
      table: "rides",
      select: "id,driver_id,created_at",
      filters: { driver_id: userId },
      limit: 10000,
    });

    const ratings = await supabaseAdminGet<RatingRow>({
      table: "ratings",
      select: "id,to_user_id,rating,created_at",
      filters: { to_user_id: userId },
      limit: 10000,
    });

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let lastWeekRides = 0;
    let lastMonthRides = 0;

    for (const ride of rides) {
      const ts = ride.created_at ? new Date(ride.created_at).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (ts >= weekAgo) lastWeekRides += 1;
      if (ts >= monthAgo) lastMonthRides += 1;
    }

    let totalRatings = 0;
    let sumRatings = 0;

    for (const r of ratings) {
      if (typeof r.rating === "number" && Number.isFinite(r.rating)) {
        totalRatings += 1;
        sumRatings += r.rating;
      }
    }

    const averageRatingComputed = totalRatings > 0 ? sumRatings / totalRatings : null;

    return NextResponse.json({
      driverId: driver.id,
      userId: driver.user_id,
      profilePhoto: driver.profile_photo ?? null,
      totalRides: driver.total_rides ?? null,
      averageRating: driver.average_rating ?? null,
      stats: {
        lastWeekRides,
        lastMonthRides,
        totalRatings,
        averageRatingComputed,
      },
    });
  } catch (error: any) {
    console.error("[admin/designated-drivers/stats] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar estadísticas de conductor" },
      { status: 500 }
    );
  }
}
