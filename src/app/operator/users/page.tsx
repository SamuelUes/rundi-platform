"use client";

import { UsersDashboard } from "@/components/users/UsersDashboard";

export default function OperatorUsersPage() {
  return (
    <UsersDashboard
      title="Usuarios"
      description="Listado de usuarios con roles, contacto y estado en el CMS."
      showCards={false}
    />
  );
}
