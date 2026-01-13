import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function OperatorComplaintsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Quejas
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Registro y consulta de quejas de usuarios y conductores.
      </p>
    </section>
  );
}
