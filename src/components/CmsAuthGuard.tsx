"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { CmsUser, CmsRole, fetchCmsUser } from "@/lib/cms-user";

interface CmsAuthGuardProps {
  requiredRole: CmsRole;
  children: ReactNode;
}

export function CmsAuthGuard({ requiredRole, children }: CmsAuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        let cached: CmsUser | null = null;

        if (typeof window !== "undefined") {
          const raw = window.sessionStorage.getItem("cmsUser");
          if (raw) {
            try {
              cached = JSON.parse(raw) as CmsUser;
            } catch {
              cached = null;
            }
          }
        }

        const cmsUser = cached?.id === user.uid ? cached : await fetchCmsUser(user.uid);

        if (!cmsUser) {
          setError("No tienes acceso al CMS.");
          router.replace("/login");
          return;
        }

        // Admin puede ver todo el CMS (admin y operator).
        if (cmsUser.role !== "admin" && cmsUser.role !== requiredRole) {
          setError("No tienes permisos para acceder a este apartado.");
          setLoading(false);
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("cmsUser", JSON.stringify(cmsUser));
        }

        setLoading(false);
      } catch (err) {
        setError("Error al validar sesión.");
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router, requiredRole]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-600">Verificando sesión...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
