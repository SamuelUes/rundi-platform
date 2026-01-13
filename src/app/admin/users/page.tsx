"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface CmsUserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null; // Rol CMS (admin / operator) si aplica
  assigned_service_areas: string[];
}

interface AdminDriverFromApi {
  userId: string;
  phone: string | null;
  hasDesignatedDriverService: boolean;
}

interface AdminUserRow extends CmsUserRow {
  appRole: string | null; // Rol dentro de la app (client / driver / ...)
  phone: string | null;
  isDriver: boolean;
  hasDesignatedDriverService: boolean;
}

interface PaymentCardRow {
  id: string;
  brand: string | null;
  country: string | null;
  createdAt: Date | null;
  expMonth: number | null;
  expYear: number | null;
  bankname: string | null;
  isDefault: boolean | null;
  last4: string | null;
  provider: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cardsModalUser, setCardsModalUser] = useState<AdminUserRow | null>(null);
  const [cards, setCards] = useState<PaymentCardRow[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

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

        // 1) Usuarios de la app (colección "users")
        const usersSnap = await getDocs(collection(firestore, "users"));
        const appUsersById: Record<
          string,
          { email: string | null; name: string | null; appRole: string | null; phone: string | null }
        > = {};

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data() as {
            email?: string;
            name?: string;
            role?: string;
            phone?: string;
          };

          appUsersById[docSnap.id] = {
            email: data.email ?? null,
            name: data.name ?? null,
            appRole: data.role ?? null,
            phone: data.phone ?? null,
          };
        });

        // 2) Metadatos del CMS (colección "cms-users")
        const cmsSnap = await getDocs(collection(firestore, "cms-users"));
        const cmsByUserId: Record<
          string,
          { role: string | null; assigned_service_areas: string[] }
        > = {};

        cmsSnap.forEach((docSnap) => {
          const data = docSnap.data() as {
            role?: string;
            assigned_service_areas?: unknown;
          };

          const areas = Array.isArray(data.assigned_service_areas)
            ? (data.assigned_service_areas as string[])
            : [];

          cmsByUserId[docSnap.id] = {
            role: data.role ?? null,
            assigned_service_areas: areas,
          };
        });

        // 3) Construir filas base uniendo usuarios de app con metadatos CMS
        const baseRows: CmsUserRow[] = Object.entries(appUsersById).map(
          ([id, app]) => {
            const cms = cmsByUserId[id];
            return {
              id,
              email: app.email,
              name: app.name,
              role: cms?.role ?? null,
              assigned_service_areas: cms?.assigned_service_areas ?? [],
            };
          }
        );

        // 4) Enriquecer con datos de conductores desde /api/admin/drivers
        let driversByUserId: Record<string, AdminDriverFromApi> = {};
        try {
          const res = await fetch("/api/admin/drivers", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const body = (await res.json()) as {
              drivers: AdminDriverFromApi[];
            };

            driversByUserId = Object.fromEntries(
              (body.drivers || []).map((d) => [d.userId, d])
            );
          }
        } catch {
          // Si falla, continuamos solo con datos de Firestore
        }

        const enriched: AdminUserRow[] = baseRows.map((u) => {
          const appUser = appUsersById[u.id];
          const driver = driversByUserId[u.id];

          return {
            ...u,
            appRole: appUser?.appRole ?? null,
            phone: driver?.phone ?? appUser?.phone ?? null,
            isDriver: !!driver,
            hasDesignatedDriverService:
              driver?.hasDesignatedDriverService ?? false,
          };
        });

        setUsers(enriched);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar usuarios del CMS.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const baseRole = u.appRole?.toLowerCase() ?? "";
      const appRoleLabel = u.isDriver
        ? u.hasDesignatedDriverService
          ? "conductor designado"
          : "conductor"
        : baseRole || "cliente";

      const haystack = [
        u.id,
        u.email,
        u.name,
        u.role, // rol CMS
        u.appRole,
        u.phone,
        appRoleLabel,
        ...u.assigned_service_areas,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [users, searchQuery]);

  function formatCardDate(date: Date | null) {
    if (!date || Number.isNaN(date.getTime())) return "Fecha no disponible";
    return date.toLocaleString("es-NI", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  async function openCardsModal(user: AdminUserRow) {
    setCardsModalUser(user);
    setCards([]);
    setCardsError(null);
    setCardsLoading(true);
    try {
      if (!authToken) {
        throw new Error("Token de autenticación no disponible");
      }

      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/cards`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "No se pudieron cargar las tarjetas");
      }

      const body = (await res.json()) as {
        cards: {
          id: string;
          userId: string;
          localCardId: string | null;
          lastFourDigits: string | null;
          expirationMonth: number | null;
          expirationYear: number | null;
          bankName: string | null;
          cardBrand: string | null;
          isDefault: boolean;
          isActive: boolean;
          createdAt: string | null;
          updatedAt: string | null;
        }[];
      };

      const rows: PaymentCardRow[] = (body.cards || []).map((card) => ({
        id: card.id,
        brand: card.cardBrand ?? card.bankName ?? null,
        country: null,
        createdAt: card.createdAt ? new Date(card.createdAt) : null,
        expMonth: card.expirationMonth,
        expYear: card.expirationYear,
        bankname: card.bankName ?? null,
        isDefault: card.isDefault,
        last4: card.lastFourDigits ?? null,
        provider: card.localCardId ?? card.bankName ?? null,
      }));

      setCards(rows);
    } catch (err) {
      setCardsError((err as Error).message || "No se pudieron cargar las tarjetas");
    } finally {
      setCardsLoading(false);
    }
  }

  function closeCardsModal() {
    setCardsModalUser(null);
    setCards([]);
    setCardsError(null);
    setCardsLoading(false);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
          Usuarios y roles
        </h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Listado global de usuarios de la app (colección "users"), con su rol
          en la app, su estado como conductor/designado y, si aplica, su rol en
          el CMS (admin / operator).
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, ID, teléfono, rol o área"
            className={`w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${themeColors.textPrimary}`}
          />
          <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
            Búsqueda sobre: nombre, correo, UID, rol CMS, rol app, teléfono y áreas asignadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600">
            Usuarios totales
            <strong className="text-zinc-900">{users.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            Filtrados
            <strong>{filteredUsers.length}</strong>
          </span>
        </div>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando usuarios...
        </p>
      )}

      {!loading && error && (
        <p className={`${typography.body} ${themeColors.dangerText}`}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-linear-to-r from-emerald-50 to-white text-[11px] uppercase tracking-wide text-emerald-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol app</th>
                <th className="px-4 py-3 font-semibold">Rol CMS</th>
                <th className="px-4 py-3 font-semibold">Contacto</th>
                <th className="px-4 py-3 font-semibold">Áreas CMS</th>
                <th className="px-4 py-3 text-right font-semibold">Tarjetas</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, index) => {
                const baseRole = u.appRole?.toLowerCase() ?? "";
                const appRoleLabel = u.isDriver
                  ? u.hasDesignatedDriverService
                    ? "Conductor + Designado"
                    : "Conductor"
                  : baseRole || "Cliente";

                const cmsRoleLabel = u.role || "Sin rol CMS";
                const appRoleClass = u.isDriver
                  ? u.hasDesignatedDriverService
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                  : "bg-zinc-100 text-zinc-600";
                const cmsRoleClass = u.role
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-zinc-100 text-zinc-500";
                const assignedAreas = u.assigned_service_areas.length
                  ? u.assigned_service_areas.join(", ")
                  : "Sin áreas asignadas";

                return (
                  <tr
                    key={u.id}
                    className={`${
                      index % 2 === 0 ? "bg-white" : "bg-zinc-50/60"
                    } border-b last:border-0 transition hover:bg-emerald-50/60`}
                  >
                    <td className="px-4 py-3 align-top text-xs text-zinc-700">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-zinc-900">
                          {u.name || "(sin nombre)"}
                        </div>
                        <div className="text-[11px] text-zinc-500">{u.email || "(sin correo)"}</div>
                        <div className="text-[11px] text-zinc-400">UID: {u.id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${appRoleClass}`}>
                        {appRoleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cmsRoleClass}`}>
                        {cmsRoleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-600">
                      <div>{u.phone || "(sin teléfono)"}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-600">
                      {assignedAreas}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => openCardsModal(u)}
                        className="inline-flex items-center rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        Ver tarjetas
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cardsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className={`${typography.h2} ${themeColors.textPrimary}`}>
                  Tarjetas guardadas
                </h2>
                <p className={`${typography.body} ${themeColors.textSecondary}`}>
                  Usuario: {cardsModalUser.name || cardsModalUser.email || cardsModalUser.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCardsModal}
                className={`rounded px-2 py-1 text-sm ${themeColors.textSecondary} ${themeColors.surfaceHover}`}
              >
                Cerrar
              </button>
            </div>

            {cardsLoading && (
              <p className={`${typography.body} ${themeColors.textSecondary}`}>
                Cargando tarjetas...
              </p>
            )}

            {!cardsLoading && cardsError && (
              <p className={`${typography.body} ${themeColors.dangerText}`}>
                {cardsError}
              </p>
            )}

            {!cardsLoading && !cardsError && cards.length === 0 && (
              <p className={`${typography.body} ${themeColors.textSecondary}`}>
                No hay tarjetas guardadas para este usuario.
              </p>
            )}

            {!cardsLoading && !cardsError && cards.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {cards.map((card) => (
                  <div key={card.id} className="rounded-lg border p-3 shadow-sm">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className={themeColors.textPrimary}>
                        {card.brand?.toUpperCase() || "Tarjeta"} ·••{card.last4 || "XXXX"}
                      </span>
                      {card.isDefault && (
                        <span className="text-xs font-medium text-emerald-600">
                          Predeterminada
                        </span>
                      )}
                    </div>
                    <div className={`mt-1 text-xs ${themeColors.textSecondary}`}>
                      <p>Proveedor: {card.provider || "N/D"}</p>
                      <p>País: {card.country || "N/D"}</p>
                      <p>Banco: {card.bankname || "N/D"}</p>
                      <p>
                        Expira: {card.expMonth || "??"}/{card.expYear || "????"}
                      </p>
                      <p>ID: {card.id}</p>
                      <p>Creada: {formatCardDate(card.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
