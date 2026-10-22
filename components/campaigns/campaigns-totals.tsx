"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import { ANY, type Campaign, type CampaignStatus } from "@/data/campaigns";
import { formatNumber, formatPercentDecimal, plural } from "@/lib/format";
import { useCampaignsStore } from "@/stores/campaigns-store";

export default function CampaignsTotals({ campaigns }: { campaigns: Campaign[] }) {
  const status = useCampaignsStore((state) => state.status);
  const setStatus = useCampaignsStore((state) => state.setStatus);
  const by = (value: CampaignStatus) => campaigns.filter((campaign) => campaign.status === value);
  const sent = by("Enviada");
  const delivered = sent.reduce((sum, campaign) => sum + (campaign.metrics?.delivered ?? 0), 0);
  const opened = sent.reduce((sum, campaign) => sum + (campaign.metrics?.opened ?? 0), 0);
  const recipients = sent.reduce((sum, campaign) => sum + campaign.recipients, 0);

  function tile(key: string, label: string, value: CampaignStatus) {
    return {
      key,
      label,
      value: formatNumber(by(value).length),
      pressed: status === value,
      onSelect: () => setStatus(status === value ? ANY : value),
    };
  }

  return (
    <TotalsBar
      id="campanhas"
      summary={`${plural(campaigns.length, "campanha", "campanhas")} · ${plural(recipients, "destinatário", "destinatários")}`}
      items={[
        { key: "total", label: "Campanhas", value: formatNumber(campaigns.length) },
        tile("rascunhos", "Rascunhos", "Rascunho"),
        tile("revisao", "Em revisão", "Em revisão"),
        tile("agendadas", "Agendadas", "Agendada"),
        { ...tile("enviadas", "Enviadas", "Enviada"), hint: plural(recipients, "destinatário", "destinatários") },
        {
          key: "abertura",
          label: "Taxa de abertura",
          value: delivered ? formatPercentDecimal((opened / delivered) * 100) : "—",
          hint: "média das enviadas",
        },
      ]}
    />
  );
}
