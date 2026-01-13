import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SupabaseDriverRow {
  id: string;
  user_id: string;
  license_number?: string | null;
  department?: string | null;
  municipality?: string | null;
  account_status?: string | null;
  documents_status?: string | null;
  average_rating?: number | null;
  total_rides?: number | null;
}

interface DriverServiceRow {
  driver_id: string;
  service_code: string;
}

interface AdminDriverRow {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  licenseNumber: string | null;
  accountStatus: string | null;
  documentsStatus: string | null;
  department: string | null;
  municipality: string | null;
  totalRides: number | null;
  averageRating: number | null;
  services: string[];
  hasDesignatedDriverService: boolean;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function fetchAppUsersData(userIds: string[]) {
  const map: Record<
    string,
    { name: string | null; phone: string | null; email: string | null }
  > = {};
  if (!userIds.length) return map;

  const chunkSize = 300;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const refs = chunk.map((uid) => adminFirestore.doc(`users/${uid}`));
    const snaps = await adminFirestore.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as { name?: string; phone?: string; email?: string };
      map[snap.id] = {
        name: normalizeString(data?.name ?? null),
        phone: normalizeString(data?.phone ?? null),
        email: normalizeString(data?.email ?? null),
      };
    });
  }

  return map;
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
        { error: "Solo administradores pueden listar conductores" },
        { status: 403 }
      );
    }

    const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    const supabaseDrivers = await supabaseAdminGet<SupabaseDriverRow>({
      table: "drivers",
      select:
        "id,user_id,license_number,department,municipality,account_status,documents_status,average_rating,total_rides,created_at",
      limit: 500,
    });

    const userIds = Array.from(
      new Set(
        supabaseDrivers
          .map((d) => d.user_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    // Cargar perfiles de Firebase Auth en bloques de 100
    const usersByUid: Record<string, import("firebase-admin/auth").UserRecord> = {};
    const chunkSize = 100;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const res = await adminAuth.getUsers(chunk.map((id) => ({ uid: id })));
      res.users.forEach((u) => {
        usersByUid[u.uid] = u;
      });
    }

    const appUsersByUid = await fetchAppUsersData(userIds);

    // Cargar servicios activos de conductores para detectar "conductor designado"
    const servicesRaw = await supabaseAdminGet<DriverServiceRow>({
      table: "driver_active_services",
      select: "driver_id,service_code",
      limit: 10000,
    });

    // En esta vista driver_id coincide con drivers.id (UUID del registro en la tabla drivers)
    const servicesByDriverId: Record<string, string[]> = {};
    for (const row of servicesRaw) {
      const driverId = row.driver_id;
      if (!driverId) continue;
      if (!servicesByDriverId[driverId]) servicesByDriverId[driverId] = [];
      if (
        row.service_code &&
        !servicesByDriverId[driverId].includes(row.service_code)
      ) {
        servicesByDriverId[driverId].push(row.service_code);
      }
    }

    const rows: AdminDriverRow[] = supabaseDrivers.map((d) => {
      const user = usersByUid[d.user_id];
      const appUser = appUsersByUid[d.user_id];
      const services = servicesByDriverId[d.id] ?? [];
      const hasDesignated = services.includes("designated_driver");

      return {
        id: d.id,
        userId: d.user_id,
        email: normalizeString(appUser?.email ?? user?.email ?? null),
        name: normalizeString(appUser?.name ?? user?.displayName ?? null),
        phone: normalizeString(appUser?.phone ?? user?.phoneNumber ?? null),
        licenseNumber: normalizeString(d.license_number ?? null),
        accountStatus: normalizeString(d.account_status ?? null),
        documentsStatus: normalizeString(d.documents_status ?? null),
        department: normalizeString(d.department ?? null),
        municipality: normalizeString(d.municipality ?? null),
        totalRides:
          typeof d.total_rides === "number" && Number.isFinite(d.total_rides)
            ? d.total_rides
            : null,
        averageRating:
          typeof d.average_rating === "number" && Number.isFinite(d.average_rating)
            ? d.average_rating
            : null,
        services,
        hasDesignatedDriverService: hasDesignated,
      };
    });

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [
            row.id,
            row.userId,
            row.email,
            row.name,
            row.phone,
            row.licenseNumber,
            row.department,
            row.municipality,
            row.accountStatus,
            row.documentsStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : rows;

    return NextResponse.json({ drivers: filtered });
  } catch (error: any) {
    console.error("[admin/drivers] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar conductores" },
      { status: 500 }
    );
  }
}
