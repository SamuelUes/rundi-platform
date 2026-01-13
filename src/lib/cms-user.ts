"use client";

import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebase-client";

export type CmsRole = "admin" | "operator";

export interface CmsUser {
  id: string;
  email: string | null;
  name: string | null;
  role: CmsRole;
  assigned_service_areas: string[];
}

export async function fetchCmsUser(uid: string): Promise<CmsUser | null> {
  const ref = doc(firestore, "cms-users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as Partial<CmsUser> & {
    role?: string;
    assigned_service_areas?: unknown;
  };

  const assigned = Array.isArray(data.assigned_service_areas)
    ? (data.assigned_service_areas as string[])
    : [];

  if (data.role !== "admin" && data.role !== "operator") {
    return null;
  }

  return {
    id: uid,
    email: (data.email ?? null) as string | null,
    name: (data.name ?? null) as string | null,
    role: data.role,
    assigned_service_areas: assigned,
  };
}
