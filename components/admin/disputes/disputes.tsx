"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import StatTile from "@/components/_common/stat-tile";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { useDisputeSummary } from "@/hooks/admin/use-disputes";
import { formatKz, formatNumber } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import DisputeSheet from "./detail/dispute-sheet";
import DisputesTable from "./table/disputes-table";

function DisputeSummaryTiles() {
  const summary = useDisputeSummary();
  if (!summary.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  const data = summary.data;
  const tiles = [
    { label: "Abertas", value: data.open, display: formatNumber(data.open) },
    { label: "Fora do prazo", value: data.overdue, display: formatNumber(data.overdue) },
    { label: "Resolvidas em 30 dias", value: data.resolvedLast30, display: formatNumber(data.resolvedLast30) },
    { label: "Reembolsos por disputa em 30 dias", value: data.refundedLast30, display: formatKz(data.refundedLast30) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile, index) => (
        <StatTile key={tile.label} index={index} {...tile} />
      ))}
    </div>
  );
}

export default function Disputes() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!role) return null;
  const canSeeRefunds = hasPermission(role, "refunds.request") || hasPermission(role, "refunds.decide");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Disputas" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <DisputeSummaryTiles />
          <DisputesTable onOpen={setOpenId} />
        </div>
      </ScrollArea>
      <DisputeSheet
        requestId={openId}
        onClose={() => setOpenId(null)}
        canEdit={hasPermission(role, "requests.dispute")}
        canRefund={hasPermission(role, "refunds.request")}
        canSeeRefunds={canSeeRefunds}
      />
    </section>
  );
}
