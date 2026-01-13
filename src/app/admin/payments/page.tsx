"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface AdminPaymentRow {
  id: string;
  rideId: string | null;
  amount: number | null;
  tip: number | null;
  commission: number | null;
  commissionRateApplied: number | null;
  total: number | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  status: string | null;
  commissionStatus: string | null;
  localTransactionId: string | null;
  localAuthorizationCode: string | null;
  localBank: string | null;
  notes: string | null;
  cancelReason: string | null;
  syncedToFirebase: boolean;
  firebaseSyncedAt: string | null;
  biometricAuthenticated: boolean;
  biometricType: string | null;
  authenticationMethod: string | null;
  smsCodeVerified: boolean;
  smsVerificationId: string | null;
  paidAt: string | null;
  commissionPaidAt: string | null;
  createdAt: string | null;
}

type PaymentSortField =
  | "createdAt"
  | "paidAt"
  | "commissionPaidAt"
  | "id"
  | "rideId"
  | "status"
  | "amount";

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

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-600 border-red-200",
  refunded: "bg-blue-50 text-blue-600 border-blue-200",
};

function getStatusBadge(status: string | null) {
  if (!status) return "bg-zinc-100 text-zinc-600 border-zinc-200";
  return STATUS_STYLES[status.toLowerCase()] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<PaymentSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setError("Sesión no encontrada.");
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/payments", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any));
          const msg = (body as any).error || "Error al cargar pagos.";
          setError(msg);
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { payments: AdminPaymentRow[] };
        setPayments(body.payments || []);
        setLoading(false);
      } catch (err) {
        setError("Error al comunicar con el servidor.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const processedPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? payments.filter((p) => {
          const haystack = [
            p.id,
            p.rideId,
            p.status,
            p.commissionStatus,
            p.paymentMethod,
            p.paymentProvider,
            p.localTransactionId,
            p.localAuthorizationCode,
            p.localBank,
            p.cancelReason,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(q);
        })
      : payments;

    const sorted = [...filtered].sort((a, b) => {
      const valueA = getPaymentSortValue(a, sortField);
      const valueB = getPaymentSortValue(b, sortField);

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
  }, [payments, searchQuery, sortField, sortDirection]);

  function getPaymentSortValue(payment: AdminPaymentRow, field: PaymentSortField) {
    if (field === "id") return payment.id;
    if (field === "rideId") return payment.rideId ?? null;
    if (field === "status") return payment.status ?? null;
    if (field === "amount") return payment.amount ?? null;

    const dateSource =
      field === "createdAt"
        ? payment.createdAt
        : field === "paidAt"
        ? payment.paidAt
        : payment.commissionPaidAt;

    if (!dateSource) return null;
    const timestamp = new Date(dateSource).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function togglePaymentDirection() {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handlePaymentSort(field: PaymentSortField, direction: "asc" | "desc") {
    setSortField(field);
    setSortDirection(direction);
  }

  function renderPaymentSortButtons(field: PaymentSortField, label: string) {
    const isAsc = sortField === field && sortDirection === "asc";
    const isDesc = sortField === field && sortDirection === "desc";
    const baseBtn = "leading-none text-[10px]";

    return (
      <span className="ml-1 flex flex-col">
        <button
          type="button"
          aria-label={`Orden ascendente por ${label}`}
          className={`${baseBtn} ${isAsc ? themeColors.textPrimary : themeColors.textMuted}`}
          onClick={() => handlePaymentSort(field, "asc")}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Orden descendente por ${label}`}
          className={`${baseBtn} ${isDesc ? themeColors.textPrimary : themeColors.textMuted}`}
          onClick={() => handlePaymentSort(field, "desc")}
        >
          ▼
        </button>
      </span>
    );
  }

  const summary = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        acc.total += 1;
        acc.amount += payment.total ?? payment.amount ?? 0;
        acc.commission += payment.commission ?? 0;
        if ((payment.commissionStatus ?? "").toLowerCase() !== "paid") {
          acc.pendingCommissions += 1;
        }
        return acc;
      },
      { total: 0, amount: 0, commission: 0, pendingCommissions: 0 }
    );
  }, [payments]);

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>Pagos</h1>
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Historial consolidado de pagos registrados en Supabase.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pagos" value={summary.total} detail="Registros totales" trend="" />
        <SummaryCard
          label="Monto liquidado"
          value={summary.amount}
          detail="Total pagado"
          format="money"
        />
        <SummaryCard
          label="Comisiones"
          value={summary.commission}
          detail="Acumuladas"
          format="money"
        />
        <SummaryCard
          label="Comisiones pendientes"
          value={summary.pendingCommissions}
          detail="Por liquidar"
          variant="warning"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Búsqueda
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID de pago, viaje, estado o banco"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-0 ${themeColors.surface} ${themeColors.inputBorder} ${themeColors.textPrimary}`}
            />
          </label>
          <p className={`mt-1 text-xs ${themeColors.textMuted}`}>
            <strong>Tip:</strong> filtra por método de pago, proveedor, banco o códigos.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-right text-xs text-zinc-600">
          <p className="font-semibold text-zinc-800">{processedPayments.length} pagos visibles</p>
          <p>Usa las flechas sobre cada columna para ordenar.</p>
        </div>
      </div>

      {loading && (
        <p className={`${typography.body} ${themeColors.textSecondary}`}>
          Cargando pagos...
        </p>
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
                    <span>Pago</span>
                    {renderPaymentSortButtons("id", "ID de pago")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Viaje</span>
                    {renderPaymentSortButtons("rideId", "ID de viaje")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    {renderPaymentSortButtons("status", "estado")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-10">
                    <span>Montos</span>
                    {renderPaymentSortButtons("amount", "monto")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">Comisión</th>
                <th className="px-3 py-2 font-medium">Método / Banco</th>
                <th className="px-3 py-2 font-medium">Verificaciones</th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Creado</span>
                    {renderPaymentSortButtons("createdAt", "fecha de creación")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Pagado</span>
                    {renderPaymentSortButtons("paidAt", "fecha de pago")}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Comisión pagada</span>
                    {renderPaymentSortButtons(
                      "commissionPaidAt",
                      "fecha de comisión pagada"
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedPayments.map((p, index) => (
                <tr
                  key={p.id}
                  className={`border-b border-zinc-100 last:border-0 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
                >
                  <td className="px-4 py-3 align-top text-sm text-zinc-900">
                    <div className="space-y-1">
                      <p className="font-semibold text-zinc-900">{p.id}</p>
                      <div className="flex flex-wrap gap-1 text-[11px] text-zinc-500">
                        {p.localTransactionId && <Badge label={`Tx ${p.localTransactionId}`} />}
                        {p.localAuthorizationCode && <Badge label={`Auth ${p.localAuthorizationCode}`} />}
                        <span className={`border ${getStatusBadge(p.status)} rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize`}>
                          {p.status || "N/D"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">Viaje: {p.rideId || "(sin viaje)"}</p>
                      <p>Banco: {p.localBank || "N/D"}</p>
                      <p>Proveedor: {p.paymentProvider || "N/D"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      {p.cancelReason ? (
                        <Fragment>
                          <p>Estado: {p.status || "N/D"}</p>
                          <p className="text-red-500">Motivo: {p.cancelReason}</p>
                        </Fragment>
                      ) : (
                        <p>Estado: {p.status || "N/D"}</p>
                      )}
                      <p>
                        Sync Firebase: <span className="font-semibold">{p.syncedToFirebase ? "Sí" : "No"}</span>
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-700">
                    <div className="space-y-1 rounded-xl bg-zinc-50/80 px-3 py-2">
                      <p className="flex items-center justify-between text-sm font-semibold text-zinc-900">
                        <span>Monto</span>
                        <span>{formatMoney(p.amount)}</span>
                      </p>
                      <p className="flex items-center justify-between text-xs">
                        <span>Propina</span>
                        <span>{formatMoney(p.tip)}</span>
                      </p>
                      <p className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                        <span>Total</span>
                        <span>{formatMoney(p.total)}</span>
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <p>Comisión: {formatMoney(p.commission)}</p>
                      <p>Tasa: {p.commissionRateApplied ? `${p.commissionRateApplied}%` : "N/D"}</p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusBadge(p.commissionStatus)}`}>
                        {p.commissionStatus || "Sin registro"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <p>Método: {p.paymentMethod || "N/D"}</p>
                      <p>Proveedor: {p.paymentProvider || "N/D"}</p>
                      <p>Banco: {p.localBank || "N/D"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="space-y-1">
                      <Badge label={`Biometría ${p.biometricAuthenticated ? "OK" : "Pendiente"}`} variant={p.biometricAuthenticated ? "success" : "muted"} />
                      <Badge label={`SMS ${p.smsCodeVerified ? "Verificado" : "Sin verificar"}`} variant={p.smsCodeVerified ? "success" : "warning"} />
                      <p>Método auth: {p.authenticationMethod || "N/D"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="text-xs font-medium">{formatDate(p.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="text-xs font-medium">{formatDate(p.paidAt)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-600">
                    <div className="text-xs font-medium">{formatDate(p.commissionPaidAt)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  format,
  trend,
  variant = "default",
}: {
  label: string;
  value: number;
  detail: string;
  format?: "money";
  trend?: string;
  variant?: "default" | "warning";
}) {
  const isMoney = format === "money";
  const colorClasses =
    variant === "warning"
      ? "bg-amber-50 border-amber-100 text-amber-700"
      : "bg-white border-zinc-100 text-zinc-900";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClasses}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold text-zinc-900">
        {isMoney ? `${value.toLocaleString("es-NI", { minimumFractionDigits: 2 })} C$` : value.toLocaleString("es-NI")}
      </p>
      <p className="text-xs text-zinc-500">{detail}</p>
      {trend && <p className="text-[11px] text-emerald-600">{trend}</p>}
    </div>
  );
}

function Badge({ label, variant = "info" }: { label: string; variant?: "info" | "success" | "warning" | "muted" }) {
  const styles: Record<string, string> = {
    info: "bg-zinc-100 text-zinc-600 border-zinc-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    muted: "bg-zinc-50 text-zinc-500 border-zinc-100",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[variant]}`}>
      {label}
    </span>
  );
}
