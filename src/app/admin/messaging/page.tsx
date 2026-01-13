"use client";

import { FormEvent, useMemo, useState } from "react";
import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import {
  CampaignCategory,
  CampaignChannel,
  CampaignStatus,
  CampaignUpsertInput,
  MessagingCampaign,
} from "@/types/messaging";
import { useMessagingCampaigns } from "@/hooks/useMessagingCampaigns";

type CampaignFormData = CampaignUpsertInput;

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  active: "Activa",
  completed: "Completada",
};

function formatDate(value: string | null): string {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

export default function AdminMessagingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const {
    campaigns,
    stats,
    loading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    duplicateCampaign,
    sendCampaign,
  } = useMessagingCampaigns();
  const [localError, setLocalError] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<
    | null
    | {
        mode: "create" | "edit";
        category: CampaignCategory;
        campaign?: MessagingCampaign;
      }
  >(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const displayError = error ?? localError;

  async function handleDelete(campaign: MessagingCampaign) {
    const shouldDelete = window.confirm(`¿Eliminar "${campaign.name}" de forma permanente?`);
    if (!shouldDelete) return;

    setDeletingId(campaign.id);
    try {
      await deleteCampaign(campaign.id);
      setLocalError(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "No se pudo eliminar la campaña");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSend(campaign: MessagingCampaign) {
    setSendingId(campaign.id);
    try {
      await sendCampaign(campaign.id);
      setLocalError(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "No se pudo enviar la campaña");
    } finally {
      setSendingId(null);
    }
  }

  const filteredCampaigns = useMemo(() => {
    const term = search.toLowerCase().trim();
    return campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const haystack = `${campaign.name} ${campaign.description} ${campaign.segment}`.toLowerCase();
      const matchesSearch = term ? haystack.includes(term) : true;
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, search, statusFilter]);

  const summary = useMemo(
    () => ({ total: stats.total, active: stats.active, scheduled: stats.scheduled }),
    [stats]
  );

  async function handleSaveCampaign(
    input: CampaignFormData,
    mode: "create" | "edit",
    currentCampaign?: MessagingCampaign,
    options?: { sendNow?: boolean }
  ) {
    const sendNow = options?.sendNow ?? false;

    try {
      if (mode === "create") {
        await createCampaign(input, { sendNow });
      } else if (currentCampaign) {
        await updateCampaign(currentCampaign.id, input, { sendNow });
      }
      setModalState(null);
      setLocalError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la campaña";
      setLocalError(message);
      throw err;
    }
  }

  async function handleDuplicate(campaign: MessagingCampaign) {
    setDuplicatingId(campaign.id);
    try {
      await duplicateCampaign(campaign);
      setLocalError(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "No se pudo duplicar la campaña");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>Messaging</h1>
            <p className={`${typography.body} ${themeColors.textSecondary}`}>
              Programa campañas multicanal y da seguimiento a sus resultados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                setModalState({
                  mode: "create",
                  category: "experiment",
                })
              }
              className={`rounded-md border px-4 py-2 text-sm font-medium ${themeColors.surfaceHover} ${themeColors.textPrimary}`}
            >
              Experimento nuevo
            </button>
            <button
              onClick={() =>
                setModalState({
                  mode: "create",
                  category: "campaign",
                })
              }
              className={`rounded-md px-4 py-2 text-sm font-semibold ${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryText}`}
            >
              Campaña nueva
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Campañas" value={summary.total} detail="Totales" />
          <SummaryCard label="Activas" value={summary.active} detail="En curso" />
          <SummaryCard label="Programadas" value={summary.scheduled} detail="Próximas" />
        </div>
      </header>

      {displayError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600"
              type="button"
            >
              Filtrar campañas
            </button>
            {(["all", "active", "scheduled", "completed", "draft"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setStatusFilter(option === "all" ? "all" : option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === option
                    ? `${themeColors.accentGoldBg} ${themeColors.buttonPrimaryText}`
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {option === "all" ? "Todas" : STATUS_LABELS[option as CampaignStatus]}
              </button>
            ))}
          </div>
          <div className="w-full max-w-sm">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campañas por nombre, descripción o segmento"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${themeColors.surface} ${themeColors.inputBorder}`}
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Campaña</th>
                <th className="px-3 py-2">Inicio</th>
                <th className="px-3 py-2">Fin</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Segmentación</th>
                <th className="px-3 py-2">Última actualización</th>
                <th className="px-3 py-2">Último envío</th>
                <th className="px-3 py-2">Envíos o impresiones</th>
                <th className="px-3 py-2">Clics o aperturas</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Cargando campañas...
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b last:border-none">
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-900">{campaign.name}</p>
                        <p className="text-xs text-zinc-500">{campaign.description}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{formatDate(campaign.startAt)}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{formatDate(campaign.endAt)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusStyles(campaign.status)}`}>
                        {STATUS_LABELS[campaign.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{campaign.segment}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{formatDate(campaign.lastUpdate)}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">
                      {campaign.lastSentAt ? (
                        <div className="space-y-0.5">
                          <p>{formatDate(campaign.lastSentAt)}</p>
                          {typeof campaign.lastSentCount === "number" && (
                            <p className="text-xs text-zinc-500">
                              {campaign.lastSentCount.toLocaleString()} envíos
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">Sin envíos</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{campaign.impressions?.toLocaleString() ?? "--"}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{campaign.clicks?.toLocaleString() ?? "--"}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                        {campaign.category === "experiment" ? "Experimento" : "Campaña"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleSend(campaign)}
                          disabled={sendingId === campaign.id}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-600 disabled:opacity-60"
                        >
                          {sendingId === campaign.id ? "Enviando..." : "Enviar"}
                        </button>
                        <button
                          onClick={() =>
                            setModalState({
                              mode: "edit",
                              campaign,
                              category: campaign.category,
                            })
                          }
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-600"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDuplicate(campaign)}
                          disabled={duplicatingId === campaign.id}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-600 disabled:opacity-60"
                        >
                          {duplicatingId === campaign.id ? "Duplicando..." : "Duplicar"}
                        </button>
                        <button
                          onClick={() => handleDelete(campaign)}
                          disabled={deletingId === campaign.id}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 disabled:opacity-60"
                        >
                          {deletingId === campaign.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && filteredCampaigns.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-500">
              No se encontraron campañas con los filtros seleccionados.
            </p>
          )}
        </div>
      </div>

      {modalState && (
        <CampaignModal
          key={modalState.campaign?.id ?? modalState.category}
          mode={modalState.mode}
          category={modalState.category}
          initialData={modalState.campaign}
          onClose={() => setModalState(null)}
          onSave={(data: CampaignFormData, options) =>
            handleSaveCampaign(data, modalState.mode, modalState.campaign, options)
          }
        />
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function getStatusStyles(status: CampaignStatus) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "scheduled":
      return "bg-blue-100 text-blue-700";
    case "completed":
      return "bg-zinc-200 text-zinc-700";
    case "draft":
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function CampaignModal({
  mode,
  category,
  initialData,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  category: CampaignCategory;
  initialData?: MessagingCampaign;
  onClose: () => void;
  onSave: (data: CampaignFormData, options?: { sendNow?: boolean }) => void;
}) {
  const initialStatus = initialData?.status ?? "draft";
  const [form, setForm] = useState<CampaignFormData>(
    initialData ?? {
      name: "",
      description: "",
      status: "draft",
      startAt: new Date().toISOString(),
      endAt: null,
      segment: "",
      channel: "push",
      category,
    }
  );
  const [sendNow, setSendNow] = useState(false);
  const [statusBeforeSendNow, setStatusBeforeSendNow] = useState<CampaignStatus>(initialStatus);

  function handleChange(field: keyof CampaignFormData, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSendNow() {
    setSendNow((prev) => {
      if (!prev) {
        setStatusBeforeSendNow((form.status as CampaignStatus) ?? "draft");
        setForm((current) => ({
          ...current,
          status: "active",
          startAt: new Date().toISOString(),
        }));
      } else {
        setForm((current) => ({
          ...current,
          status: statusBeforeSendNow,
        }));
      }
      return !prev;
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave(form, { sendNow });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {category === "experiment" ? "Experimento" : "Campaña"}
            </p>
            <h2 className={`${typography.h1} ${themeColors.textPrimary}`}>
              {mode === "create" ? "Crear" : "Editar"} {category === "experiment" ? "experimento" : "campaña"}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleSendNow}
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${sendNow ? "border-green-400 text-green-600" : "text-zinc-600"}`}
            >
              {sendNow ? "Modo enviar ahora" : "Enviar justo ahora"}
            </button>
            <button onClick={onClose} className="text-sm text-zinc-500">
              Cerrar
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-500">
              Nombre
              <input
                required
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Segmento
              <input
                required
                value={form.segment}
                onChange={(e) => handleChange("segment", e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="text-xs font-semibold text-zinc-500">
            Descripción
            <textarea
              required
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-500">
              Inicio
              <input
                type="datetime-local"
                required
                value={toDatetimeLocal(form.startAt)}
                onChange={(e) => handleChange("startAt", fromDatetimeLocal(e.target.value))}
                disabled={sendNow}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Fin (opcional)
              <input
                type="datetime-local"
                value={toDatetimeLocal(form.endAt)}
                onChange={(e) => handleChange("endAt", e.target.value ? fromDatetimeLocal(e.target.value) : null)}
                disabled={sendNow}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-zinc-500">
              Estado
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                disabled={sendNow}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Canal
              <select
                value={form.channel}
                onChange={(e) => handleChange("channel", e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="push">Push</option>
                <option value="in_app">In-app</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Categoría
              <select
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="campaign">Campaña</option>
                <option value="experiment">Experimento</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-zinc-600">
              Cancelar
            </button>
            <button
              type="submit"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryText}`}
            >
              {sendNow ? "Mandar ahora" : mode === "create" ? "Guardar" : "Actualizar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
