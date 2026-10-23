"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import StatTile from "@/components/_common/stat-tile";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { useRefundSummary } from "@/hooks/admin/use-refunds";
import { formatKz, formatNumber } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import RefundsTable from "./table/refunds-table";

function RefundSummaryTiles() {
  const summary = useRefundSummary();
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
    { label: "Por aprovar", value: data.pendingCount, display: formatNumber(data.pendingCount) },
    { label: "Valor por aprovar", value: data.pendingAmount, display: formatKz(data.pendingAmount) },
    { label: "Aprovado por devolver", value: data.approvedAmount, display: formatKz(data.approvedAmount) },
    { label: "Devolvido em 30 dias", value: data.paidLast30, display: formatKz(data.paidLast30) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile, index) => (
        <StatTile key={tile.label} index={index} {...tile} />
      ))}
    </div>
  );
}

export default function Refunds() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  if (!role) return null;
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Reembolsos" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <RefundSummaryTiles />
          <RefundsTable canDecide={hasPermission(role, "refunds.decide")} canOpenRequest={hasPermission(role, "requests.view")} />
        </div>
      </ScrollArea>
    </section>
  );
}
