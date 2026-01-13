"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export interface RideRow {
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

export type RideSortField =
  | "requestedAt"
  | "startedAt"
  | "completedAt"
  | "id"
  | "status";

interface RideRoutePoint {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  locationType: string;
  locationOrder: number;
}

export interface RidesDashboardProps {
  title?: string;
  description?: string;
  listEndpoint?: string;
  routeEndpointBase?: string;
  hideRouteActions?: boolean;
  defaultFromDate?: string | null;
  defaultToDate?: string | null;
}

const DEFAULT_TITLE = "Viajes";
const DEFAULT_DESCRIPTION = "Historial de viajes registrado en Supabase (tabla rides).";
const DEFAULT_LIST_ENDPOINT = "/api/admin/rides";

const RIDE_STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  canceled: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

export function RidesDashboard({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  listEndpoint = DEFAULT_LIST_ENDPOINT,
  routeEndpointBase,
  hideRouteActions = false,
  defaultFromDate = null,
  defaultToDate = null,
}: RidesDashboardProps) {
  const routeBase = routeEndpointBase ?? listEndpoint;

  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<RideSortField>("completedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dateFilterDraft, setDateFilterDraft] = useState({
    from: defaultFromDate ?? "",
    to: defaultToDate ?? "",
  });
  const [dateFilter, setDateFilter] = useState<{ from: string | null; to: string | null }>(
    () => ({
      from: defaultFromDate ?? null,
      to: defaultToDate ?? null,
    })
  );
  const [routeModalRide, setRouteModalRide] = useState<RideRow | null>(null);
  const [routePoints, setRoutePoints] = useState<RideRoutePoint[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [routeSkippedMessage, setRouteSkippedMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch(listEndpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any));
          const msg = (body as any).error || "Error al cargar viajes.";
          setError(msg);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { rides: RideRow[] };
        setRides(body.rides || []);
        setLoading(false);
      } catch (err) {
        setError("Error al comunicar con el servidor.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [listEndpoint]);

  async function openRouteModal(ride: RideRow) {
    if (hideRouteActions) return;

    setRouteModalRide(ride);
    setRoutePoints([]);
    setRouteError(null);
    setMapsApiKey(null);
    setRouteSkippedMessage(null);
    setRouteLoading(true);

    try {
      const wasCancelledBeforeStart =
        (ride.status?.toLowerCase() === "canceled" || ride.status?.toLowerCase() === "cancelled") &&
        !ride.startedAt;

      if (wasCancelledBeforeStart) {
        setRouteSkippedMessage("No se realizó el viaje (cancelado antes de iniciar).");
        setRouteLoading(false);
        return;
      }

      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      }

      const token = await currentUser.getIdToken();
      const res = await fetch(`${routeBase}/${encodeURIComponent(ride.id)}/route`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "No se pudo cargar la ruta");
      }

      const body = (await res.json()) as {
        points: RideRoutePoint[];
        googleMapsApiKey: string | null;
      };

      setRoutePoints(body.points || []);
      setMapsApiKey(body.googleMapsApiKey ?? null);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRouteLoading(false);
    }
  }

  function closeRouteModal() {
    setRouteModalRide(null);
    setRoutePoints([]);
    setRouteError(null);
    setMapsApiKey(null);
    setRouteSkippedMessage(null);
    setRouteLoading(false);
  }

  const routeEmbedUrl = useMemo(() => {
    if (!mapsApiKey || routePoints.length < 2) return null;

    const origin = `${routePoints[0].lat},${routePoints[0].lng}`;
    const destination = `${routePoints[routePoints.length - 1].lat},${routePoints[routePoints.length - 1].lng}`;
    const waypointPoints = routePoints.slice(1, -1);
    const waypoints = waypointPoints.length
      ? `&waypoints=${encodeURIComponent(waypointPoints.map((p) => `${p.lat},${p.lng}`).join("|"))}`
      : "";

    return `https://www.google.com/maps/embed/v1/directions?key=${mapsApiKey}&origin=${origin}&destination=${destination}${waypoints}&mode=driving`;
  }, [mapsApiKey, routePoints]);

  const processedRides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromBound = dateFilter.from ? new Date(`${dateFilter.from}T00:00:00`).getTime() : null;
    const toBound = dateFilter.to ? new Date(`${dateFilter.to}T23:59:59`).getTime() : null;
    const filtered = q
      ? rides.filter((r) => {
          const haystack = [
            r.id,
            r.firebaseRideId,
            r.clientId,
            r.driverId,
            r.status,
            r.rideType,
            r.vehicleType,
            r.paymentType,
            r.cancelReason,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(q);
        })
      : rides;

    const filteredByDate = filtered.filter((ride) => {
      if (!fromBound && !toBound) return true;
      const referenceDate = ride.completedAt ?? ride.startedAt ?? ride.requestedAt;
      if (!referenceDate) return false;
      const rideTimestamp = new Date(referenceDate).getTime();
      if (Number.isNaN(rideTimestamp)) return false;
      if (fromBound && rideTimestamp < fromBound) return false;
      if (toBound && rideTimestamp > toBound) return false;
      return true;
    });

    const sorted = [...filteredByDate].sort((a, b) => {
      const valueA = getRideSortValue(a, sortField);
      const valueB = getRideSortValue(b, sortField);

      if (valueA === valueB) return 0;

      if (valueA === null || valueA === undefined) return sortDirection === "asc" ? 1 : -1;
      if (valueB === null || valueB === undefined) return sortDirection === "asc" ? -1 : 1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      const stringA = String(valueA).toLowerCase();
      const stringB = String(valueB).toLowerCase();
      if (stringA === stringB) return 0;
      const comparison = stringA < stringB ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [rides, searchQuery, sortField, sortDirection, dateFilter]);

  function getRideSortValue(ride: RideRow, field: RideSortField) {
    if (field === "id") return ride.id;
    if (field === "status") return ride.status ?? null;

    const dateSource =
      field === "requestedAt"
        ? ride.requestedAt
        : field === "startedAt"
        ? ride.startedAt
        : ride.completedAt ?? ride.startedAt ?? ride.requestedAt;

    if (!dateSource) return null;
    const timestamp = new Date(dateSource).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function handleRideSort(field: RideSortField, direction: "asc" | "desc") {
    setSortField(field);
    setSortDirection(direction);
  }

  function renderRideSortButtons(field: RideSortField, label: string) {
    const isAsc = sortField === field && sortDirection === "asc";
    const isDesc = sortField === field && sortDirection === "desc";
    const baseBtn = "leading-none text-[10px]";

    return (
      <span className="ml-1 flex flex-col">
        <button
          type="button"
          aria-label={`Orden ascendente por ${label}`}
          className={`${baseBtn} ${isAsc ? themeColors.textPrimary : themeColors.textMuted}`}
          onClick={() => handleRideSort(field, "asc")}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Orden descendente por ${label}`}
          className={`${baseBtn} ${isDesc ? themeColors.textPrimary : themeColors.textMuted}`}
          onClick={() => handleRideSort(field, "desc")}
        >
          ▼
        </button>
      </span>
    );
  }

  function applyDateFilter() {
    setDateFilter({
      from: dateFilterDraft.from || null,
      to: dateFilterDraft.to || null,
    });
  }

  function clearDateFilter() {
    setDateFilterDraft({ from: "", to: "" });
    setDateFilter({ from: null, to: null });
  }

  const isDateFilterActive = Boolean(dateFilter.from || dateFilter.to);
  const activeDateRangeLabel = isDateFilterActive
    ? dateFilter.from && dateFilter.to
      ? `${dateFilter.from} a ${dateFilter.to}`
      : dateFilter.from ?? dateFilter.to ?? ""
    : "";

  const summary = useMemo(() => {
    return rides.reduce(
      (acc, ride) => {
        acc.total += 1;
        if ((ride.status ?? "").toLowerCase() === "completed") {
          acc.completed += 1;
        }
        if ((ride.status ?? "").toLowerCase().startsWith("cancel")) {
          acc.canceled += 1;
        }
        acc.revenue += ride.finalFare ?? 0;
        if (!ride.completedAt) {
          acc.inProgress += 1;
        }
        return acc;
      },
      { total: 0, completed: 0, canceled: 0, revenue: 0, inProgress: 0 }
    );
  }, [rides]);

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>{title}</h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>{description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RideSummaryCard label="Viajes" value={summary.total} detail="Totales" />
        <RideSummaryCard label="Completados" value={summary.completed} detail="Finalizados" variant="success" />
        <RideSummaryCard label="Cancelados" value={summary.canceled} detail="Sin completar" variant="danger" />
        <RideSummaryCard label="Ingresos" value={summary.revenue} detail="Tarifa final" format="money" />
      </div>

      <div className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Búsqueda rápida</p>
            <div className="mt-2 flex w-full items-center gap-2">
              <div className="relative flex-1 md:max-w-sm">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">🔍</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por ID, cliente, conductor, estado o tipo"
                  className={`w-full rounded-xl border bg-white pl-9 pr-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 ${themeColors.textPrimary}`}
                />
              </div>
            </div>
            <p className={`mt-2 text-xs ${themeColors.textMuted}`}>
              Tip: escribe "cancel" o "cash" para filtrar rápidamente por estado o método de pago.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Filtrar por fecha</p>
              {isDateFilterActive && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {activeDateRangeLabel}
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[{ label: "Desde", key: "from", value: dateFilterDraft.from }, { label: "Hasta", key: "to", value: dateFilterDraft.to }].map(
                (field) => (
                  <label key={field.key} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {field.label}
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">📅</span>
                      <input
                        type="date"
                        value={field.value}
                        onChange={(e) => setDateFilterDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
                      />
                    </div>
                  </label>
                )
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyDateFilter}
                className="inline-flex items-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={clearDateFilter}
                className="inline-flex items-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Limpiar
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Selecciona una sola fecha para ver ese día o completa ambos campos para un rango.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-zinc-800">{processedRides.length} viajes visibles</p>
            <p>Ordena usando las flechas de cada columna.</p>
          </div>
          {!isDateFilterActive && (
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-500">
              Sin filtros de fecha activos
            </span>
          )}
          {isDateFilterActive && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              Rango aplicado: {activeDateRangeLabel}
            </span>
          )}
        </div>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>Cargando viajes...</p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>{error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-3xl border border-zinc-100 bg-white shadow-xl">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-zinc-50/70">
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Viaje</span>
                    {renderRideSortButtons("id", "ID de viaje")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">Cliente / Conductor</th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    {renderRideSortButtons("status", "estado")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium text-center">Pasajeros</th>
                <th className="px-3 py-2 font-medium">Pago y montos</th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Solicitado</span>
                    {renderRideSortButtons("requestedAt", "fecha solicitada")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Iniciado</span>
                    {renderRideSortButtons("startedAt", "fecha iniciada")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Finalizado</span>
                    {renderRideSortButtons("completedAt", "fecha finalizada")}
                  </div>
                </th>
                {!hideRouteActions && <th className="px-3 py-2 font-medium text-center">Mapa</th>}
              </tr>
            </thead>
            <tbody>
              {processedRides.map((r, index) => (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-100 last:border-0 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}`}
                >
                  <td className="px-4 py-3 align-top text-sm text-zinc-900">
                    <div className="space-y-1">
                      <p className="font-semibold text-zinc-900">{r.id}</p>
                      <div className="flex flex-wrap gap-1 text-[11px] text-zinc-500">
                        <span className="rounded-full border border-zinc-200 px-2 py-0.5">
                          Firebase: {r.firebaseRideId || "N/D"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${rideStatusBadge(r.status)}`}
                        >
                          {r.status || "Sin estado"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">Cliente: {r.clientId}</p>
                      <p>Conductor: {r.driverId || "(sin asignar)"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <p>Tipo: {r.rideType || "normal"}</p>
                      <p>Vehículo: {r.vehicleType || "auto"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-center text-sm font-semibold text-zinc-900">
                    {r.passengers ?? "N/D"}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1 rounded-xl bg-zinc-50/80 px-3 py-2">
                      <p className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                        <span>Pago</span>
                        <span>{r.paymentType || "N/D"}</span>
                      </p>
                      <p className="flex items-center justify-between text-xs">
                        <span>Estimado</span>
                        <span>{formatMoney(r.estimatedPrice)}</span>
                      </p>
                      <p className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                        <span>Final</span>
                        <span>{formatMoney(r.finalFare)}</span>
                      </p>
                      {r.cancelReason && (
                        <p className="text-[11px] text-red-500">Motivo: {r.cancelReason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <p className="text-xs font-medium">{formatDate(r.requestedAt)}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <p className="text-xs font-medium">{formatDate(r.startedAt)}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <p className="text-xs font-medium">{formatDate(r.completedAt)}</p>
                  </td>
                  {!hideRouteActions && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openRouteModal(r)}
                        className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      >
                        Ver viaje
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hideRouteActions && routeModalRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className={`${typography.h2} ${themeColors.textPrimary} pt-6 pl-6`}>
                    Ruta del viaje
                  </h2>
                  <p className={`${typography.body} ${themeColors.textSecondary} pl-6`}>
                    Viaje ID: {routeModalRide.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeRouteModal}
                  className={`mr-6 mt-6 rounded-md px-3 py-1 text-sm font-medium ${themeColors.surfaceHover} ${themeColors.textSecondary}`}
                >
                  Cerrar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {routeLoading && (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>Cargando ruta...</p>
                )}

                {!routeLoading && routeSkippedMessage && (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>{routeSkippedMessage}</p>
                )}

                {!routeLoading && !routeSkippedMessage && routeError && (
                  <p className={`${typography.body} ${themeColors.dangerText}`}>{routeError}</p>
                )}

                {!routeLoading && !routeSkippedMessage && !routeError && routePoints.length === 0 && (
                  <p className={`${typography.body} ${themeColors.textSecondary}`}>
                    No se encontraron ubicaciones registradas para este viaje.
                  </p>
                )}

                {!routeLoading && !routeSkippedMessage && !routeError && routePoints.length > 0 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border bg-gray-50/80 p-3 shadow-inner">
                      {routeEmbedUrl ? (
                        <iframe
                          title="Mapa del viaje"
                          src={routeEmbedUrl}
                          className="h-[55vh] w-full rounded-xl border"
                          loading="lazy"
                          allowFullScreen
                        />
                      ) : (
                        <p className={`${typography.body} ${themeColors.textSecondary}`}>
                          No se pudo generar el mapa. Verifica que exista al menos un origen y destino y que la clave de Google Maps sea válida.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className={`${typography.body} ${themeColors.textPrimary} font-semibold`}>
                            Paradas registradas
                          </p>
                          <p className={`text-xs ${themeColors.textSecondary}`}>
                            Origen, waypoints y destino en orden cronológico
                          </p>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                          {routePoints.length}
                        </span>
                      </div>

                      <div className="max-h-[32vh] space-y-3 overflow-y-auto pr-1">
                        {routePoints.map((point) => (
                          <div
                            key={point.id}
                            className="rounded-xl border border-zinc-100 bg-linear-to-r from-white to-zinc-50 px-4 py-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                {point.locationType} #{point.locationOrder}
                              </p>
                              <span className="text-[10px] font-semibold text-zinc-400">
                                {point.lat.toFixed(2)}, {point.lng.toFixed(2)}
                              </span>
                            </div>
                            <p className={`mt-1 text-sm font-medium ${themeColors.textPrimary}`}>
                              {point.address || `${point.lat}, ${point.lng}`}
                            </p>
                            <p className={`text-xs ${themeColors.textMuted}`}>
                              Lat/Lng: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function rideStatusBadge(status: string | null) {
  if (!status) return "bg-zinc-100 text-zinc-600 border-zinc-200";
  return RIDE_STATUS_STYLES[status.toLowerCase()] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
}

function formatDate(value: string | null): string {
  if (!value) return "N/D";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatMoney(value: number | null): string {
  if (value === null) return "N/D";
  return `${value.toFixed(2)} C$`;
}

function RideSummaryCard({
  label,
  value,
  detail,
  format,
  variant = "default",
}: {
  label: string;
  value: number;
  detail: string;
  format?: "money";
  variant?: "default" | "success" | "danger";
}) {
  const isMoney = format === "money";
  const palette: Record<string, string> = {
    default: "bg-white border-zinc-100 text-zinc-900",
    success: "bg-emerald-50 border-emerald-100 text-emerald-800",
    danger: "bg-red-50 border-red-100 text-red-800",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${palette[variant]}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold">
        {isMoney
          ? `${value.toLocaleString("es-NI", { minimumFractionDigits: 2 })} C$`
          : value.toLocaleString("es-NI")}
      </p>
      <p className="text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
