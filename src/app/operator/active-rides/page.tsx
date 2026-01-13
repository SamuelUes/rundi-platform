"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

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

const STATUS_COLORS: Record<string, string> = {
  searching: "bg-amber-100 text-amber-700",
  assigned: "bg-blue-100 text-blue-700",
  en_route: "bg-indigo-100 text-indigo-700",
  started: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-200 text-emerald-800",
  canceled: "bg-red-100 text-red-700",
};

function formatTimestamp(value: number | null): string {
  if (!value) return "N/D";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleString();
}

export default function ActiveRidesPage() {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [rides, setRides] = useState<ActiveRideRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/operator/active-rides", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = body.error || "Error al cargar viajes activos.";
          setError(message);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as {
          areas: AreaRecord[];
          rides: ActiveRideRecord[];
        };

        setAreas(body.areas || []);
        setRides(body.rides || []);
        setLoading(false);
      } catch (err) {
        setError("Error al comunicar con el servidor.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const ridesByArea = useMemo(() => {
    const grouped: Record<string, ActiveRideRecord[]> = {};
    rides.forEach((ride) => {
      if (searchQuery) {
        const haystack = [
          ride.rideId,
          ride.status,
          ride.driverId,
          ride.clientId,
          ride.origin?.address,
          ride.destination?.address,
          ...ride.extraDestinations.map((d) => d.address),
          ride.serviceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(searchQuery.trim().toLowerCase())) {
          return;
        }
      }

      if (!grouped[ride.areaId]) grouped[ride.areaId] = [];
      grouped[ride.areaId].push(ride);
    });
    return grouped;
  }, [rides, searchQuery]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Viajes activos
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Seguimiento en tiempo (casi) real de los viajes que siguen en proceso.
        </p>
      </header>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Buscar viaje activo
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por ID, conductor, cliente o dirección"
            className={`mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 ${themeColors.textPrimary}`}
          />
        </label>
        <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
          Los datos provienen de la rama activeRidesByArea del Realtime Database.
        </p>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando viajes activos...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>{error}</p>
      )}

      {!loading && !error && areas.length === 0 && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          No tienes áreas asignadas, por lo que no se muestran viajes activos.
        </p>
      )}

      {!loading && !error && areas.length > 0 && (
        <div className="space-y-6">
          {areas.map((area) => {
            const areaRides = ridesByArea[area.id] || [];
            return (
              <article key={area.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {area.name || area.id}
                    </h2>
                    <p className="text-xs text-zinc-600">País: {area.countryCode || "N/D"}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                    Viajes activos: {areaRides.length}
                  </span>
                </div>

                {areaRides.length === 0 ? (
                  <p className={`text-xs ${themeColors.textMuted}`}>
                    No hay viajes activos en esta área en este momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {areaRides.map((ride) => {
                      const key = ride.status?.toLowerCase() ?? "";
                      const badge = STATUS_COLORS[key] ?? "bg-zinc-100 text-zinc-600";
                      return (
                        <div key={`${ride.areaId}-${ride.rideId}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">{ride.rideId}</p>
                              <p className="text-xs text-zinc-600">
                                Servicio: {ride.serviceType || "general"}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
                              {ride.status || "Sin estado"}
                            </span>
                          </div>
                          <dl className="mt-3 grid gap-2 text-xs text-zinc-600 md:grid-cols-2">
                            <div>
                              <dt className="font-semibold text-zinc-700">Conductor</dt>
                              <dd>{ride.driverId || "(sin asignar)"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Pasajero</dt>
                              <dd>{ride.clientId || "(sin datos)"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Origen</dt>
                              <dd>
                                {ride.origin?.address || "N/D"}
                                {ride.origin?.lat != null && ride.origin?.lng != null && (
                                  <span className="block text-[10px] text-zinc-400">
                                    {ride.origin.lat.toFixed(5)}, {ride.origin.lng.toFixed(5)}
                                  </span>
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Destino</dt>
                              <dd>
                                {ride.destination?.address || "N/D"}
                                {ride.destination?.lat != null && ride.destination?.lng != null && (
                                  <span className="block text-[10px] text-zinc-400">
                                    {ride.destination.lat.toFixed(5)}, {ride.destination.lng.toFixed(5)}
                                  </span>
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Precio estimado</dt>
                              <dd>{ride.estimatedPrice != null ? `${ride.estimatedPrice} C$` : "N/D"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Precio final</dt>
                              <dd>{ride.finalFare != null ? `${ride.finalFare} C$` : "N/D"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Inicio</dt>
                              <dd>{formatTimestamp(ride.startedAt)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Última actualización</dt>
                              <dd>{formatTimestamp(ride.updatedAt)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Distancia estimada</dt>
                              <dd>
                                {ride.estimatedDistance != null
                                  ? `${(ride.estimatedDistance / 1000).toFixed(2)} km`
                                  : "N/D"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-700">Duración estimada</dt>
                              <dd>
                                {ride.estimatedDuration != null
                                  ? `${Math.round(ride.estimatedDuration / 60)} min`
                                  : "N/D"}
                              </dd>
                            </div>
                          </dl>
                          {ride.extraDestinations.length > 0 && (
                            <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-2">
                              <p className="text-xs font-semibold text-zinc-700">Paradas extra</p>
                              <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] text-zinc-600">
                                {ride.extraDestinations.map((stop, index) => (
                                  <li key={`${ride.rideId}-stop-${index}`}>
                                    {stop.address || "Sin dirección"}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {ride.notes && (
                            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-zinc-600">
                              Nota: {ride.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
