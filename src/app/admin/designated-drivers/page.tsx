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

interface DriverStats {
  driverId: string;
  userId: string;
  profilePhoto: string | null;
  totalRides: number | null;
  averageRating: number | null;
  stats: {
    lastWeekRides: number;
    lastMonthRides: number;
    totalRatings: number;
    averageRatingComputed: number | null;
  };
}

type ModalType =
  | { type: "none" }
  | { type: "profile"; driver: DesignatedDriverAdminRow }
  | { type: "driverDocs"; driver: DesignatedDriverAdminRow }
  | { type: "vehicleDocs"; driver: DesignatedDriverAdminRow; vehicle: AdminVehicleRow | null };

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/D";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return value.toFixed(2);
}

export default function AdminDesignatedDriversPage() {
  const [drivers, setDrivers] = useState<DesignatedDriverAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalType>({ type: "none" });
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showReviewed, setShowReviewed] = useState(false);
  const [statsByDriver, setStatsByDriver] = useState<Record<string, DriverStats | null>>({});
  const [inlineStatsLoading, setInlineStatsLoading] = useState<Record<string, boolean>>({});
  const [inlineStatsError, setInlineStatsError] = useState<Record<string, string | null>>({});
  const [statsVisibility, setStatsVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        setAuthToken(token);

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

        const body = (await res.json()) as { drivers: DesignatedDriverAdminRow[] };
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
        d.licenseExpiry,
        d.primaryVehicle?.plate,
        d.primaryVehicle?.brand,
        d.primaryVehicle?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [drivers, searchQuery]);

  const isPendingDriver = (driver: DesignatedDriverAdminRow) => {
    const accountReady = (driver.accountStatus ?? "").toLowerCase() === "active";
    const docsVerified = (driver.documentsStatus ?? "").toLowerCase() === "verified";
    const roleVerified = (driver.designatedRoleRequested ?? "").toLowerCase() === "verified";
    const hasActiveVehicle = driver.vehicles.some((vehicle) => vehicle.isActive);
    const designationApproved = driver.designatedStatus === "approved";

    const fullyApproved =
      accountReady && docsVerified && roleVerified && hasActiveVehicle && designationApproved;

    return !fullyApproved;
  };

  const pendingDrivers = useMemo(
    () => filteredDrivers.filter((driver) => isPendingDriver(driver)),
    [filteredDrivers]
  );

  const reviewedDrivers = useMemo(
    () => filteredDrivers.filter((driver) => !isPendingDriver(driver)),
    [filteredDrivers]
  );

  async function fetchDriverStatsData(userId: string) {
    if (!authToken) return null;
    try {
      const res = await fetch(
        `/api/admin/designated-drivers/stats?userId=${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!res.ok) {
        return null;
      }

      const body = (await res.json()) as DriverStats;
      setStatsByDriver((prev) => ({ ...prev, [userId]: body }));
      return body;
    } catch {
      return null;
    }
  }

  async function openProfileModal(driver: DesignatedDriverAdminRow) {
    setStats(null);
    setModal({ type: "profile", driver });
    if (!authToken) return;

    try {
      const cached = statsByDriver[driver.userId] ?? null;
      if (cached) {
        setStats(cached);
        return;
      }

      setLoadingStats(true);
      const body = await fetchDriverStatsData(driver.userId);
      if (body) {
        setStats(body);
      }
      setLoadingStats(false);
    } catch {
      setLoadingStats(false);
    }
  }

  function openDriverDocsModal(driver: DesignatedDriverAdminRow) {
    setActionError(null);
    setModal({ type: "driverDocs", driver });
  }

  function openVehicleDocsModal(
    driver: DesignatedDriverAdminRow,
    vehicle?: AdminVehicleRow | null
  ) {
    setActionError(null);
    const selectedVehicle = vehicle ?? driver.vehicles[0] ?? null;
    setModal({ type: "vehicleDocs", driver, vehicle: selectedVehicle });
  }

  function updateDriverInState(
    driverId: string,
    patch: Partial<DesignatedDriverAdminRow>
  ) {
    setDrivers((prev) =>
      prev.map((d) => (d.driverId === driverId ? { ...d, ...patch } : d))
    );
  }

  async function callAction(payload: any) {
    if (!authToken) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/designated-drivers/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        const msg = (body as any).error || "Error al ejecutar acción.";
        setActionError(msg);
        setActionLoading(false);
        return null;
      }

      const body = await res.json();
      setActionLoading(false);
      return body;
    } catch {
      setActionError("Error de red al ejecutar acción.");
      setActionLoading(false);
      return null;
    }
  }

  async function handleApproveService(driver: DesignatedDriverAdminRow) {
    const res = await callAction({
      type: "approveService",
      driverId: driver.driverId,
    });
    if (!res) return;
    updateDriverInState(driver.driverId, {
      designatedStatus: "approved",
      designatedRoleRequested: "verified",
    });
  }

  async function handleRejectService(driver: DesignatedDriverAdminRow) {
    const res = await callAction({
      type: "rejectService",
      driverId: driver.driverId,
    });
    if (!res) return;
    updateDriverInState(driver.driverId, { designatedStatus: "inactive" });
  }

  async function handleApproveDriverDocs(driver: DesignatedDriverAdminRow) {
    const res = await callAction({
      type: "approveDriverDocs",
      driverId: driver.driverId,
    });
    if (!res) return;
    updateDriverInState(driver.driverId, {
      accountStatus: "active",
      documentsStatus: "verified",
    });
    setModal({ type: "none" });
  }

  async function handleRejectDriverDocs(driver: DesignatedDriverAdminRow) {
    const res = await callAction({
      type: "rejectDriverDocs",
      driverId: driver.driverId,
    });
    if (!res) return;
    updateDriverInState(driver.driverId, {
      accountStatus: "rejected",
      documentsStatus: "rejected",
    });
    setModal({ type: "none" });
  }

  async function handleApproveVehicleDocs(
    driver: DesignatedDriverAdminRow,
    vehicle: AdminVehicleRow | null
  ) {
    if (!vehicle) return;
    const res = await callAction({
      type: "approveVehicleDocs",
      vehicleId: vehicle.id,
    });
    if (!res) return;

    setDrivers((prev) =>
      prev.map((d) => {
        if (d.driverId !== driver.driverId) return d;
        const vehicles = d.vehicles.map((v) =>
          v.id === vehicle.id ? { ...v, isActive: true } : v
        );
        const primaryVehicle =
          vehicles.find((v) => v.isActive) || vehicles[0] || null;
        return { ...d, vehicles, primaryVehicle };
      })
    );
    setModal({ type: "none" });
  }

  async function handleRejectVehicleDocs(
    driver: DesignatedDriverAdminRow,
    vehicle: AdminVehicleRow | null
  ) {
    if (!vehicle) return;
    const res = await callAction({
      type: "rejectVehicleDocs",
      vehicleId: vehicle.id,
    });
    if (!res) return;

    setDrivers((prev) =>
      prev.map((d) => {
        if (d.driverId !== driver.driverId) return d;
        const vehicles = d.vehicles.map((v) =>
          v.id === vehicle.id ? { ...v, isActive: false } : v
        );
        const primaryVehicle =
          vehicles.find((v) => v.isActive) || vehicles[0] || null;
        return { ...d, vehicles, primaryVehicle };
      })
    );
    setModal({ type: "none" });
  }

  const showModal = modal.type !== "none";

  async function toggleDriverStatsVisibility(driver: DesignatedDriverAdminRow) {
    const key = driver.userId;
    const nextVisible = !statsVisibility[key];
    setStatsVisibility((prev) => ({ ...prev, [key]: nextVisible }));

    if (!nextVisible) {
      return;
    }

    if (statsByDriver[key] || inlineStatsLoading[key]) {
      return;
    }

    setInlineStatsLoading((prev) => ({ ...prev, [key]: true }));
    setInlineStatsError((prev) => ({ ...prev, [key]: null }));
    const body = await fetchDriverStatsData(key);
    if (!body) {
      setInlineStatsError((prev) => ({ ...prev, [key]: "No se pudo cargar el resumen" }));
    }
    setInlineStatsLoading((prev) => ({ ...prev, [key]: false }));
  }

  const renderDriverCard = (driver: DesignatedDriverAdminRow) => {
    const primaryVehicle = driver.primaryVehicle ?? driver.vehicles[0] ?? null;
    const vehicleSummary = primaryVehicle
      ? `${primaryVehicle.plate ?? "Sin placa"} · ${primaryVehicle.brand ?? "Marca"} ${primaryVehicle.model ?? "Modelo"}`
      : "Sin vehículo principal";
    const driverDocsVerified =
      driver.accountStatus === "active" && driver.documentsStatus === "verified";
    const roleStatus = (driver.designatedRoleRequested ?? "pending").toLowerCase();
    const roleLabelMap: Record<string, string> = {
      pending: "Aún no solicitado",
      requested: "Solicitud enviada",
      verified: "Rol verificado",
      rejected: "Solicitud rechazada",
      revoked: "Rol revocado",
    };
    const roleLabel = roleLabelMap[roleStatus] ?? "Sin registro";
    const roleClassMap: Record<string, string> = {
      pending: "bg-zinc-100 text-zinc-600",
      requested: "bg-amber-100 text-amber-700",
      verified: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
      revoked: "bg-red-100 text-red-700",
    };
    const roleClass = roleClassMap[roleStatus] ?? "bg-zinc-100 text-zinc-600";
    const serviceBadge = (() => {
      if (roleStatus === "pending") {
        return {
          label: "Aún no solicitado",
          className: "bg-zinc-100 text-zinc-600",
        };
      }
      if (roleStatus === "requested") {
        return {
          label: "Solicitud en revisión",
          className: "bg-amber-100 text-amber-700",
        };
      }
      if (roleStatus === "rejected") {
        return {
          label: "Rol rechazado",
          className: "bg-red-100 text-red-700",
        };
      }
      if (roleStatus === "revoked") {
        return {
          label: "Rol revocado",
          className: "bg-red-100 text-red-700",
        };
      }

      const status = driver.designatedStatus;
      if (status === "approved") {
        return {
          label: "Aprobado",
          className: "bg-emerald-100 text-emerald-700",
        };
      }
      if (status === "inactive") {
        return {
          label: "Inactivo",
          className: "bg-zinc-200 text-zinc-700",
        };
      }
      if (status === "pending") {
        return {
          label: "Pendiente",
          className: "bg-amber-100 text-amber-700",
        };
      }
      return {
        label: "Sin solicitud",
        className: "bg-zinc-100 text-zinc-600",
      };
    })();
    const inlineStatsVisible = Boolean(statsVisibility[driver.userId]);
    const inlineStats = statsByDriver[driver.userId];
    const inlineLoading = inlineStatsLoading[driver.userId];
    const inlineError = inlineStatsError[driver.userId];

    return (
      <article
        key={driver.driverId}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{driver.name || driver.email || driver.userId}</p>
            <p className="text-xs text-zinc-700">UID: {driver.userId}</p>
            <p className="text-xs text-zinc-700">Dept/Mun: {driver.department || "-"} / {driver.municipality || "-"}</p>
            <p className="text-xs text-zinc-700">Vehículo principal: {vehicleSummary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => openProfileModal(driver)}
              className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-600 hover:border-zinc-400"
            >
              Ver perfil
            </button>
            <button
              type="button"
              onClick={() => openDriverDocsModal(driver)}
              className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-600 hover:border-zinc-400"
            >
              Docs conductor
            </button>
            <button
              type="button"
              onClick={() => openVehicleDocsModal(driver, primaryVehicle)}
              className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-600 hover:border-zinc-400"
            >
              Docs vehículo
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-600">Cuenta y documentos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-200 px-3 py-0.5 text-[11px] font-semibold text-zinc-700">
                Cuenta: {driver.accountStatus ?? "pending"}
              </span>
              <span className="rounded-full bg-zinc-200 px-3 py-0.5 text-[11px] font-semibold text-zinc-700">
                Docs: {driver.documentsStatus ?? "pending"}
              </span>
              {driverDocsVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="text-base leading-none">✓</span> Validado
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Licencia: {driver.licenseNumber || "sin número"} · {driver.licenseExpiry || "sin fecha"}
            </p>
          </section>

          <section className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-600">Vehículos</p>
            {driver.vehicles.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500">Sin vehículos registrados</p>
            )}
            {driver.vehicles.length > 0 && (
              <ul className="mt-2 space-y-2 text-xs text-zinc-600">
                {driver.vehicles.slice(0, 3).map((vehicle) => (
                  <li
                    key={vehicle.id}
                    className="flex items-center justify-between rounded-lg border border-white bg-white/70 px-3 py-1"
                  >
                    <div>
                      <p className="font-semibold text-zinc-900">{vehicle.plate || "Sin placa"}</p>
                      <p className="text-[11px] text-zinc-500">
                        {vehicle.brand || "Marca"} · {vehicle.model || "Modelo"} · {vehicle.isActive ? "Activo" : "Pendiente"}
                      </p>
                      {vehicle.isActive && (
                        <p className="text-[11px] font-semibold text-emerald-600">Docs validados</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openVehicleDocsModal(driver, vehicle)}
                      className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:border-zinc-400"
                    >
                      {vehicle.isActive ? "Ver docs · OK" : "Ver docs"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-linear-to-br from-amber-50 to-white p-3">
            <p className="text-xs font-semibold text-zinc-600">Servicio Conductor Designado</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${serviceBadge.className}`}
              >
                {serviceBadge.label}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${roleClass}`}>
                Rol Conductor Designado: {roleLabel}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleApproveService(driver)}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-600"
              >
                Aprobar Solicitud
              </button>
              <button
                type="button"
                onClick={() => handleRejectService(driver)}
                className="inline-flex items-center justify-center rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600"
              >
                Retractarse
              </button>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => toggleDriverStatsVisibility(driver)}
                className="inline-flex items-center rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:border-emerald-300 hover:text-emerald-800"
              >
                {inlineStatsVisible ? "Ocultar resumen" : "Ver resumen"}
              </button>
            </div>
            {inlineStatsVisible && (
              <div className="mt-3 rounded-xl border border-zinc-100 bg-white/80 p-3 text-xs text-zinc-600">
                {inlineLoading && <p>Cargando resumen...</p>}
                {!inlineLoading && inlineError && (
                  <p className="text-red-500">{inlineError}</p>
                )}
                {!inlineLoading && !inlineError && inlineStats && inlineStats.stats && (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-zinc-700">Viajes últ. semana</dt>
                      <dd>{inlineStats.stats.lastWeekRides}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-700">Viajes últ. mes</dt>
                      <dd>{inlineStats.stats.lastMonthRides}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-700">Calificaciones recibidas</dt>
                      <dd>{inlineStats.stats.totalRatings}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-700">Rating promedio (cálculo)</dt>
                      <dd>{formatRating(inlineStats.stats.averageRatingComputed)}</dd>
                    </div>
                  </dl>
                )}
                {!inlineLoading && !inlineError && !inlineStats && (
                  <p>No hay datos disponibles.</p>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-zinc-700">Notas rápidas</p>
            <p>Viajes totales: {driver.totalRides ?? "N/D"}</p>
            <p>Rating promedio: {formatRating(driver.averageRating)}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Próximos pasos</p>
            <p>1. Validar documentos y fotos.</p>
            <p>2. Aprobar solicitud de conductor designado cuando todo esté listo.</p>
          </div>
        </footer>
      </article>
    );
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Solicitudes de Conductor 
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Revisión de documentos de conductores y vehículos, y aprobación de
          servicio de conductor designado.
        </p>
      </header>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, email, UID, placa o municipio"
            className={`w-full rounded-md border px-3 py-2 text-sm outline-none ring-0 ${themeColors.surface} ${themeColors.inputBorder} ${themeColors.textPrimary}`}
          />
          <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
            La búsqueda aplica sobre: UID, email, nombre, teléfono, departamento,
            municipio, licencia y placa de vehículo.
          </p>
        </div>
        <div className="flex flex-col text-xs text-zinc-500 md:items-end">
          <p>Total filtrados: {filteredDrivers.length}</p>
          <p>Pendientes: {pendingDrivers.length} · Revisados: {reviewedDrivers.length}</p>
        </div>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando solicitudes...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>{error}</p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Pendientes por validar</p>
                <p className="text-xs text-zinc-500">
                  Documentos o servicio aún en revisión · {pendingDrivers.length} conductores
                </p>
              </div>
            </div>
            {pendingDrivers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
                No hay solicitudes pendientes.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingDrivers.map((driver) => renderDriverCard(driver))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Revisados</p>
                <p className="text-xs text-zinc-500">
                  Conductores con revisión finalizada (aprobados o rechazados) · {reviewedDrivers.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewed((prev) => !prev)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                {showReviewed ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showReviewed && (
              reviewedDrivers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
                  Aún no hay conductores revisados.
                </p>
              ) : (
                <div className="space-y-4">
                  {reviewedDrivers.map((driver) => renderDriverCard(driver))}
                </div>
              )
            )}
          </section>
        </div>
      )}

      {showModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${themeColors.overlaySoft}`}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={`${typography.h2} ${themeColors.textPrimary}`}>
                {modal.type === "profile"
                  ? "Perfil del conductor"
                  : modal.type === "driverDocs"
                  ? "Documentos del conductor"
                  : "Documentos del vehículo"}
              </h2>
              <button
                type="button"
                onClick={() => setModal({ type: "none" })}
                className={`rounded px-2 py-1 text-xs ${themeColors.textSecondary} ${themeColors.surfaceHover}`}
              >
                Cerrar
              </button>
            </div>

            {actionError && (
              <p className={`mb-2 text-xs ${themeColors.dangerText}`}>
                {actionError}
              </p>
            )}

            {modal.type === "profile" && (
              <div className="space-y-4 text-sm">
                <div className="flex gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-full bg-zinc-100">
                    {modal.driver.profilePhoto ? (
                      <img
                        src={modal.driver.profilePhoto}
                        alt="Foto de perfil"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className={`mb-1 text-xs font-bold ${themeColors.textMuted}`}>
                      {modal.driver.name || modal.driver.email || modal.driver.userId}
                    </div>
                    <div className={themeColors.textMuted}>{modal.driver.email}</div>
                    <div className={themeColors.textMuted}>{modal.driver.phone}</div>
                    <div className={themeColors.textMuted}>UID: {modal.driver.userId}</div>
                    <div>
                     <div className={themeColors.textMuted}> Dept/Mun: {modal.driver.department || "-"} / {" "}
                      {modal.driver.municipality || "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`rounded border p-3 ${themeColors.surfaceMuted}`}>
                    <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                      Resumen global
                    </div>
                    <div className={`space-y-0.5 text-xs ${themeColors.textSecondary}`}>
                      <div>Viajes totales: {modal.driver.totalRides ?? "N/D"}</div>
                      <div>
                        Rating promedio: {formatRating(modal.driver.averageRating)}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded border p-3 ${themeColors.surfaceMuted}`}>
                    <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                      Última semana / mes
                    </div>
                    {loadingStats && (
                      <p className={`text-xs ${themeColors.textSecondary}`}>
                        Cargando estadísticas...
                      </p>
                    )}
                    {!loadingStats && stats && (
                      <div className={`space-y-0.5 text-xs ${themeColors.textSecondary}`}>
                        <div>Viajes últ. semana: {stats.stats.lastWeekRides}</div>
                        <div>Viajes últ. mes: {stats.stats.lastMonthRides}</div>
                        <div>
                          Calificaciones recibidas: {stats.stats.totalRatings}
                        </div>
                        <div>
                          Rating promedio (cálculo):{" "}
                          {formatRating(stats.stats.averageRatingComputed)}
                        </div>
                      </div>
                    )}
                    {!loadingStats && !stats && (
                      <p className={`text-xs ${themeColors.textSecondary}`}>
                        No se encontraron estadísticas adicionales.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApproveService(modal.driver)}
                    className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentSuccessBg} ${themeColors.accentSuccessBorder} ${themeColors.accentSuccessHover} disabled:opacity-60`}
                  >
                    Verificar solicitud CD
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleRejectService(modal.driver)}
                    className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentDangerBg} ${themeColors.accentDangerBorder} ${themeColors.accentDangerHover} disabled:opacity-60`}
                  >
                    Rechazar solicitud
                  </button>
                </div>
              </div>
            )}

            {modal.type === "driverDocs" && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={`rounded border p-2 ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow} bg-white`}>
                    <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                      Foto de perfil
                    </div>
                    <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                      {modal.driver.profilePhoto ? (
                        <img
                          src={modal.driver.profilePhoto}
                          alt="Foto de perfil"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          Sin foto
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`rounded border p-2 ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow} bg-white`}>
                    <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                      Licencia (frente)
                    </div>
                    <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                      {modal.driver.licensePhotoFront ? (
                        <img
                          src={modal.driver.licensePhotoFront}
                          alt="Licencia frente"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          Sin foto
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`rounded border p-2 ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow} bg-white`}>
                    <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                      Licencia (reverso)
                    </div>
                    <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                      {modal.driver.licensePhotoBack ? (
                        <img
                          src={modal.driver.licensePhotoBack}
                          alt="Licencia reverso"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          Sin foto
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`space-y-0.5 text-xs ${themeColors.textSecondary}`}>
                  <div>Estado cuenta: {modal.driver.accountStatus || "pending"}</div>
                  <div>Docs: {modal.driver.documentsStatus || "pending"}</div>
                  <div>
                    Licencia: {modal.driver.licenseNumber || "N/D"} ({" "}
                    {modal.driver.licenseExpiry || "sin fecha"})
                  </div>
                  <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
                    Al validar, la cuenta quedará en estado <strong>active</strong>{" "}
                    y los documentos en estado <strong>verified</strong>.
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApproveDriverDocs(modal.driver)}
                    className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentSuccessBg} ${themeColors.accentSuccessBorder} ${themeColors.accentSuccessHover} disabled:opacity-60`}
                  >
                    Validar documentos
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleRejectDriverDocs(modal.driver)}
                    className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentDangerBg} ${themeColors.accentDangerBorder} ${themeColors.accentDangerHover} disabled:opacity-60`}
                  >
                    Rechazar documentos
                  </button>
                </div>
              </div>
            )}

            {modal.type === "vehicleDocs" && (
              <div className="space-y-4 text-sm">
                {modal.vehicle ? (
                  <>
                    <div className={`space-y-0.5 text-xs ${themeColors.textSecondary}`}>
                      <div className="font-medium">
                        {modal.vehicle.plate} - {modal.vehicle.brand}{" "}
                        {modal.vehicle.model}
                      </div>
                      <div>
                        Tipo: {modal.vehicle.type || "auto"} /{" "}
                        {modal.vehicle.is4x4 ? "4x4" : "No 4x4"}
                      </div>
                      <div>
                        Estado actual:{" "}
                        {modal.vehicle.isActive ? "Activo" : "Inactivo"}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className={`rounded border p-2 bg-white ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow}`}>
                        <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                          Foto vehículo
                        </div>
                        <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                          {modal.vehicle.vehiclePhoto ? (
                            <img
                              src={modal.vehicle.vehiclePhoto}
                              alt="Vehículo"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`rounded border p-2 bg-white ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow}`}>
                        <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                          Circulación (frente)
                        </div>
                        <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                          {modal.vehicle.registrationPhotoFront ? (
                            <img
                              src={modal.vehicle.registrationPhotoFront}
                              alt="Circulación frente"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`rounded border p-2 bg-white ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow}`}>
                        <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                          Circulación (reverso)
                        </div>
                        <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                          {modal.vehicle.registrationPhotoBack ? (
                            <img
                              src={modal.vehicle.registrationPhotoBack}
                              alt="Circulación reverso"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`rounded border p-2 bg-white ${themeColors.accentNeutralBorder} ${themeColors.accentNeutralShadow}`}>
                        <div className={`mb-1 text-xs font-medium ${themeColors.textSecondary}`}>
                          Póliza de seguro
                        </div>
                        <div className="h-32 w-full overflow-hidden rounded bg-zinc-100">
                          {modal.vehicle.insurancePhoto ? (
                            <img
                              src={modal.vehicle.insurancePhoto}
                              alt="Póliza"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
                      Al validar, el vehículo quedará con <strong>is_active = TRUE</strong>.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleApproveVehicleDocs(modal.driver, modal.vehicle)
                        }
                        className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentSuccessBg} ${themeColors.accentSuccessBorder} ${themeColors.accentSuccessHover} disabled:opacity-60`}
                      >
                        Validar vehículo
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleRejectVehicleDocs(modal.driver, modal.vehicle)
                        }
                        className={`inline-flex items-center rounded border px-3 py-1 text-[11px] font-medium ${themeColors.textOnAccent} ${themeColors.accentDangerBg} ${themeColors.accentDangerBorder} ${themeColors.accentDangerHover} disabled:opacity-60`}
                      >
                        Rechazar vehículo
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>
                    No hay vehículo asociado o no se encontraron fotos.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
