import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminFirestore } from "@/lib/firebase-admin";
import {
  supabaseAdminGet,
  supabaseAdminInsert,
  supabaseAdminPatch,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface DriverServiceRow {
  id: string;
  driver_id: string;
  service_id: string;
  is_active?: boolean | null;
  is_approved?: boolean | null;
}

interface ServiceRow {
  id: string;
  code: string;
}

type ActionType =
  | "approveService"
  | "rejectService"
  | "approveDriverDocs"
  | "rejectDriverDocs"
  | "approveVehicleDocs"
  | "rejectVehicleDocs";

interface BasePayload {
  type: ActionType;
}

interface ServicePayload extends BasePayload {
  type: "approveService" | "rejectService";
  driverId: string;
}

interface DriverDocsPayload extends BasePayload {
  type: "approveDriverDocs" | "rejectDriverDocs";
  driverId: string;
}

interface VehicleDocsPayload extends BasePayload {
  type: "approveVehicleDocs" | "rejectVehicleDocs";
  vehicleId: string;
}

type Payload = ServicePayload | DriverDocsPayload | VehicleDocsPayload;

async function getDesignatedServiceId(): Promise<string | null> {
  const services = await supabaseAdminGet<ServiceRow>({
    table: "services",
    select: "id,code",
    filters: { code: "designated_driver" },
    limit: 1,
  });

  return services[0]?.id ?? null;
}

async function markRealtimeRequestAsVerified(
  driverId: string,
  userId?: string | null
) {
  if (!driverId) return;

  try {
    const tasks: Array<Promise<unknown>> = [];

    if (userId) {
      tasks.push(
        adminDb
          .ref(`designatedDriverRequests/${userId}`)
          .update({ status: "verified" })
          .catch((error) => {
            console.warn(
              "[designated-drivers/actions] No se pudo actualizar por UID en RTDB",
              error
            );
          })
      );
    }

    const snapshot = await adminDb
      .ref("designatedDriverRequests")
      .orderByChild("driverId")
      .equalTo(driverId)
      .get();

    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        tasks.push(child.ref.update({ status: "verified" }));
        return false;
      });
    }

    await Promise.all(tasks);
  } catch (error) {
    console.error(
      "[designated-drivers/actions] Error al sincronizar solicitud en RTDB",
      error
    );
  }
}

export async function POST(req: NextRequest) {
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
        { error: "Solo administradores pueden ejecutar acciones de conductor designado" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as Payload | null;

    if (!body || typeof body.type !== "string") {
      return NextResponse.json(
        { error: "Payload inválido" },
        { status: 400 }
      );
    }

    if (body.type === "approveService" || body.type === "rejectService") {
      const payload = body as ServicePayload;

      if (!payload.driverId) {
        return NextResponse.json(
          { error: "Falta driverId" },
          { status: 400 }
        );
      }

      const serviceId = await getDesignatedServiceId();

      if (!serviceId) {
        return NextResponse.json(
          { error: "Servicio designated_driver no encontrado" },
          { status: 500 }
        );
      }

      const current = await supabaseAdminGet<DriverServiceRow>({
        table: "driver_services",
        select: "id,driver_id,service_id,is_active,is_approved",
        filters: { driver_id: payload.driverId, service_id: serviceId },
        limit: 1,
      });

      const existing = current[0] ?? null;

      if (body.type === "approveService") {
        const nowIso = new Date().toISOString();

        if (existing) {
          await supabaseAdminPatch<DriverServiceRow>({
            table: "driver_services",
            values: {
              is_active: true,
              is_approved: true,
              approved_by: uid,
              approved_at: nowIso,
            },
            filters: { id: existing.id },
          });
        } else {
          await supabaseAdminInsert<DriverServiceRow>({
            table: "driver_services",
            values: {
              driver_id: payload.driverId,
              service_id: serviceId,
              is_active: true,
              is_approved: true,
              approved_by: uid,
              approved_at: nowIso,
              assigned_at: nowIso,
            },
          });
        }

        await supabaseAdminPatch({
          table: "drivers",
          values: {
            designated_rol_requested: "verified",
          },
          filters: { id: payload.driverId },
        });

        try {
          const driverRows = await supabaseAdminGet<{ id: string; user_id: string | null }>(
            {
              table: "drivers",
              select: "id,user_id",
              filters: { id: payload.driverId },
              limit: 1,
            }
          );

          const userId = driverRows[0]?.user_id;
          if (userId) {
            await adminFirestore.doc(`users/${userId}`).set(
              {
                role: "designated_driver",
              },
              { merge: true }
            );
          }

          await markRealtimeRequestAsVerified(payload.driverId, userId);
        } catch (firestoreError) {
          console.error("[designated-drivers/actions] Error al actualizar rol en Firestore", firestoreError);
        }

        return NextResponse.json({ status: "approved" });
      }

      if (body.type === "rejectService") {
        if (existing) {
          await supabaseAdminPatch<DriverServiceRow>({
            table: "driver_services",
            values: {
              is_active: false,
              is_approved: false,
            },
            filters: { id: existing.id },
          });
        }

        return NextResponse.json({ status: "rejected" });
      }
    }

    if (body.type === "approveDriverDocs" || body.type === "rejectDriverDocs") {
      const payload = body as DriverDocsPayload;

      if (!payload.driverId) {
        return NextResponse.json(
          { error: "Falta driverId" },
          { status: 400 }
        );
      }

      if (body.type === "approveDriverDocs") {
        const nowIso = new Date().toISOString();

        await supabaseAdminPatch({
          table: "drivers",
          values: {
            account_status: "active",
            documents_status: "verified",
            verified_at: nowIso,
          },
          filters: { id: payload.driverId },
        });

        return NextResponse.json({ status: "verified" });
      }

      if (body.type === "rejectDriverDocs") {
        await supabaseAdminPatch({
          table: "drivers",
          values: {
            account_status: "rejected",
            documents_status: "rejected",
            verified_at: null,
          },
          filters: { id: payload.driverId },
        });

        return NextResponse.json({ status: "rejected" });
      }
    }

    if (body.type === "approveVehicleDocs" || body.type === "rejectVehicleDocs") {
      const payload = body as VehicleDocsPayload;

      if (!payload.vehicleId) {
        return NextResponse.json(
          { error: "Falta vehicleId" },
          { status: 400 }
        );
      }

      if (body.type === "approveVehicleDocs") {
        await supabaseAdminPatch({
          table: "vehicles",
          values: {
            is_active: true,
          },
          filters: { id: payload.vehicleId },
        });

        return NextResponse.json({ status: "verified" });
      }

      if (body.type === "rejectVehicleDocs") {
        await supabaseAdminPatch({
          table: "vehicles",
          values: {
            is_active: false,
          },
          filters: { id: payload.vehicleId },
        });

        return NextResponse.json({ status: "rejected" });
      }
    }

    return NextResponse.json(
      { error: "Tipo de acción no soportado" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[admin/designated-drivers/actions] Error:", error);
    return NextResponse.json(
      { error: "Error interno al ejecutar acción" },
      { status: 500 }
    );
  }
}
