"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import FunnelBars from "@/components/_common/charts/funnel-bars";
import SettingsPanel from "@/components/settings/settings-panel";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { useApplicationSummary, useFleets } from "@/hooks/admin/use-network";
import { useZones } from "@/hooks/admin/use-zones";
import { formatDecimal, formatNumber } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { APPLICATION_STAGE_LABELS } from "@/lib/leva-ja/quality";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import ApplicationSheet from "./detail/application-sheet";
import ApplicationsTable from "./table/applications-table";

export default function Applications() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const summary = useApplicationSummary();
  const zones = useZones();
  const canSeeFleets = role ? hasPermission(role, "fleets.view") : false;
  const fleets = useFleets({ pageSize: 100 }, canSeeFleets);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!role) return null;
  const data = summary.data;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Candidaturas" count={data?.open} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <SummaryTiles
            tiles={
              data
                ? [
                    { label: "Em curso", value: data.open, display: formatNumber(data.open) },
                    { label: "Aprovadas em 30 dias", value: data.approvedLast30, display: formatNumber(data.approvedLast30) },
                    { label: "Recusadas em 30 dias", value: data.rejectedLast30, display: formatNumber(data.rejectedLast30) },
                    {
                      label: "Dias até aprovar (média)",
                      value: data.averageDaysToApprove ?? 0,
                      display: data.averageDaysToApprove === null ? "—" : formatDecimal(data.averageDaysToApprove, 1),
                    },
                  ]
                : null
            }
          />
          <SettingsPanel title="Funil de candidaturas" description="Quantas candidaturas chegaram a cada etapa, da inscrição à aprovação." className="bg-card">
            {data ? (
              <FunnelBars steps={data.funnel.map((item) => ({ key: item.stage, label: APPLICATION_STAGE_LABELS[item.stage], count: item.count }))} />
            ) : (
              <Skeleton className="h-48" />
            )}
          </SettingsPanel>
          <ApplicationsTable zones={zones.data ?? []} onOpen={setOpenId} />
        </div>
      </ScrollArea>
      <ApplicationSheet
        applicationId={openId}
        onClose={() => setOpenId(null)}
        zones={zones.data ?? []}
        fleets={canSeeFleets ? (fleets.data?.items ?? []) : []}
      />
    </section>
  );
}
