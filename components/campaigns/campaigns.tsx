"use client";

import { useMemo } from "react";
import ModuleHeader from "@/components/_common/module-header";
import CampaignsToolbar from "./toolbar/toolbar";
import CampaignsTotals from "./campaigns-totals";
import CampaignsTable from "./table/campaigns-table";
import CampaignEditor from "./editor/campaign-editor";
import TemplateLibraryDialog from "./library/template-library-dialog";
import { filterCampaigns } from "@/lib/campaigns";
import { useCampaignsStore } from "@/stores/campaigns-store";

export default function Campaigns() {
  const campaigns = useCampaignsStore((state) => state.campaigns);
  const channel = useCampaignsStore((state) => state.channel);
  const status = useCampaignsStore((state) => state.status);
  const search = useCampaignsStore((state) => state.search);
  const editorId = useCampaignsStore((state) => state.editorId);

  const visible = useMemo(
    () => filterCampaigns(campaigns, { channel, status, search }),
    [campaigns, channel, status, search],
  );

  const editing = campaigns.find((campaign) => campaign.id === editorId);

  return (
    <>
      {editing ? (
        <CampaignEditor campaign={editing} />
      ) : (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ModuleHeader title="Campanhas" count={visible.length} />
          <CampaignsTotals campaigns={visible} />
          <CampaignsToolbar />
          <CampaignsTable campaigns={visible} />
        </section>
      )}
      <TemplateLibraryDialog />
    </>
  );
}
