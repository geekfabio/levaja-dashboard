"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import { ANY, CAMPAIGN_STATUSES, CHANNEL_LABELS, type Channel } from "@/data/campaigns";
import { useCampaignsStore } from "@/stores/campaigns-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const CHANNEL_OPTIONS = [
  { value: ANY, label: "Todos os canais" },
  ...(Object.keys(CHANNEL_LABELS) as Channel[]).map((channel) => ({
    value: channel,
    label: CHANNEL_LABELS[channel],
  })),
];

const STATUS_OPTIONS = [
  { value: ANY, label: "Qualquer estado" },
  ...CAMPAIGN_STATUSES.map((status) => ({ value: status, label: status })),
];

export default function CampaignsToolbar() {
  const channel = useCampaignsStore((state) => state.channel);
  const status = useCampaignsStore((state) => state.status);
  const search = useCampaignsStore((state) => state.search);
  const setChannel = useCampaignsStore((state) => state.setChannel);
  const setStatus = useCampaignsStore((state) => state.setStatus);
  const setSearch = useCampaignsStore((state) => state.setSearch);
  const setLibraryOpen = useCampaignsStore((state) => state.setLibraryOpen);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Pesquisar campanhas"
          data-page-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar campanha ou assunto…"
          className="h-[30px] w-full sm:w-[220px]"
        />
        <FilterMenu label="Canal" value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} />
        <FilterMenu label="Estado" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </div>
      <Button variant="primary" size="sm" onClick={() => setLibraryOpen(true)}>
        <PlusIcon aria-hidden className="size-3" />
        Nova Campanha
      </Button>
    </div>
  );
}
