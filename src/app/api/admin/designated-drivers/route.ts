import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SupabaseVehicleRow {
  id: string;
  driver_id: string;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  type?: string | null;
  is_4x4?: boolean | null;
  is_active?: boolean | null;
  registration_number?: string | null;
  registration_expiry?: string | null;
  registration_photo_front?: string | null;
  registration_photo_back?: string | null;
  insurance_number?: string | null;
  insurance_company?: string | null;
  insurance_expiry?: string | null;
  insurance_photo?: string | null;
  vehicle_photo?: string | null;
}

interface SupabaseDesignatedDriverRow {
  id: string;
  user_id: string;
  profile_photo?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  license_photo_front?: string | null;
  license_photo_back?: string | null;
  account_status?: string | null;
  documents_status?: string | null;
  designated_rol_requested?: string | null;
  department?: string | null;
  municipality?: string | null;
  verified_at?: string | null;
  total_rides?: number | null;
  average_rating?: number | null;
  total_earnings?: number | null;
  vehicles?: SupabaseVehicleRow[];
}

interface DriverServiceRow {
  id: string;
  driver_id: string;
  service_id: string;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  approved_by?: string | null;
  approved_at?: string | null;
  assigned_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

interface ServiceRow {
  id: string;
  code: string;
  name: string;
}

interface AdminVehicleRow {
  id: string;
  plate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  type: string | null;
  is4x4: boolean;
  isActive: boolean;
  registrationNumber: string | null;
  registrationExpiry: string | null;
  registrationPhotoFront: string | null;
  registrationPhotoBack: string | null;
  insurancePhoto: string | null;
  vehiclePhoto: string | null;
}

interface DesignatedDriverAdminRow {
  driverId: string;
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  department: string | null;
  municipality: string | null;
  accountStatus: string | null;
  documentsStatus: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  hasLicensePhotos: boolean;
  licensePhotoFront: string | null;
  licensePhotoBack: string | null;
  profilePhoto: string | null;
  totalRides: number | null;
  averageRating: number | null;
  primaryVehicle: AdminVehicleRow | null;
  vehicles: AdminVehicleRow[];
  designatedRoleRequested: string | null;
  designatedStatus: "none" | "pending" | "approved" | "inactive";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function fetchAppUsersData(userIds: string[]) {
  const map: Record<string, { name: string | null; phone: string | null }> = {};
  if (!userIds.length) return map;

  const chunkSize = 300;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const refs = chunk.map((uid) => adminFirestore.doc(`users/${uid}`));
    if (!refs.length) continue;
    const snaps = await adminFirestore.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as { name?: string; phone?: string };
      map[snap.id] = {
        name: normalizeString(data?.name ?? null),
        phone: normalizeString(data?.phone ?? null),
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

    if (cmsData.role !== "admin" && cmsData.role !== "operator") {
      return NextResponse.json(
        { error: "Solo administradores u operadores pueden ver solicitudes de conductor designado" },
        { status: 403 }
      );
    }

    const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    // 1) Obtener drivers con vehículos
    const supabaseDrivers = await supabaseAdminGet<SupabaseDesignatedDriverRow>({
      table: "drivers",
      select:
        "id,user_id,profile_photo,license_number,license_expiry,license_photo_front,license_photo_back,account_status,documents_status,designated_rol_requested,department,municipality,verified_at,total_rides,average_rating,total_earnings,created_at,updated_at,vehicles(id,driver_id,plate,brand,model,year,color,type,is_4x4,is_active,registration_number,registration_expiry,registration_photo_front,registration_photo_back,insurance_number,insurance_company,insurance_expiry,insurance_photo,vehicle_photo)",
      limit: 500,
    });

    // 2) Cargar perfiles de Firebase Auth en bloques de 100
    const userIds = Array.from(
      new Set(
        supabaseDrivers
          .map((d) => d.user_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

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

    // 3) Obtener ID del servicio "designated_driver"
    const services = await supabaseAdminGet<ServiceRow>({
      table: "services",
      select: "id,code,name",
      filters: { code: "designated_driver" },
      limit: 1,
    });

    const designatedServiceId = services[0]?.id ?? null;

    let driverServices: DriverServiceRow[] = [];
    if (designatedServiceId) {
      driverServices = await supabaseAdminGet<DriverServiceRow>({
        table: "driver_services",
        select:
          "id,driver_id,service_id,is_active,is_approved,approved_by,approved_at,assigned_at,expires_at,notes",
        filters: { service_id: designatedServiceId },
        limit: 5000,
      });
    }

    const servicesByDriverId: Record<string, DriverServiceRow> = {};
    for (const ds of driverServices) {
      if (!ds.driver_id) continue;
      servicesByDriverId[ds.driver_id] = ds;
    }

    const rows: DesignatedDriverAdminRow[] = supabaseDrivers.map((d) => {
      const user = usersByUid[d.user_id];
      const appUser = appUsersByUid[d.user_id];
      const ds = servicesByDriverId[d.id];

      let designatedStatus: DesignatedDriverAdminRow["designatedStatus"] = "none";
      if (ds) {
        if (ds.is_approved) {
          designatedStatus = ds.is_active === false ? "inactive" : "approved";
        } else {
          designatedStatus = ds.is_active === false ? "inactive" : "pending";
        }
      }

      const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];

      const mappedVehicles: AdminVehicleRow[] = vehicles.map((v) => {
        return {
          id: v.id,
          plate: normalizeString(v.plate ?? null),
          brand: normalizeString(v.brand ?? null),
          model: normalizeString(v.model ?? null),
          year:
            typeof v.year === "number" && Number.isFinite(v.year) ? v.year : null,
          type: normalizeString(v.type ?? null),
          is4x4: Boolean(v.is_4x4),
          isActive: v.is_active !== false,
          registrationNumber: normalizeString(v.registration_number ?? null),
          registrationExpiry: normalizeString(v.registration_expiry ?? null),
          registrationPhotoFront: normalizeString(
            v.registration_photo_front ?? null
          ),
          registrationPhotoBack: normalizeString(v.registration_photo_back ?? null),
          insurancePhoto: normalizeString(v.insurance_photo ?? null),
          vehiclePhoto: normalizeString(v.vehicle_photo ?? null),
        };
      });

      const primaryVehicle =
        mappedVehicles.find((v) => v.isActive) || mappedVehicles[0] || null;

      const hasLicensePhotos = Boolean(
        (d.license_photo_front && d.license_photo_front.length > 0) ||
          (d.license_photo_back && d.license_photo_back.length > 0)
      );

      return {
        driverId: d.id,
        userId: d.user_id,
        email: normalizeString(user?.email ?? null),
        name: normalizeString(appUser?.name ?? user?.displayName ?? null),
        phone: normalizeString(appUser?.phone ?? user?.phoneNumber ?? null),
        department: normalizeString(d.department ?? null),
        municipality: normalizeString(d.municipality ?? null),
        accountStatus: normalizeString(d.account_status ?? null),
        documentsStatus: normalizeString(d.documents_status ?? null),
        designatedRoleRequested: normalizeString(d.designated_rol_requested ?? null),
        licenseNumber: normalizeString(d.license_number ?? null),
        licenseExpiry: normalizeString(d.license_expiry ?? null),
        licensePhotoFront: normalizeString(d.license_photo_front ?? null),
        licensePhotoBack: normalizeString(d.license_photo_back ?? null),
        profilePhoto: normalizeString(d.profile_photo ?? null),
        totalRides:
          typeof d.total_rides === "number" && Number.isFinite(d.total_rides)
            ? d.total_rides
            : null,
        averageRating:
          typeof d.average_rating === "number" &&
          Number.isFinite(d.average_rating)
            ? d.average_rating
            : null,
        hasLicensePhotos,
        primaryVehicle,
        vehicles: mappedVehicles,
        designatedStatus,
      };
    });

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [
            row.driverId,
            row.userId,
            row.email,
            row.name,
            row.phone,
            row.department,
            row.municipality,
            row.accountStatus,
            row.documentsStatus,
            row.licenseNumber,
            row.licenseExpiry,
            row.primaryVehicle?.plate,
            row.primaryVehicle?.brand,
            row.primaryVehicle?.model,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : rows;

    return NextResponse.json({ drivers: filtered });
  } catch (error: any) {
    console.error("[admin/designated-drivers] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar solicitudes de conductor designado" },
      { status: 500 }
    );
  }
}
