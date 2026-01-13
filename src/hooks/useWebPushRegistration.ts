"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { firebaseAuth, messaging } from "@/lib/firebase-client";

interface UseWebPushOptions {
  userId?: string | null;
  enabled?: boolean;
}

interface RegistrationState {
  loading: boolean;
  error: string | null;
  token: string | null;
}

const WEB_PUSH_API_ENDPOINT = "/api/notifications/web-push";

async function persistToken(token: string, userId: string, idToken: string) {
  if (!token || !userId || !idToken) return;

  await fetch(WEB_PUSH_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ token, platform: "web", userId }),
  }).catch((err) => {
    console.warn("[useWebPushRegistration] persistToken error", err);
  });
}

export function useWebPushRegistration(options: UseWebPushOptions = {}): RegistrationState {
  const { userId, enabled = true } = options;
  const [state, setState] = useState<RegistrationState>({ loading: false, error: null, token: null });

  const registerPush = useCallback(async () => {
    if (!enabled || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (!messaging) {
      console.warn("[useWebPushRegistration] messaging no disponible");
      return;
    }
    if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_PUBLIC_KEY) {
      console.warn("[useWebPushRegistration] Falta NEXT_PUBLIC_FIREBASE_MESSAGING_PUBLIC_KEY");
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ loading: false, error: "Debes permitir notificaciones", token: null });
        return;
      }

      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        setState({ loading: false, error: "Sesión no encontrada", token: null });
        return;
      }

      const effectiveUserId = userId || currentUser.uid;
      if (!effectiveUserId) {
        setState({ loading: false, error: "No se pudo determinar el usuario", token: null });
        return;
      }

      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        setState({ loading: false, error: "No se pudo autenticar petición", token: null });
        return;
      }

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_PUBLIC_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        await persistToken(token, effectiveUserId, idToken);
        setState({ loading: false, error: null, token });
      } else {
        setState({ loading: false, error: "No se pudo obtener token", token: null });
      }
    } catch (error) {
      console.error("[useWebPushRegistration] error registrando SW", error);
      setState({ loading: false, error: (error as Error).message, token: null });
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (enabled) {
      registerPush().catch(() => undefined);
    }
  }, [enabled, registerPush]);

  useEffect(() => {
    if (!messaging || typeof window === "undefined") return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[useWebPushRegistration] Mensaje foreground", payload);
    });

    return () => unsubscribe();
  }, []);

  return state;
}
