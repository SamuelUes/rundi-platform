"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

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
  registrationPhotoFront?: string | null;
  registrationPhotoBack?: string | null;
  insurancePhoto?: string | null;
  vehiclePhoto: string | null;
}

interface DesignatedDriverRow {
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
  licensePhotoFront?: string | null;
  licensePhotoBack?: string | null;
  profilePhoto: string | null;
  totalRides: number | null;
  averageRating: number | null;
  primaryVehicle: AdminVehicleRow | null;
  vehicles: AdminVehicleRow[];
  designatedRoleRequested: string | null;
  designatedStatus: "none" | "pending" | "approved" | "inactive";
}

type PriorityLevel = "urgent" | "needed" | "normal" | "low";

type ModalState =
  | { type: "none" }
  | { type: "driverDocs"; driver: DesignatedDriverRow }
  | { type: "vehicleDocs"; driver: DesignatedDriverRow; vehicle: AdminVehicleRow | null };

const PRIORITY_OPTIONS: Array<{ value: PriorityLevel; label: string; badge: string }> = [
  { value: "urgent", label: "Urgente", badge: "bg-red-100 text-red-700" },
  { value: "needed", label: "Necesaria", badge: "bg-amber-100 text-amber-700" },
  { value: "normal", label: "Normal", badge: "bg-emerald-100 text-emerald-700" },
  { value: "low", label: "Sin prisa", badge: "bg-zinc-100 text-zinc-600" },
];

