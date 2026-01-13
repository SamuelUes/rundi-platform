"use client";

import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface ServiceAreaRow {
  id: string;
  name: string | null;
  countryCode: string | null;
  bounds?: {
    north?: number;
    south?: number;
    east?: number;
    west?: number;
  } | null;
}

export default function AdminServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceAreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ServiceAreaRow | null>(null);
  const [newArea, setNewArea] = useState({
    name: "",
    countryCode: "",
    bounds: { north: "", south: "", east: "", west: "" },
  });

  async function loadAreas() {
    try {
      const ref = collection(firestore, "service_areas");
      const snap = await getDocs(ref);

      const rows: ServiceAreaRow[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as {
          name?: string;
          countryCode?: string;
          bounds?: {
            north?: number;
            south?: number;
            east?: number;
            west?: number;
          };
        };

        rows.push({
          id: docSnap.id,
          name: data.name ?? null,
          countryCode: data.countryCode ?? null,
          bounds: data.bounds ?? null,
        });
      });

      setAreas(rows);
      setLoading(false);
    } catch (err) {
      setError("Error al cargar zonas de servicio.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAreas();
  }, []);

  async function handleSaveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const name = newArea.name.trim();
    const countryCode = newArea.countryCode.trim().toUpperCase();
    const bounds = {
      north: parseFloat(newArea.bounds.north),
      south: parseFloat(newArea.bounds.south),
      east: parseFloat(newArea.bounds.east),
      west: parseFloat(newArea.bounds.west),
    };

    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    if (!countryCode) {
      setFormError("El código de país es obligatorio.");
      return;
    }

    const hasBounds = Object.values(bounds).every((value) => !Number.isNaN(value));

    if (!hasBounds) {
      setFormError("Debes completar los límites geográficos (north/south/east/west).");
      return;
    }

    try {
      setSaving(true);
      if (selectedArea) {
        const ref = doc(firestore, "service_areas", selectedArea.id);
        await updateDoc(ref, {
          name,
          countryCode,
          bounds,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(firestore, "service_areas"), {
          name,
          countryCode,
          bounds,
          createdAt: new Date().toISOString(),
        });
      }
      setNewArea({
        name: "",
        countryCode: "",
        bounds: { north: "", south: "", east: "", west: "" },
      });
      setSelectedArea(null);
      await loadAreas();
      setShowModal(false);
    } catch (err) {
      setFormError(
        selectedArea
          ? "No se pudo actualizar el área. Intenta de nuevo."
          : "No se pudo guardar el área. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Zonas de servicio
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Listado de zonas de servicio registradas en Firestore.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`${typography.body} ${themeColors.textSecondary}`}>
            Total áreas registradas: <strong>{areas.length}</strong>
          </p>
          <p className={`text-xs ${themeColors.textMuted}`}>
            Administra los límites y la ubicación de cada zona.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setSelectedArea(null);
            setShowModal(true);
          }}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryHoverBg} ${themeColors.buttonPrimaryText}`}
        >
          + Agregar zona de servicio
        </button>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando zonas de servicio...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className={`${themeColors.appBackground}`}>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  ID
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  País
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Bounds
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className={`px-4 py-3 text-xs ${themeColors.textMuted}`}>
                    {a.id}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${themeColors.textPrimary}`}>
                    {a.name || "(sin nombre)"}
                  </td>
                  <td className={`px-4 py-3 ${themeColors.textSecondary}`}>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase text-zinc-600">
                      {a.countryCode || "N/D"}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs ${themeColors.textSecondary}`}>
                    {a.bounds ? (
                      <div className="space-y-0.5">
                        <div>North: {a.bounds.north}</div>
                        <div>South: {a.bounds.south}</div>
                        <div>East: {a.bounds.east}</div>
                        <div>West: {a.bounds.west}</div>
                      </div>
                    ) : (
                      <span className={themeColors.textMuted}>Sin bounds</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setSelectedArea(a);
                        setNewArea({
                          name: a.name ?? "",
                          countryCode: a.countryCode ?? "",
                          bounds: {
                            north: String(a.bounds?.north ?? ""),
                            south: String(a.bounds?.south ?? ""),
                            east: String(a.bounds?.east ?? ""),
                            west: String(a.bounds?.west ?? ""),
                          },
                        });
                        setShowModal(true);
                      }}
                      className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`${typography.h2} ${themeColors.textPrimary}`}>
                Nueva zona de servicio
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`rounded px-2 py-1 text-sm ${themeColors.textSecondary} ${themeColors.surfaceHover}`}
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={handleSaveArea} className="space-y-3">
              <div>
                <label className={`block text-sm font-medium ${themeColors.textSecondary}`}>
                  Nombre del área
                </label>
                <input
                  type="text"
                  value={newArea.name}
                  onChange={(e) =>
                    setNewArea((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none ${themeColors.inputBorder} ${themeColors.textPrimary}`}
                  placeholder="Ej: Managua Centro"
                  disabled={saving}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${themeColors.textSecondary}`}>
                  Código de país (ISO)
                </label>
                <input
                  type="text"
                  value={newArea.countryCode}
                  onChange={(e) =>
                    setNewArea((prev) => ({ ...prev, countryCode: e.target.value }))
                  }
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase outline-none ${themeColors.inputBorder} ${themeColors.textPrimary}`}
                  placeholder="Ej: NI"
                  maxLength={3}
                  disabled={saving}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(["north", "south", "east", "west"] as const).map((key) => (
                  <div key={key}>
                    <label className={`block text-sm font-medium ${themeColors.textSecondary}`}>
                      {key.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newArea.bounds[key]}
                      onChange={(e) =>
                        setNewArea((prev) => ({
                          ...prev,
                          bounds: { ...prev.bounds, [key]: e.target.value },
                        }))
                      }
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none ${themeColors.inputBorder} ${themeColors.textPrimary}`}
                      placeholder="0.00"
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
              {formError && (
                <p className={`text-sm ${themeColors.dangerText}`}>{formError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedArea(null);
                  }}
                  className={`rounded-md border px-4 py-2 text-sm ${themeColors.textSecondary}`}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold ${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryHoverBg} ${themeColors.buttonPrimaryText} disabled:opacity-50`}
                >
                  {saving
                    ? "Guardando..."
                    : selectedArea
                    ? "Actualizar"
                    : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
