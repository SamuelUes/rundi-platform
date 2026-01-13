"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import type {
  CampaignUpsertInput,
  MessagingCampaign,
  MessagingCampaignListResponse,
  MessagingCampaignStats,
} from "@/types/messaging";

const EMPTY_STATS: MessagingCampaignStats = {
  total: 0,
  draft: 0,
  scheduled: 0,
  active: 0,
  completed: 0,
};

function computeStats(list: MessagingCampaign[]): MessagingCampaignStats {
  return list.reduce(
    (acc, campaign) => {
      acc.total += 1;
      acc[campaign.status] += 1;
      return acc;
    },
    { ...EMPTY_STATS }
  );
}

type UpsertOptions = { sendNow?: boolean };

export function useMessagingCampaigns() {
  const [campaigns, setCampaigns] = useState<MessagingCampaign[]>([]);
  const [stats, setStats] = useState<MessagingCampaignStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(firebaseAuth.currentUser);

  const updateLocalList = useCallback((updater: (prev: MessagingCampaign[]) => MessagingCampaign[]) => {
    setCampaigns((prev) => {
      const next = updater(prev);
      setStats(computeStats(next));
      return next;
    });
  }, []);

  const requireToken = useCallback(async () => {
    if (!currentUser) {
      throw new Error("Inicia sesión para administrar campañas");
    }
    return currentUser.getIdToken();
  }, [currentUser]);

  const handleError = useCallback((err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    return message;
  }, []);

  const fetchCampaigns = useCallback(async () => {
    if (!currentUser) {
      setCampaigns([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      setError("Inicia sesión para administrar campañas");
      return;
    }

    setLoading(true);
    try {
      const token = await requireToken();
      const res = await fetch("/api/admin/messaging", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as MessagingCampaignListResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "No se pudieron cargar las campañas");
      }

      const list = body.campaigns ?? [];
      setCampaigns(list);
      setStats(body.stats ?? computeStats(list));
      setError(null);
    } catch (err) {
      handleError(err, "No se pudieron cargar las campañas");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUser, handleError, requireToken]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setCampaigns([]);
        setStats(EMPTY_STATS);
        setLoading(false);
        setError("Inicia sesión para administrar campañas");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    fetchCampaigns().catch(() => undefined);
  }, [currentUser, fetchCampaigns]);

  const refresh = useCallback(async () => {
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const sendCampaign = useCallback(
    async (campaignId: string) => {
      const token = await requireToken();
      const res = await fetch(`/api/admin/messaging/${campaignId}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as { campaign?: MessagingCampaign; error?: string };
      if (!res.ok || !body.campaign) {
        throw new Error(body.error || "No se pudo enviar la campaña");
      }

      updateLocalList((prev) => prev.map((item) => (item.id === body.campaign!.id ? body.campaign! : item)));
      return body.campaign;
    },
    [requireToken, updateLocalList]
  );

  const createCampaign = useCallback(
    async (payload: CampaignUpsertInput, options?: UpsertOptions) => {
      const token = await requireToken();
      const res = await fetch("/api/admin/messaging", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as { campaign?: MessagingCampaign; error?: string };
      if (!res.ok || !body.campaign) {
        throw new Error(body.error || "No se pudo crear la campaña");
      }

      updateLocalList((prev) => [body.campaign!, ...prev]);

      if (options?.sendNow) {
        return await sendCampaign(body.campaign.id);
      }

      return body.campaign;
    },
    [requireToken, sendCampaign, updateLocalList]
  );

  const updateCampaign = useCallback(
    async (campaignId: string, payload: CampaignUpsertInput, options?: UpsertOptions) => {
      const token = await requireToken();
      const res = await fetch(`/api/admin/messaging/${campaignId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as { campaign?: MessagingCampaign; error?: string };
      if (!res.ok || !body.campaign) {
        throw new Error(body.error || "No se pudo actualizar la campaña");
      }

      updateLocalList((prev) => prev.map((item) => (item.id === body.campaign!.id ? body.campaign! : item)));

      if (options?.sendNow) {
        return await sendCampaign(body.campaign.id);
      }

      return body.campaign;
    },
    [requireToken, sendCampaign, updateLocalList]
  );

  const deleteCampaign = useCallback(
    async (campaignId: string) => {
      const token = await requireToken();
      const res = await fetch(`/api/admin/messaging/${campaignId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "No se pudo eliminar la campaña");
      }

      updateLocalList((prev) => prev.filter((item) => item.id !== campaignId));
    },
    [requireToken, updateLocalList]
  );

  const duplicateCampaign = useCallback(
    async (campaign: MessagingCampaign) => {
      const payload: CampaignUpsertInput = {
        name: `${campaign.name} (copia)`,
        description: campaign.description,
        status: campaign.status,
        startAt: new Date().toISOString(),
        endAt: campaign.endAt,
        segment: campaign.segment,
        channel: campaign.channel,
        category: campaign.category,
      };

      return createCampaign(payload);
    },
    [createCampaign]
  );

  const clearError = useCallback(() => setError(null), []);

  const state = useMemo(
    () => ({
      campaigns,
      stats,
      loading,
      error,
    }),
    [campaigns, stats, loading, error]
  );

  return {
    ...state,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    duplicateCampaign,
    sendCampaign,
    refresh,
    clearError,
  };
}
