import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function OperatorCallsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Llamadas y mensajes
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Panel para gestionar llamadas y conversaciones con usuarios y conductores.
      </p>
    </section>
  );
}
