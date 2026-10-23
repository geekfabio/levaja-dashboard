"use client";

import { useCallback, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SearchField from "@/components/admin/shared/search-field";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useFleets } from "@/hooks/admin/use-network";
import { formatDecimal, formatKz, formatNumber } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { FLEET_STATUS_LABELS } from "@/lib/leva-ja/quality";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { FleetStatus } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import FleetSheet from "./detail/fleet-sheet";
import FleetDialog from "./dialogs/fleet-dialog";

const STATUS_OPTIONS = [{ value: "all", label: "Todas" }, ...(Object.keys(FLEET_STATUS_LABELS) as FleetStatus[]).map((status) => ({ value: status, label: FLEET_STATUS_LABELS[status] }))];

export default function Fleets() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useFleets({ status: status === "all" ? undefined : [status as FleetStatus], q: q || undefined, page, pageSize: 15 });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  if (!role) return null;
  const canManage = hasPermission(role, "fleets.manage");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Frotas" count={list.data?.total} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField label="Pesquisar frotas" placeholder="Nome, NIF ou responsável" onSearch={onSearch} />
            <FilterMenu
              label="Estado"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            {canManage && (
              <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
                <PlusIcon aria-hidden className="size-3" />
                Nova frota
              </Button>
            )}
          </div>
          <AsyncState
            query={list}
            skeleton={<Skeleton className="h-72 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(data) => data.items.length === 0}
            empty={{ title: "Sem frotas", description: "Não há frotas com estes filtros." }}
          >
            {(data) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Frotas" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Frota</TableHead>
                        <TableHead scope="col">Responsável</TableHead>
                        <TableHead scope="col" className="text-right">
                          Motoristas
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Online
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Serviços 30 dias
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Volume 30 dias
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Avaliação
                        </TableHead>
                        <TableHead scope="col">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((fleet) => (
                        <TableRow key={fleet.id}>
                          <TableCell>
                            <Button variant="link" size="none" onClick={() => setOpenId(fleet.id)}>
                              {fleet.name}
                            </Button>
                            <span className="caption-style text-subtle block pt-0.5 tabular-nums">NIF {fleet.nif}</span>
                          </TableCell>
                          <TableCell>
                            {fleet.contactName}
                            <span className="caption-style text-subtle block pt-0.5 tabular-nums">{fleet.phone}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(fleet.stats.drivers)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(fleet.stats.online)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(fleet.stats.completed30)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatKz(fleet.stats.volume30)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fleet.stats.rating === null ? "—" : `${formatDecimal(fleet.stats.rating, 1)} ★`}</TableCell>
                          <TableCell>
                            <ToneBadge tone={fleet.status === "active" ? "success" : "danger"} label={FLEET_STATUS_LABELS[fleet.status]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das frotas" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <FleetSheet fleetId={openId} onClose={() => setOpenId(null)} canManage={canManage} />
      <FleetDialog open={creating} onOpenChange={setCreating} />
    </section>
  );
}
