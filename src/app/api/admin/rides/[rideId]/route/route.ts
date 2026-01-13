import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

interface RideLocationRow {
  id: string;
  ride_id: string;
  location_type?: string | null;
  location_order?: number | null;
  latitude?: any;
  longitude?: any;
  address?: string | null;
}

interface RideRoutePoint {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  locationType: string;
  locationOrder: number;
}

function parseCoordinate(value: any): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const dynamic = "force-dynamic";

type RideRouteParams = { rideId?: string };
type RideRouteContext = { params: Promise<RideRouteParams> };

export async function GET(
  req: NextRequest,
  context: RideRouteContext
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

    if (cmsData.role !== "admin" && cmsData.role !== "operator") {
      return NextResponse.json(
        { error: "Solo administradores u operadores pueden ver rutas" },
        { status: 403 }
      );
    }

    const paramsValue = await context.params;

    let rideId = paramsValue?.rideId;
    if (!rideId) {
      const segments = req.nextUrl.pathname.split("/").filter(Boolean);
      const ridesIndex = segments.findIndex((segment) => segment === "rides");
      if (ridesIndex >= 0 && ridesIndex + 1 < segments.length) {
        rideId = segments[ridesIndex + 1];
      }
    }
    
    if (!rideId) {
      return NextResponse.json({ error: "rideId requerido" }, { status: 400 });
    }

    const locations = await supabaseAdminGet<RideLocationRow>({
      table: "ride_locations",
      select:
        "id,ride_id,location_type,location_order,latitude,longitude,address",
      filters: {
        ride_id: rideId,
      },
      limit: 200,
    });

    const points: RideRoutePoint[] = locations
      .map((loc) => {
        const lat = parseCoordinate(loc.latitude);
        const lng = parseCoordinate(loc.longitude);
        const locationOrder =
          typeof loc.location_order === "number"
            ? loc.location_order
            : Number(loc.location_order ?? 0);

        if (lat === null || lng === null) {
          return null;
        }

        return {
          id: loc.id,
          lat,
          lng,
          address: loc.address ?? null,
          locationType: loc.location_type ?? "unknown",
          locationOrder,
        };
      })
      .filter((point): point is RideRoutePoint => Boolean(point))
      .sort((a, b) => a.locationOrder - b.locationOrder);

    return NextResponse.json({
      points,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? null,
    });
  } catch (error) {
    console.error("[admin/rides/:id/route] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar la ruta" },
      { status: 500 }
    );
  }
}
