import { themeColors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function OperatorPaymentsPage() {
  return (
    <section className="space-y-2">
      <h1 className={`${typography.h1} ${themeColors.textPrimary}`}>
        Pagos
      </h1>
      <p className={`${typography.body} ${themeColors.textSecondary}`}>
        Viajes cobrados y estados de pago.
      </p>
    </section>
  );
}
