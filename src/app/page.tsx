"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      let target: string | null = null;

      if (typeof window !== "undefined") {
        const raw = window.sessionStorage.getItem("cmsUser");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { role?: string };
            if (parsed.role === "admin") target = "/admin";
            if (parsed.role === "operator") target = "/operator";
          } catch {
            // ignore
          }
        }
      }

      if (!target) {
        // Fallback: sin cmsUser en cache, manda a login para reconstruir contexto.
        router.replace("/login");
        return;
      }

      router.replace(target);
    });

    return () => unsubscribe();
  }, [router]);

  return null;
}
