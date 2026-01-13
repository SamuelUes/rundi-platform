"use client";

import { CmsAuthGuard } from "@/components/CmsAuthGuard";
import { themeColors } from "@/theme/colors";

export default function AdminHomePage() {
  return (
    <CmsAuthGuard requiredRole="admin">
      <main className={`flex min-h-screen flex-col ${themeColors.appBackground}`}>
        <header className={`border-b px-6 py-4 ${themeColors.surface}`}>
          <h1 className={`text-xl font-semibold ${themeColors.textPrimary}`}>
            Panel de administración
          </h1>
          <p className={`text-sm ${themeColors.textSecondary}`}>
            Vista general para administradores de Rundi.
          </p>
        </header>
        <section className="flex-1 px-6 py-8">
          <p className={`text-sm ${themeColors.textSecondary}`}>
            Aquí agregaremos dashboards, reportes y gestión avanzada de usuarios,
            conductores, servicios y pagos.
          </p>
        </section>
      </main>
    </CmsAuthGuard>
  );
}
