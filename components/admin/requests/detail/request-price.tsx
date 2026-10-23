import Tag from "@/components/_ui/tag";
import { formatKz } from "@/lib/format";
import type { ServiceRequest } from "@/types/leva-ja";

const PROPOSAL_LABELS = { sent: "Enviada ao cliente", accepted: "Aceite", declined: "Recusada" } as const;
const PROPOSAL_TONES = { sent: "amber", accepted: "green", declined: "red" } as const;

export default function RequestPrice({ request }: { request: ServiceRequest }) {
  const { price } = request;
  const serviceValue = price.total - price.platformFee;
  const commission = serviceValue - request.providerEarning;
  const rows = [
    { label: "Base", value: price.base },
    { label: "Distância", value: price.distance },
    { label: "Extras", value: price.extras },
    { label: "Taxa da plataforma", value: price.platformFee },
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="divide-border flex flex-col divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2 first:pt-0">
            <dt className="caption-style text-soft">{row.label}</dt>
            <dd className="lead-style tabular-nums">{formatKz(row.value)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="lead-style font-medium">Total pago pelo cliente</dt>
          <dd className="lead-style font-semibold tabular-nums">{formatKz(price.total)}</dd>
        </div>
      </dl>
      <dl className="bg-muted/60 flex flex-col gap-2 rounded-lg p-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="caption-style text-soft">Comissão (plataforma)</dt>
          <dd className="caption-style tabular-nums">{formatKz(commission)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="caption-style text-soft">Ganho do prestador</dt>
          <dd className="caption-style tabular-nums">{formatKz(request.providerEarning)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="caption-style text-soft">Receita da plataforma</dt>
          <dd className="caption-style tabular-nums">{formatKz(commission + price.platformFee)}</dd>
        </div>
      </dl>
      {request.proposal && (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="lead-style font-medium">Proposta do prestador</span>
            <Tag tone={PROPOSAL_TONES[request.proposal.status]} size="sm">
              {PROPOSAL_LABELS[request.proposal.status]}
            </Tag>
          </div>
          <span className="lead-style tabular-nums">{formatKz(request.proposal.amount)}</span>
          <span className="caption-style text-subtle">{request.proposal.reason}</span>
        </div>
      )}
    </div>
  );
}
