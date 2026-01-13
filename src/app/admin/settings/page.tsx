import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function AdminSettingsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Configuración
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Parámetros globales de la aplicación, flags y ajustes avanzados.
      </p>
    </section>
  );
}
