import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function OperatorCommissionsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Comisiones
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Comisiones pendientes y pagadas asociadas a conductores.
      </p>
    </section>
  );
}
