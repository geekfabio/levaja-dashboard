"use client";

import { useMemo, useState } from "react";
import ModuleHeader from "@/components/_common/module-header";
import TotalsBar from "@/components/_common/totals/totals-bar";
import FilterMenu from "@/components/_common/filter-menu";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  AUDIT_MODULES,
  AUDIT_MODULE_TONES,
  SYSTEM_ACTOR,
  type AuditEvent,
} from "@/data/audit";
import { profileByName } from "@/data/companies";
import { useNow } from "@/hooks/use-now";
import {
  ANY_ACTOR,
  ANY_MODULE,
  DEFAULT_AUDIT_FILTERS,
  auditActors,
  auditCsvRows,
  filterAudit,
  groupAuditByDay,
} from "@/lib/audit";
import { downloadCsv } from "@/lib/csv";
import { formatDayHeading, formatNumber, formatTime, nowLuandaLocal, plural } from "@/lib/format";
import { useAuditStore } from "@/stores/audit-store";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

const MODULE_OPTIONS = [
  { value: ANY_MODULE, label: "Todos os módulos" },
  ...AUDIT_MODULES.map((module) => ({ value: module, label: module })),
];

function eventsLabel(count: number) {
  return count === 1 ? "1 alteração" : `${count} alterações`;
}

function AuditRow({ event }: { event: AuditEvent }) {
  const openTarget = useOpenTarget();
  const actor = profileByName(event.actor);
  const linkable = Boolean(event.target.id);

  return (
    <li className="flex gap-3 px-5 py-4">
      {event.actor === SYSTEM_ACTOR ? (
        <span
          aria-hidden
          className="bg-muted caption-style text-soft mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full shadow-[0px_0px_0px_1px_var(--border)]"
        >
          A
        </span>
      ) : (
        <Avatar src={actor.avatar} alt="" className="mt-0.5 size-7" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="p-style text-soft min-w-0">
            <span className="text-foreground font-medium">{event.actor}</span> {event.action}{" "}
            {linkable ? (
              <Button
                variant="link"
                size="none"
                className="inline whitespace-normal text-left font-medium"
                onClick={() => openTarget(event.target)}
              >
                {event.target.label}
              </Button>
            ) : (
              <span className="text-foreground font-medium">{event.target.label}</span>
            )}
          </p>
          <time dateTime={event.at} className="caption-style text-subtle shrink-0 tabular-nums">
            {formatTime(event.at)}
          </time>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={AUDIT_MODULE_TONES[event.target.module]} size="sm">
            {event.target.module}
          </Tag>
          {event.sensitive && (
            <Tag tone="amber" size="sm" className="gap-1">
              <AlertIcon aria-hidden className="size-3" />
              Dados sensíveis
            </Tag>
          )}
        </div>

        {event.changes.length > 0 && (
          <dl className="border-line-strong grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg border bg-white/2 px-3 py-2.5">
            {event.changes.map((change) => (
              <div key={change.field} className="contents">
                <dt className="caption-style text-subtle">{change.field}</dt>
                <dd className="caption-style flex min-w-0 flex-wrap items-center gap-x-1.5">
                  {change.from !== undefined && (
                    <>
                      <span className="text-subtle line-through decoration-white/30">
                        {change.from}
                      </span>
                      <span aria-label="passou a" className="text-subtle">
                        →
                      </span>
                    </>
                  )}
                  <span className="text-foreground">{change.to ?? "—"}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}

export default function Audit() {
  const events = useAuditStore((state) => state.events);
  const [filters, setFilters] = useState(DEFAULT_AUDIT_FILTERS);
  const now = useNow();

  const visible = useMemo(() => filterAudit(events, filters), [events, filters]);
  const groups = useMemo(() => groupAuditByDay(visible), [visible]);
  const actorOptions = useMemo(
    () => [
      { value: ANY_ACTOR, label: "Todas as pessoas" },
      ...auditActors(events).map((actor) => ({ value: actor, label: actor })),
    ],
    [events],
  );
  const filtered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_AUDIT_FILTERS);
  const sensitiveCount = visible.filter((event) => event.sensitive).length;
  const today = now === null ? null : nowLuandaLocal(new Date(now)).slice(0, 10);
  const todayCount = visible.filter((event) => event.at.startsWith(today ?? "-")).length;

  function update<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Auditoria" count={visible.length} />
      <TotalsBar
        id="auditoria"
        summary={`${plural(visible.length, "alteração", "alterações")} · ${formatNumber(sensitiveCount)} em dados sensíveis`}
        items={[
          { key: "total", label: "Alterações", value: formatNumber(visible.length), hint: "com os filtros atuais" },
          { key: "hoje", label: "Hoje", value: now === null ? "—" : formatNumber(todayCount) },
          {
            key: "sensiveis",
            label: "Dados sensíveis",
            value: formatNumber(sensitiveCount),
            hint: "consentimentos, envios, acessos",
            tone: sensitiveCount > 0 ? "warning" : undefined,
            pressed: filters.sensitiveOnly,
            onSelect: () => update("sensitiveOnly", !filters.sensitiveOnly),
          },
          { key: "pessoas", label: "Pessoas", value: formatNumber(new Set(visible.map((event) => event.actor)).size) },
          { key: "modulos", label: "Módulos", value: formatNumber(new Set(visible.map((event) => event.target.module)).size) },
        ]}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Pesquisar no registo"
            data-page-search
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Pesquisar pessoa, registo ou campo…"
            className="h-[30px] w-full sm:w-[240px]"
          />
          <FilterMenu
            label="Módulo"
            value={filters.module}
            options={MODULE_OPTIONS}
            onChange={(value) => update("module", value)}
          />
          <FilterMenu
            label="Pessoa"
            value={filters.actor}
            options={actorOptions}
            onChange={(value) => update("actor", value)}
          />
          <Button
            variant={filters.sensitiveOnly ? "primary" : "secondary"}
            size="sm"
            aria-pressed={filters.sensitiveOnly}
            onClick={() => update("sensitiveOnly", !filters.sensitiveOnly)}
          >
            <AlertIcon aria-hidden className="size-3" />
            Só dados sensíveis
          </Button>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_AUDIT_FILTERS)}>
              Limpar filtros
            </Button>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={visible.length === 0}
          onClick={() =>
            downloadCsv(`auditoria-${nowLuandaLocal().slice(0, 10)}.csv`, auditCsvRows(visible))
          }
        >
          <ShareIcon aria-hidden className="size-3" />
          Exportar
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {groups.map(([day, dayEvents]) => (
          <section key={day} aria-labelledby={`audit-day-${day}`}>
            <h2
              id={`audit-day-${day}`}
              className="eyebrow-style text-subtle bg-background/95 border-border sticky top-0 z-10 flex items-center justify-between border-y px-5 py-2 font-normal backdrop-blur"
            >
              <span>{formatDayHeading(day, now)}</span>
              <span className="normal-case tracking-normal">{eventsLabel(dayEvents.length)}</span>
            </h2>
            <ol className="divide-border divide-y">
              {dayEvents.map((event) => (
                <AuditRow key={event.id} event={event} />
              ))}
            </ol>
          </section>
        ))}

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="lead-style font-medium">Nada no registo com estes filtros</span>
            <span className="caption-style text-subtle max-w-[32em]">
              Experimente outro módulo ou pessoa, ou limpe os filtros para ver todas as alterações.
            </span>
            {filtered && (
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setFilters(DEFAULT_AUDIT_FILTERS)}>
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
