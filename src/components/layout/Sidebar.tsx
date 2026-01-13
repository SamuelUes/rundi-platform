"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { themeColors } from "@/theme/colors";

type Role = "admin" | "operator";

interface SidebarProps {
  role: Role;
}

interface NavItem {
  href: string;
  label: string;
}

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/drivers", label: "Conductores" },
  { href: "/admin/designated-drivers", label: "Solicitudes de conductores" },
  { href: "/admin/rides", label: "Viajes" },
  { href: "/admin/payments", label: "Pagos" },
  //{ href: "/admin/commissions", label: "Comisiones" },
  { href: "/admin/service-areas", label: "Zonas de servicio" },
  { href: "/admin/messaging", label: "Mensajería" },
  //{ href: "/admin/settings", label: "Configuración" },
];

const OPERATOR_ITEMS: NavItem[] = [
  { href: "/operator", label: "Resumen" },
  { href: "/operator/users", label: "Usuarios" },
  { href: "/operator/calls", label: "Llamadas y mensajes" },
  { href: "/operator/drivers", label: "Conductores" },
  { href: "/operator/drivers-requested", label: "Solicitudes de conductores" },
  { href: "/operator/rides", label: "Viajes" },
  { href: "/operator/active-rides", label: "Viajes activos" },
  //{ href: "/operator/commissions", label: "Comisiones" },
  { href: "/operator/payments", label: "Pagos" },
  { href: "/operator/complaints", label: "Quejas" },
  { href: "/operator/reports", label: "Reportes" },

];

function getItems(role: Role): NavItem[] {
  return role === "admin" ? ADMIN_ITEMS : OPERATOR_ITEMS;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = getItems(role);

  async function handleLogout() {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("cmsUser");
      }
      await signOut(firebaseAuth);
    } catch (err) {
      // noop
    }
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen w-64 flex-col border-r ${themeColors.surface} ${themeColors.surfaceBorder}`}
    >
      <div className="px-4 py-4">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${themeColors.textSecondary}`}
        >
          {role === "admin" ? "Administrador" : "Operador"}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-2 pb-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? `${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryText}`
                  : `${themeColors.textSecondary} hover:bg-zinc-100`
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-2 py-3">
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full rounded-md px-3 py-2 text-left text-sm ${themeColors.textSecondary} hover:bg-zinc-100`}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
