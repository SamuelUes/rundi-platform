import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SupabaseRideRow {
  id: string;
  firebase_ride_id?: string | null;
  client_id: string;
  driver_id?: string | null;
  status?: string | null;
  ride_type?: string | null;
  vehicle_type?: string | null;
  payment_type?: string | null;
  estimated_price?: any;
  final_fare?: any;
  passengers?: number | null;
  requested_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  service_id?: string | null;
  created_at?: string | null;
}

interface OperatorRideRow {
  id: string;
  firebaseRideId: string | null;
  clientId: string;
  driverId: string | null;
  status: string | null;
  rideType: string | null;
  vehicleType: string | null;
  paymentType: string | null;
  estimatedPrice: number | null;
  finalFare: number | null;
  passengers: number | null;
  requestedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  serviceId: string | null;
  createdAt: string | null;
}

function parseNumber(value: any): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isAllowedRole(role?: string | null) {
  return role === "admin" || role === "operator";
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

    if (!isAllowedRole(cmsData.role)) {
      return NextResponse.json(
        { error: "Rol insuficiente para listar viajes" },
        { status: 403 }
      );
    }

    const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    const supabaseRides = await supabaseAdminGet<SupabaseRideRow>({
      table: "rides",
      select:
        "id,firebase_ride_id,client_id,driver_id,status,ride_type,vehicle_type,payment_type,estimated_price,final_fare,passengers,requested_at,accepted_at,started_at,completed_at,canceled_at,cancel_reason,service_id,created_at",
      limit: 1000,
    });

    const rows: OperatorRideRow[] = supabaseRides.map((r) => ({
      id: r.id,
      firebaseRideId: r.firebase_ride_id ?? null,
      clientId: r.client_id,
      driverId: r.driver_id ?? null,
      status: r.status ?? null,
      rideType: r.ride_type ?? null,
      vehicleType: r.vehicle_type ?? null,
      paymentType: r.payment_type ?? null,
      estimatedPrice: parseNumber(r.estimated_price),
      finalFare: parseNumber(r.final_fare),
      passengers:
        typeof r.passengers === "number" && Number.isFinite(r.passengers)
          ? r.passengers
          : null,
      requestedAt: r.requested_at ?? null,
      acceptedAt: r.accepted_at ?? null,
      startedAt: r.started_at ?? null,
      completedAt: r.completed_at ?? null,
      canceledAt: r.canceled_at ?? null,
      cancelReason: r.cancel_reason ?? null,
      serviceId: r.service_id ?? null,
      createdAt: r.created_at ?? null,
    }));

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const withinLastMonth = rows.filter((row) => {
      const referenceIso = row.requestedAt ?? row.startedAt ?? row.completedAt ?? row.createdAt;
      if (!referenceIso) return false;
      const referenceDate = new Date(referenceIso);
      if (Number.isNaN(referenceDate.getTime())) return false;
      return referenceDate >= oneMonthAgo;
    });

    const filtered = search
      ? withinLastMonth.filter((row) => {
          const haystack = [
            row.id,
            row.firebaseRideId,
            row.clientId,
            row.driverId,
            row.status,
            row.rideType,
            row.vehicleType,
            row.paymentType,
            row.cancelReason,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : withinLastMonth;

    return NextResponse.json({ rides: filtered });
  } catch (error: any) {
    console.error("[operator/rides] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar viajes" },
      { status: 500 }
    );
  }
}
