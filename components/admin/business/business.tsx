"use client";

import { useCallback, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SearchField from "@/components/admin/shared/search-field";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useBusinessAccounts } from "@/hooks/admin/use-commerce";
import { formatKz, formatNumber, formatPercent, luandaDay } from "@/lib/format";
import { canAccessSection, hasPermission } from "@/lib/leva-ja/permissions";
import { cn } from "@/lib/utils";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import BusinessSheet from "./detail/business-sheet";
import BusinessDialog from "./dialogs/business-dialog";

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "suspended", label: "Suspensas" },
];

export default function Business() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useBusinessAccounts({ status: status === "all" ? undefined : [status as "active" | "suspended"], q: q || undefined, page, pageSize: 15 });
  const all = useBusinessAccounts({ pageSize: 200 });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  if (!role) return null;
  const canManage = hasPermission(role, "business.manage");
  const items = all.data?.items;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Contas empresariais" count={list.data?.total} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <SummaryTiles
            tiles={
              items
                ? [
                    { label: "Contas activas", value: items.filter((item) => item.status === "active").length, display: formatNumber(items.filter((item) => item.status === "active").length) },
                    { label: "A facturar este mês", value: items.reduce((sum, item) => sum + item.currentMonth.net, 0), display: formatKz(items.reduce((sum, item) => sum + item.currentMonth.net, 0)) },
                    { label: "Em dívida", value: items.reduce((sum, item) => sum + item.outstanding, 0), display: formatKz(items.reduce((sum, item) => sum + item.outstanding, 0)) },
                    { label: "Em atraso", value: items.reduce((sum, item) => sum + item.overdue, 0), display: formatKz(items.reduce((sum, item) => sum + item.overdue, 0)) },
                  ]
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchField label="Pesquisar empresas" placeholder="Nome, NIF, responsável ou sector" onSearch={onSearch} />
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
                Nova conta
              </Button>
            )}
          </div>
          <AsyncState
            query={list}
            skeleton={<Skeleton className="h-60 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(data) => data.items.length === 0}
            empty={{ title: "Sem contas empresariais", description: "Não há contas com estes filtros." }}
          >
            {(data) => (
              <div className="border-border bg-card flex flex-col rounded-xl border">
                <div className="overflow-x-auto">
                  <Table aria-label="Contas empresariais" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Empresa</TableHead>
                        <TableHead scope="col" className="text-right">
                          Utilizadores
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Desconto
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Este mês
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Em dívida
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Crédito usado
                        </TableHead>
                        <TableHead scope="col">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <Button variant="link" size="none" onClick={() => setOpenId(account.id)}>
                              {account.name}
                            </Button>
                            <span className="caption-style text-subtle block pt-0.5">
                              {account.sector} · NIF {account.nif}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(account.members)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPercent(account.contract.discountRate * 100)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatKz(account.currentMonth.net)}
                            <span className="caption-style text-subtle block pt-0.5">{formatNumber(account.currentMonth.count)} pedido(s)</span>
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", account.overdue > 0 && "text-danger")}>{formatKz(account.outstanding)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", account.overLimit && "text-danger")}>
                            {formatKz(account.creditUsed)}
                            <span className="caption-style text-subtle block pt-0.5">de {formatKz(account.contract.creditLimit)}</span>
                          </TableCell>
                          <TableCell>
                            <ToneBadge tone={account.status === "active" ? (account.overLimit ? "warning" : "success") : "danger"} label={account.status === "active" ? (account.overLimit ? "Acima do limite" : "Activa") : "Suspensa"} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das contas empresariais" className="border-border border-t" />
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      <BusinessSheet accountId={openId} onClose={() => setOpenId(null)} canManage={canManage} canOpenClients={canAccessSection(role, "clients")} />
      <BusinessDialog key={creating ? "open" : "closed"} open={creating} onOpenChange={setCreating} today={luandaDay(new Date(now))} />
    </section>
  );
}
