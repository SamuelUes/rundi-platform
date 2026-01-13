"use client";

import { CmsAuthGuard } from "@/components/CmsAuthGuard";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";

export default function OperatorHomePage() {
  type Area = {
    id: string;
    name: string | null;
    countryCode: string | null;
  };

  type Driver = {
    areaId: string;
    driverId: string;
    status: string | null;
    currentRideId: string | null;
    lat: number | null;
    lng: number | null;
    lastUpdate: number | null;
  };

  const [areas, setAreas] = useState<Area[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
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
        const res = await fetch("/api/operator/active-drivers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = body.error || "Error al cargar conductores.";
          setError(message);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as {
          areas: Area[];
          drivers: Driver[];
        };

        setAreas(body.areas || []);
        setDrivers(body.drivers || []);
        setLoading(false);
      } catch (err) {
        setError("Error al comunicar con el servidor.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const driversByArea: Record<string, Driver[]> = drivers.reduce(
    (acc, driver) => {
      if (!acc[driver.areaId]) acc[driver.areaId] = [];
      acc[driver.areaId].push(driver);
      return acc;
    },
    {} as Record<string, Driver[]>
  );

  return (
    <CmsAuthGuard requiredRole="operator">
      <main className={`flex min-h-screen flex-col ${themeColors.appBackground}`}>
        <header className={`border-b px-6 py-4 ${themeColors.surface}`}>
          <h1 className={`text-xl font-semibold ${themeColors.textPrimary}`}>
            Panel de operador
          </h1>
          <p className={`text-sm ${themeColors.textSecondary}`}>
            Herramientas del call center para monitorear conductores y viajes.
          </p>
        </header>
        <section className="flex-1 px-6 py-8">
          {loading && (
            <p className={`text-sm ${themeColors.textSecondary}`}>
              Cargando conductores activos...
            </p>
          )}

          {!loading && error && (
            <p className={`text-sm ${themeColors.dangerText}`} role="alert">
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="space-y-8">
              {areas.length === 0 && (
                <p className={`text-sm ${themeColors.textSecondary}`}>
                  No tienes áreas de servicio asignadas.
                </p>
              )}

              {areas.map((area) => {
                const areaDrivers = driversByArea[area.id] || [];
                return (
                  <div
                    key={area.id}
                    className={`rounded-lg border p-4 ${themeColors.surface}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h2
                          className={`text-sm font-semibold ${themeColors.textPrimary}`}
                        >
                          {area.name || area.id}
                        </h2>
                        <p className={`text-xs ${themeColors.textMuted}`}>
                          País: {area.countryCode || "N/D"}
                        </p>
                      </div>
                      <span className={`text-xs ${themeColors.textSecondary}`}>
                        Conductores activos: {areaDrivers.length}
                      </span>
                    </div>

                    {areaDrivers.length === 0 ? (
                      <p className={`text-xs ${themeColors.textMuted}`}>
                        No hay conductores activos en esta área.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className={`border-b ${themeColors.appBackground}`}>
                            <tr>
                              <th
                                className={`px-2 py-1 font-medium ${themeColors.textSecondary}`}
                              >
                                Conductor
                              </th>
                              <th
                                className={`px-2 py-1 font-medium ${themeColors.textSecondary}`}
                              >
                                Estado
                              </th>
                              <th
                                className={`px-2 py-1 font-medium ${themeColors.textSecondary}`}
                              >
                                Viaje actual
                              </th>
                              <th
                                className={`px-2 py-1 font-medium ${themeColors.textSecondary}`}
                              >
                                Última actualización
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {areaDrivers.map((d) => (
                              <tr key={d.driverId} className="border-b last:border-0">
                                <td
                                  className={`px-2 py-1 ${themeColors.textPrimary}`}
                                >
                                  {d.driverId}
                                </td>
                                <td
                                  className={`px-2 py-1 ${themeColors.textSecondary}`}
                                >
                                  {d.status || "N/D"}
                                </td>
                                <td
                                  className={`px-2 py-1 ${themeColors.textSecondary}`}
                                >
                                  {d.currentRideId || "Sin viaje"}
                                </td>
                                <td
                                  className={`px-2 py-1 ${themeColors.textSecondary}`}
                                >
                                  {d.lastUpdate
                                    ? new Date(d.lastUpdate).toLocaleString()
                                    : "N/D"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </CmsAuthGuard>
  );
}
