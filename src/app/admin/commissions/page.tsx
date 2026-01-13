import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function AdminCommissionsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Comisiones
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Configuración y supervisión de comisiones globales.
      </p>
    </section>
  );
}
