"use client";

import { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage, repositories } from "@/data/leva-ja";
import type { AuditFilters } from "@/data/leva-ja";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAuditLog } from "@/hooks/admin/use-audit";
import { useClock } from "@/hooks/admin/use-clock";
import { downloadCsv } from "@/lib/csv";
import { formatDateTimeNumeric, luandaDay } from "@/lib/format";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/leva-ja/audit";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { toast } from "@/stores/toast-store";
import type { AuditAction, AuditEntityKind, AuditLogEntry } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

const ENTITY_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(AUDIT_ENTITY_LABELS) as AuditEntityKind[]).map((kind) => ({ value: kind, label: AUDIT_ENTITY_LABELS[kind] }))];
const ACTION_OPTIONS = [{ value: "all", label: "Todas" }, ...(Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] }))];

function entityHref(entry: AuditLogEntry) {
  const { kind, id } = entry.entity;
  if (kind === "request") return `${SECTION_ROUTES.requests}/${id}`;
  if (kind === "provider") return `${SECTION_ROUTES.providers}/${id}`;
  if (kind === "client") return `${SECTION_ROUTES.clients}/${id}`;
  if (kind === "document") return SECTION_ROUTES.documents;
  if (kind === "withdrawal") return SECTION_ROUTES.finance;
  if (kind === "refund") return SECTION_ROUTES.refunds;
  if (kind === "pricing" || kind === "zone") return SECTION_ROUTES.pricing;
  if (kind === "ticket" || kind === "sos" || kind === "review") return SECTION_ROUTES.support;
  if (kind === "admin_user") return SECTION_ROUTES.users;
  return null;
}

export default function AuditLog() {
  const now = useClock();
  const users = useAdminUsers();
  const [actor, setActor] = useState("all");
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const filters: Omit<AuditFilters, "page" | "pageSize"> = {
    actorId: actor === "all" ? undefined : actor,
    entityKind: entity === "all" ? undefined : [entity as AuditEntityKind],
    action: action === "all" ? undefined : [action as AuditAction],
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const log = useAuditLog({ ...filters, page, pageSize: 25 });
  const actorOptions = [{ value: "all", label: "Todos" }, ...(users.data ?? []).map((user) => ({ value: user.id, label: user.name }))];
  const filtered = Object.values(filters).some((value) => value !== undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: AuditLogEntry[] = [];
      for (let current = 1; ; current += 1) {
        const result = await repositories().audit.list({ ...filters, page: current, pageSize: 200 });
        rows.push(...result.items);
        if (current * result.pageSize >= result.total) break;
      }
      downloadCsv(`auditoria-leva-ja-${luandaDay(new Date(now))}.csv`, [
        ["Data", "Quem", "Papel", "Acção", "Registo", "Motivo", "Alterações"],
        ...rows.map((entry) => [
          formatDateTimeNumeric(entry.at),
          entry.actorName,
          ROLE_LABELS[entry.actorRole],
          AUDIT_ACTION_LABELS[entry.action],
          `${AUDIT_ENTITY_LABELS[entry.entity.kind]}: ${entry.entity.label}`,
          entry.reason ?? "",
          (entry.changes ?? []).map((item) => `${item.field}: ${item.from} → ${item.to}`).join(" | "),
        ]),
      ]);
      toast({ title: "Exportação concluída", description: `${rows.length} registos exportados para CSV.`, tone: "success" });
    } catch (error) {
      toast({ title: "Não foi possível exportar", description: errorMessage(error), tone: "danger" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Auditoria"
        count={log.data?.total}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={exporting}>
            <ShareIcon aria-hidden className="size-3.5" />
            {exporting ? "A exportar…" : "Exportar CSV"}
          </Button>
        }
      />
      <div className="flex shrink-0 flex-col gap-2 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
            <span className="sr-only">Pesquisar por registo, motivo ou pessoa</span>
            <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
            <Input type="search" value={query} placeholder="Registo, motivo ou pessoa" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
          </label>
          <FilterMenu label="Quem" value={actor} options={actorOptions} onChange={change(setActor)} />
          <FilterMenu label="Registo" value={entity} options={ENTITY_OPTIONS} onChange={change(setEntity)} />
          <FilterMenu label="Acção" value={action} options={ACTION_OPTIONS} onChange={change(setAction)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="caption-style text-subtle flex items-center gap-2">
            De
            <Input type="date" value={from} max={to || undefined} onChange={(event) => change(setFrom)(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
          </label>
          <label className="caption-style text-subtle flex items-center gap-2">
            Até
            <Input type="date" value={to} min={from || undefined} onChange={(event) => change(setTo)(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
          </label>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActor("all");
                setEntity("all");
                setAction("all");
                setFrom("");
                setTo("");
                setQuery("");
                setPage(1);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
      <div className="border-border relative flex min-h-0 flex-1 flex-col border-t">
        <AsyncState
          query={log}
          skeleton={
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 10 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          }
          errorDescription={errorMessage}
          isEmpty={(data) => data.items.length === 0}
          empty={{ title: filtered ? "Nenhum registo com estes filtros" : "Ainda não há registos" }}
        >
          {(data) => (
            <>
              <ScrollArea orientation="both" className="min-h-0 flex-1">
                <Table aria-label="Registo de auditoria" className={log.isPlaceholderData ? "opacity-60" : undefined}>
                  <TableHeader className="bg-background sticky top-0 z-10">
                    <TableRow>
                      <TableHead scope="col">Quando</TableHead>
                      <TableHead scope="col">Quem</TableHead>
                      <TableHead scope="col">Acção</TableHead>
                      <TableHead scope="col">Registo</TableHead>
                      <TableHead scope="col">Motivo e alterações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((entry) => {
                      const href = entityHref(entry);
                      return (
                        <TableRow key={entry.id} className="align-top">
                          <TableCell className="text-soft py-3 align-top tabular-nums">{formatDateTimeNumeric(entry.at)}</TableCell>
                          <TableCell className="py-3 align-top">
                            <span className="flex flex-col gap-1">
                              <span>{entry.actorName}</span>
                              <span className="caption-style text-subtle">{ROLE_LABELS[entry.actorRole]}</span>
                            </span>
                          </TableCell>
                          <TableCell className="py-3 align-top font-medium">{AUDIT_ACTION_LABELS[entry.action]}</TableCell>
                          <TableCell className="max-w-[260px] py-3 align-top whitespace-normal">
                            <span className="caption-style text-subtle block">{AUDIT_ENTITY_LABELS[entry.entity.kind]}</span>
                            {href ? (
                              <Button variant="link" size="none" href={href} className="text-left whitespace-normal">
                                {entry.entity.label}
                              </Button>
                            ) : (
                              entry.entity.label
                            )}
                          </TableCell>
                          <TableCell className="max-w-[420px] py-3 align-top whitespace-normal">
                            <span className="flex flex-col gap-1">
                              {entry.reason ? <span className="caption-style text-soft">{entry.reason}</span> : <span className="caption-style text-subtle">Sem motivo</span>}
                              {entry.changes?.map((item) => (
                                <span key={item.field} className="caption-style text-subtle">
                                  {item.field}: {item.from} → {item.to}
                                </span>
                              ))}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação da auditoria" className="border-border border-t" />
            </>
          )}
        </AsyncState>
      </div>
    </section>
  );
}
