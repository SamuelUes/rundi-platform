import { RidesDashboard } from "@/components/rides/RidesDashboard";

function getOneMonthAgoDateString() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function OperatorRidesPage() {
  const defaultFrom = getOneMonthAgoDateString();

  return (
    <RidesDashboard
      title="Viajes"
      description="Consulta de viajes visibles para operadores (últimos 30 días)."
      listEndpoint="/api/operator/rides"
      routeEndpointBase="/api/admin/rides"
      defaultFromDate={defaultFrom}
    />
  );
}
