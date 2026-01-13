"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

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

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<AdminDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/drivers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any));
          const msg = (body as any).error || "Error al cargar conductores.";
          setError(msg);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { drivers: AdminDriverRow[] };
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
    const q = query.trim().toLowerCase();
    if (!q) return drivers;

    return drivers.filter((d) => {
      const haystack = [
        d.id,
        d.userId,
        d.email,
        d.name,
        d.phone,
        d.licenseNumber,
        d.department,
        d.municipality,
        d.accountStatus,
        d.documentsStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [drivers, query]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Conductores
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Lista de conductores con datos de Supabase y Firebase Auth, incluyendo
          servicio de conductor designado.
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, ID, licencia o teléfono"
            className={`w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${themeColors.textPrimary}`}
          />
          <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
            Búsqueda sobre: nombre, correo, UID, ID de conductor, teléfono, licencia y estados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600">
            Conductores
            <strong className="text-zinc-900">{drivers.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            Filtrados
            <strong>{filteredDrivers.length}</strong>
          </span>
        </div>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando conductores...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>{error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-linear-to-r from-emerald-50 to-white text-[11px] uppercase tracking-wide text-emerald-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Conductor</th>
                <th className="px-4 py-3 font-semibold">Contacto</th>
                <th className="px-4 py-3 font-semibold">Licencia</th>
                <th className="px-4 py-3 font-semibold">Estado cuenta</th>
                <th className="px-4 py-3 font-semibold">Zona</th>
                <th className="px-4 py-3 font-semibold">Métricas</th>
                <th className="px-4 py-3 font-semibold">Servicios</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((d, index) => {
                const accountChipClass = d.accountStatus === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : d.accountStatus === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-zinc-100 text-zinc-600";
                const docChipClass = d.documentsStatus === "verified"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-100 text-amber-700";
                const servicesLabel = d.services.length
                  ? d.services.join(", ")
                  : "Sin servicios asignados";

                return (
                  <tr
                    key={d.id}
                    className={`${
                      index % 2 === 0 ? "bg-white" : "bg-zinc-50/60"
                    } border-b last:border-0 transition hover:bg-emerald-50/60`}
                  >
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textPrimary}`}>
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-zinc-900">
                          {d.name || "(sin nombre)"}
                        </div>
                        <div className="text-[11px] text-zinc-500">UID: {d.userId}</div>
                        <div className="text-[11px] text-zinc-400">Driver ID: {d.id}</div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textSecondary}`}>
                      <div className="space-y-0.5">
                        <div>{d.email || "(sin email)"}</div>
                        <div>{d.phone || "(sin teléfono)"}</div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textSecondary}`}>
                      {d.licenseNumber || "(sin licencia)"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${accountChipClass}`}>
                          Cuenta: {d.accountStatus || "N/D"}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${docChipClass}`}>
                          Docs: {d.documentsStatus || "N/D"}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textSecondary}`}>
                      <div>{d.department || "(sin departamento)"}</div>
                      <div>{d.municipality || "(sin municipio)"}</div>
                    </td>
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textSecondary}`}>
                      <div>Viajes: {d.totalRides ?? "N/D"}</div>
                      <div>Rating: {d.averageRating ?? "N/D"}</div>
                    </td>
                    <td className={`px-4 py-3 align-top text-xs ${themeColors.textSecondary}`}>
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          d.hasDesignatedDriverService
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}>
                          Designado: {d.hasDesignatedDriverService ? "Sí" : "No"}
                        </span>
                        <p className="text-[11px] text-zinc-500">{servicesLabel}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
