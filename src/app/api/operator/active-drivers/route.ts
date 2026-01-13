import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb, adminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const cmsDoc = await adminFirestore.doc(`cms-users/${uid}`).get();

    if (!cmsDoc.exists) {
      return NextResponse.json({ error: "No CMS access" }, { status: 403 });
    }

    const cmsData = cmsDoc.data() as {
      role?: string;
      assigned_service_areas?: unknown;
    };

    if (cmsData.role !== "operator" && cmsData.role !== "admin") {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const assignedRaw = cmsData.assigned_service_areas;
    const assignedAreas = Array.isArray(assignedRaw)
      ? (assignedRaw as string[])
      : [];

    if (!assignedAreas.length) {
      return NextResponse.json({ areas: [], drivers: [] });
    }

    const areasResult: Array<{
      id: string;
      name: string | null;
      countryCode: string | null;
    }> = [];

    const driversResult: Array<{
      areaId: string;
      driverId: string;
      status: string | null;
      currentRideId: string | null;
      lat: number | null;
      lng: number | null;
      lastUpdate: number | null;
    }> = [];

    for (const areaId of assignedAreas) {
      // Cargar metadatos del área desde Firestore
      const areaSnap = await adminFirestore.doc(`service_areas/${areaId}`).get();
      if (areaSnap.exists) {
        const data = areaSnap.data() as {
          name?: string;
          countryCode?: string;
        };
        areasResult.push({
          id: areaId,
          name: data.name ?? null,
          countryCode: data.countryCode ?? null,
        });
      } else {
        areasResult.push({ id: areaId, name: null, countryCode: null });
      }

      // Cargar ubicaciones de conductores por área desde RTDB
      const ref = adminDb.ref(`driverLocationsByArea/${areaId}`);
      const snap = await ref.get();

      if (!snap.exists()) {
        continue;
      }

      snap.forEach((child) => {
        const val = child.val() as any;
        const driverId = child.key as string;

        driversResult.push({
          areaId,
          driverId,
          status: typeof val.status === "string" ? val.status : null,
          currentRideId:
            typeof val.currentRideId === "string" ? val.currentRideId : null,
          lat:
            typeof val.lat === "number"
              ? val.lat
              : typeof val.latitude === "number"
              ? val.latitude
              : null,
          lng:
            typeof val.lng === "number"
              ? val.lng
              : typeof val.longitude === "number"
              ? val.longitude
              : null,
          lastUpdate:
            typeof val.lastUpdate === "number" ? val.lastUpdate : null,
        });

        return false;
      });
    }

    return NextResponse.json({ areas: areasResult, drivers: driversResult });
  } catch (error) {
    console.error("[active-drivers] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
