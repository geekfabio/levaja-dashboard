import Button from "@/components/_ui/button";
import DetailList from "@/components/admin/shared/detail-list";
import { formatDecimal } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; canOpenClient: boolean; canOpenProvider: boolean };

export function ClientCard({ request, canOpenClient }: Omit<Props, "canOpenProvider">) {
  const client = request.client;
  if (!client) return <p className="caption-style text-subtle">Cliente desconhecido.</p>;
  return (
    <div className="flex flex-col gap-3">
      <DetailList
        items={[
          { label: "Nome", value: client.name },
          { label: "Telefone", value: <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="hover:underline">{client.phone}</a> },
          { label: "E-mail", value: client.email, wide: true },
          { label: "Avaliação como cliente", value: `${formatDecimal(client.rating, 1)} ★` },
        ]}
      />
      {canOpenClient && (
        <Button variant="secondary" size="sm" href={`${SECTION_ROUTES.clients}/${client.id}`} className="self-start">
          Ver cliente
        </Button>
      )}
    </div>
  );
}

export function ProviderCard({ request, canOpenProvider }: Omit<Props, "canOpenClient">) {
  const provider = request.provider;
  if (!provider) return <p className="caption-style text-subtle">Ainda sem prestador atribuído.</p>;
  return (
    <div className="flex flex-col gap-3">
      <DetailList
        items={[
          { label: "Nome", value: provider.name },
          { label: "Telefone", value: <a href={`tel:${provider.phone.replace(/\s/g, "")}`} className="hover:underline">{provider.phone}</a> },
          { label: "Viatura", value: `${provider.vehicle.brand} ${provider.vehicle.model} · ${provider.vehicle.plate}`, wide: true },
          { label: "Avaliação", value: `${formatDecimal(provider.rating, 1)} ★ (${provider.reviewsCount})` },
          { label: "Verificado", value: provider.verified ? "Sim" : "Não" },
        ]}
      />
      {canOpenProvider && (
        <Button variant="secondary" size="sm" href={`${SECTION_ROUTES.providers}/${provider.id}`} className="self-start">
          Ver prestador
        </Button>
      )}
    </div>
  );
}
