import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function OperatorReportsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Reportes
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Reportes operativos rápidos para el call center.
      </p>
    </section>
  );
}
