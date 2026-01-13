import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

interface AreaRecord {
  id: string;
  name: string | null;
  countryCode: string | null;
}

interface LocationPoint {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface ActiveRideRecord {
  areaId: string;
  rideId: string;
  status: string | null;
  driverId: string | null;
  clientId: string | null;
  serviceType: string | null;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  extraDestinations: LocationPoint[];
  startedAt: number | null;
  updatedAt: number | null;
  estimatedPrice: number | null;
  finalFare: number | null;
  estimatedDistance: number | null;
  estimatedDuration: number | null;
  notes: string | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseNumberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractLocation(value: any): LocationPoint | null {
  if (!value) return null;

  if (typeof value === "string") {
    const normalized = normalizeString(value);
    if (!normalized) return null;
    return {
      address: normalized,
      lat: null,
      lng: null,
    };
  }

  const address =
    normalizeString(
      value.address ??
        value.label ??
        value.description ??
        value.formattedAddress ??
        value.name ??
        value.location ??
        value.text ??
        null
    ) ?? null;
  const lat = parseNumberField(value.lat ?? value.latitude);
  const lng = parseNumberField(value.lng ?? value.longitude);

  if (!address && lat == null && lng == null) {
    return null;
  }

  return {
    address,
    lat,
    lng,
  };
}

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

    let areaIds = [...assignedAreas];

    if (!areaIds.length) {
      const allAreasSnap = await adminDb.ref("activeRidesByArea").get();
      if (allAreasSnap.exists()) {
        allAreasSnap.forEach((child) => {
          if (child.key) {
            areaIds.push(child.key);
          }
          return false;
        });
      }
    }

    if (!areaIds.length) {
      return NextResponse.json({ areas: [], rides: [] });
    }

    const areasResult: AreaRecord[] = [];
    const ridesResult: ActiveRideRecord[] = [];

    for (const areaId of areaIds) {
      const areaSnap = await adminFirestore.doc(`service_areas/${areaId}`).get();
      if (areaSnap.exists) {
        const data = areaSnap.data() as { name?: string; countryCode?: string };
        areasResult.push({
          id: areaId,
          name: normalizeString(data.name ?? null),
          countryCode: normalizeString(data.countryCode ?? null),
        });
      } else {
        areasResult.push({ id: areaId, name: null, countryCode: null });
      }

      const ridesRef = adminDb.ref(`activeRidesByArea/${areaId}`);
      const ridesSnap = await ridesRef.get();

      if (!ridesSnap.exists()) {
        continue;
      }

      ridesSnap.forEach((child) => {
        const val = child.val() as any;
        const rideId = child.key as string;

        const origin =
          extractLocation(
            val?.origin ??
              val?.pickup ??
              val?.pickupLocation ??
              val?.pickupPoint ??
              val?.originAddress ??
              val?.pickupAddress ??
              val?.route?.origin ??
              null
          ) ??
          extractLocation(val?.driver?.origin);

        const destination =
          extractLocation(
            val?.destination ??
              val?.dropoff ??
              val?.dropoffLocation ??
              val?.dropoffPoint ??
              val?.destinationAddress ??
              val?.dropoffAddress ??
              val?.route?.destination ??
              null
          ) ??
          extractLocation(val?.driver?.destination);

        const extraDestinationsRaw =
          val?.extraDestinations ??
          val?.waypoints ??
          val?.stops ??
          val?.route?.extraDestinations ??
          null;

        const extraDestinations: LocationPoint[] = [];
        if (Array.isArray(extraDestinationsRaw)) {
          extraDestinationsRaw.forEach((item) => {
            const loc = extractLocation(item);
            if (loc) extraDestinations.push(loc);
          });
        } else if (extraDestinationsRaw && typeof extraDestinationsRaw === "object") {
          Object.values(extraDestinationsRaw).forEach((value) => {
            const loc = extractLocation(value);
            if (loc) extraDestinations.push(loc);
          });
        }

        const estimatedDistance =
          parseNumberField(val?.estimatedDistance) ??
          parseNumberField(val?.driver?.estimatedDistance);

        const estimatedDuration =
          parseNumberField(val?.estimatedDuration) ??
          parseNumberField(val?.driver?.estimatedDuration);

        const estimatedPrice =
          parseNumberField(val?.estimatedPrice) ??
          parseNumberField(val?.driver?.estimatedPrice) ??
          parseNumberField(val?.fare?.estimated);

        const finalFare =
          parseNumberField(val?.finalFare) ??
          parseNumberField(val?.fare?.final) ??
          parseNumberField(val?.fare?.total);

        ridesResult.push({
          areaId,
          rideId,
          status: normalizeString(val?.status ?? null),
          driverId: normalizeString(val?.driverId ?? null),
          clientId: normalizeString(val?.clientId ?? null),
          serviceType: normalizeString(val?.serviceType ?? null),
          origin,
          destination,
          extraDestinations,
          startedAt:
            typeof val?.startedAt === "number"
              ? val.startedAt
              : typeof val?.startedAt === "string"
              ? Date.parse(val.startedAt) || null
              : null,
          updatedAt:
            typeof val?.updatedAt === "number"
              ? val.updatedAt
              : typeof val?.updatedAt === "string"
              ? Date.parse(val.updatedAt) || null
              : null,
          estimatedPrice,
          finalFare,
          estimatedDistance,
          estimatedDuration,
          notes: normalizeString(val?.notes ?? null),
        });

        return false;
      });
    }

    return NextResponse.json({ areas: areasResult, rides: ridesResult });
  } catch (error) {
    console.error("[operator/active-rides] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
