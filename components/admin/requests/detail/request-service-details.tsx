import DetailList from "@/components/admin/shared/detail-list";
import type { DetailItem } from "@/components/admin/shared/detail-list";
import { formatDateTimeNumeric, formatDecimal, formatNumber } from "@/lib/format";
import { CARGO_TYPE_LABELS, SERVICE_LABELS, TOW_INCIDENT_LABELS } from "@/lib/leva-ja/services";
import type { ServiceRequest } from "@/types/leva-ja";

export default function RequestServiceDetails({ request, zoneName }: { request: ServiceRequest; zoneName: string }) {
  const { details } = request;
  const items: DetailItem[] = [
    { label: "Serviço", value: SERVICE_LABELS[request.kind] },
    { label: "Zona", value: zoneName },
    { label: "Criado em", value: formatDateTimeNumeric(request.createdAt) },
    { label: "Agendado para", value: request.scheduledFor ? formatDateTimeNumeric(request.scheduledFor) : "Imediato" },
  ];
  if (details.kind === "tow") {
    items.push(
      { label: "Ocorrência", value: TOW_INCIDENT_LABELS[details.incident] },
      { label: "Viatura a rebocar", value: `${details.vehicle.brand} ${details.vehicle.model} · ${details.vehicle.plate}` },
    );
  } else if (details.kind === "cargo") {
    items.push(
      { label: "Tipo de carga", value: CARGO_TYPE_LABELS[details.cargoType] },
      { label: "Peso e volume", value: `${formatNumber(details.weightKg)} kg · ${formatDecimal(details.volumeM3, 1)} m³` },
    );
  } else {
    items.push(
      { label: "Divisões", value: formatNumber(details.rooms) },
      { label: "Pisos", value: `${formatNumber(details.floors)} · ${details.hasElevator ? "com elevador" : "sem elevador"}` },
      { label: "Ajudantes", value: formatNumber(details.helpers) },
    );
  }
  return <DetailList items={items} />;
}