export default function OperatorDriversRequestedPage() {
  const [drivers, setDrivers] = useState<DesignatedDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityByDriver, setPriorityByDriver] = useState<Record<string, PriorityLevel>>({});
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/designated-drivers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any));
          const msg = (body as any).error || "Error al cargar solicitudes.";
          setError(msg);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { drivers: DesignatedDriverRow[] };
        setDrivers(body.drivers || []);
        setLoading(false);
      } catch (err) {
        setError("Error al comunicar con el servidor.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drivers;

    return drivers.filter((d) => {
      const haystack = [
        d.driverId,
        d.userId,
        d.email,
        d.name,
        d.phone,
        d.department,
        d.municipality,
        d.accountStatus,
        d.documentsStatus,
        d.licenseNumber,
        d.primaryVehicle?.plate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [drivers, searchQuery]);

  function getPriorityBadge(driverId: string) {
    const priority = priorityByDriver[driverId] ?? "normal";
    return PRIORITY_OPTIONS.find((opt) => opt.value === priority) ?? PRIORITY_OPTIONS[2];
  }

  function openDriverDocsModal(driver: DesignatedDriverRow) {
    setModal({ type: "driverDocs", driver });
  }

  function openVehicleDocsModal(driver: DesignatedDriverRow, vehicle?: AdminVehicleRow | null) {
    const selected = vehicle ?? driver.primaryVehicle ?? driver.vehicles[0] ?? null;
    setModal({ type: "vehicleDocs", driver, vehicle: selected });
  }

  const modalOpen = modal.type !== "none";
  const modalDriver = modal.type === "none" ? null : modal.driver;
  const modalVehicle = modal.type === "vehicleDocs" ? modal.vehicle : null;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Solicitudes de conductores
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Vista de solo lectura para monitorear solicitudes del servicio de conductor designado.
        </p>
      </header>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Buscar solicitud
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, UID, placa o estado"
            className={`mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 ${themeColors.textPrimary}`}
          />
        </label>
        <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
          Solo lectura — los operadores no pueden aprobar o rechazar solicitudes.
        </p>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando solicitudes...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>{error}</p>
      )}

      {!loading && !error && filteredDrivers.length === 0 && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          No se encontraron solicitudes que coincidan con la búsqueda.
        </p>
      )}

      {!loading && !error && filteredDrivers.length > 0 && (
        <div className="grid gap-4">
          {filteredDrivers.map((driver) => {
            const priority = priorityByDriver[driver.driverId] ?? "normal";
            const badge = getPriorityBadge(driver.driverId);
            const primaryVehicle = driver.primaryVehicle ?? driver.vehicles[0] ?? null;

            return (
              <article
                key={driver.driverId}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">
                      {driver.name || driver.email || driver.userId}
                    </p>
                    <p className="text-xs text-zinc-600">UID: {driver.userId}</p>
                    <p className="text-xs text-zinc-600">
                      Contacto: {driver.phone || "(sin teléfono)"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Dept/Mun: {driver.department || "-"} / {driver.municipality || "-"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Vehículo: {primaryVehicle?.plate || "sin placa"} · {primaryVehicle?.brand || "Marca"} {primaryVehicle?.model || "Modelo"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`inline-flex items-center rounded-full px-3 py-0.5 font-semibold ${badge.badge}`}>
                      Prioridad: {badge.label}
                    </span>
                    <select
                      value={priority}
                      onChange={(e) =>
                        setPriorityByDriver((prev) => ({
                          ...prev,
                          [driver.driverId]: e.target.value as PriorityLevel,
                        }))
                      }
                      className="rounded-full border border-zinc-200 bg-white px-3 py-0.5 text-[11px] font-semibold text-zinc-600"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openDriverDocsModal(driver)}
                      className="rounded-full border border-zinc-200 px-3 py-0.5 text-[11px] font-semibold text-zinc-600 hover:border-zinc-400"
                    >
                      Docs conductor
                    </button>
                    {driver.vehicles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openVehicleDocsModal(driver, primaryVehicle)}
                        className="rounded-full border border-zinc-200 px-3 py-0.5 text-[11px] font-semibold text-zinc-600 hover:border-zinc-400"
                      >
                        Docs vehículo
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <section className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
                    <p className="font-semibold text-zinc-700">Estado de la cuenta</p>
                    <p>Cuenta: {driver.accountStatus ?? "pendiente"}</p>
                    <p>Documentos: {driver.documentsStatus ?? "pendiente"}</p>
                    <p>Licencia: {driver.licenseNumber ?? "sin número"} · {driver.licenseExpiry ?? "sin fecha"}</p>
                  </section>
                  <section className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
                    <p className="font-semibold text-zinc-700">Rol conductor designado</p>
                    <p>Solicitud: {driver.designatedRoleRequested ?? "sin registro"}</p>
                    <p>Estatus: {driver.designatedStatus}</p>
                    <p>
                      Métricas: {driver.totalRides ?? 0} viajes · Rating {driver.averageRating?.toFixed(2) ?? "N/D"}
                    </p>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className={`${typography.h2} ${themeColors.textPrimary}`}>
                  {modal.type === "driverDocs" ? "Documentos del conductor" : "Documentos del vehículo"}
                </h2>
                {modalDriver && (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>
                    {modalDriver.name || modalDriver.email || modalDriver.userId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: "none" })}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-600 hover:border-zinc-400"
              >
                Cerrar
              </button>
            </div>

            {modal.type === "driverDocs" && (
              <section className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Foto de perfil", url: modal.driver.profilePhoto },
                  { label: "Licencia (frontal)", url: modal.driver.licensePhotoFront },
                  { label: "Licencia (reverso)", url: modal.driver.licensePhotoBack },
                ].map((doc) => (
                  <article key={doc.label} className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-xs font-semibold text-zinc-700">{doc.label}</p>
                    {doc.url ? (
                      <img
                        src={doc.url}
                        alt={doc.label}
                        className="mt-2 h-48 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Sin documento cargado</p>
                    )}
                  </article>
                ))}
              </section>
            )}

            {modal.type === "vehicleDocs" && (
              <section className="mt-5 space-y-4">
                {modalDriver && modalDriver.vehicles.length > 1 && (
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Seleccionar vehículo
                    <select
                      value={modalVehicle?.id ?? ""}
                      onChange={(e) =>
                        setModal((prev) =>
                          prev.type === "vehicleDocs"
                            ? {
                                ...prev,
                                vehicle:
                                  prev.driver.vehicles.find((v) => v.id === e.target.value) ?? prev.vehicle,
                              }
                            : prev
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                    >
                      {modalDriver.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate || "Sin placa"} · {vehicle.brand || "Marca"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {modalVehicle ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { label: "Tarjeta circulación (frontal)", url: modalVehicle.registrationPhotoFront },
                      { label: "Tarjeta circulación (reverso)", url: modalVehicle.registrationPhotoBack },
                      { label: "Seguro", url: modalVehicle.insurancePhoto },
                      { label: "Foto del vehículo", url: modalVehicle.vehiclePhoto },
                    ].map((doc) => (
                      <article key={doc.label} className="rounded-xl border border-zinc-200 p-3">
                        <p className="text-xs font-semibold text-zinc-700">{doc.label}</p>
                        {doc.url ? (
                          <img
                            src={doc.url}
                            alt={doc.label}
                            className="mt-2 h-48 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <p className="mt-2 text-xs text-zinc-500">Sin documento cargado</p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>
                    No hay vehículos con documentos para mostrar.
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
