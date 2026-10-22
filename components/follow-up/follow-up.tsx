"use client";

import { useMemo, useState } from "react";
import ModuleHeader from "@/components/_common/module-header";
import FilterMenu from "@/components/_common/filter-menu";
import TotalsBar from "@/components/_common/totals/totals-bar";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import { CURRENT_USER, OWNERS, profileByName } from "@/data/companies";
import { formatNumber, nowLuandaLocal, plural } from "@/lib/format";
import {
  FOLLOW_UP_BUCKETS,
  FOLLOW_UP_KIND_LABELS,
  FOLLOW_UP_KIND_TONES,
  addDays,
  followUpDueLabel,
  type FollowUpBucket,
  type FollowUpItem,
} from "@/lib/follow-up";
import { cn, slugify } from "@/lib/utils";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";
import { useSettingsStore } from "@/stores/settings-store";
import { CALENDAR_PROVIDERS } from "@/data/calendar-sync";
import Asset from "@/components/_ui/asset";
import { useRouter } from "next/navigation";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useFollowUps } from "./use-follow-ups";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

const ALL = "all";
const POSTPONE = [
  { label: "Amanhã", days: 1 },
  { label: "Daqui a 3 dias", days: 3 },
  { label: "Daqui a 1 semana", days: 7 },
];

const OWNER_OPTIONS = [
  { value: ALL, label: "Toda a equipa" },
  { value: CURRENT_USER.name, label: `${CURRENT_USER.name} (eu)` },
  ...OWNERS.map((owner) => ({ value: owner.name, label: owner.name })),
];

function ScheduleMenu({ label, onPick, variant = "ghost" }: { label: string; onPick: (days: number) => void; variant?: "ghost" | "secondary" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm">
          {label}
          <ChevronIcon aria-hidden className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {POSTPONE.map((option) => (
          <DropdownMenuItem key={option.days} onSelect={() => onPick(option.days)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FollowUpRow({ item, today }: { item: FollowUpItem; today: string }) {
  const openTarget = useOpenTarget();
  const startActivity = useActivitiesStore((state) => state.startActivity);
  const moveTaskStatus = useActivitiesStore((state) => state.moveTaskStatus);
  const postponeTask = useActivitiesStore((state) => state.postponeTask);
  const setOfferStatus = useAutomationRunsStore((state) => state.setOfferStatus);
  const scheduleFollowUp = useCompaniesStore((state) => state.scheduleFollowUp);
  const company = useCompaniesStore((state) => state.companies.find((entry) => entry.id === item.companyId));
  const owner = profileByName(item.owner);

  function schedule(days: number) {
    if (!item.companyId) return;
    scheduleFollowUp(item.companyId, {
      date: addDays(today, days),
      type: item.contactType ?? company?.nextFollowUp?.type ?? "Chamada",
      note: company?.nextFollowUp?.note ?? item.detail,
      owner: item.owner,
    });
  }

  function register() {
    if (!item.companyId) return;
    startActivity({
      companyId: item.companyId,
      type: item.contactType === "Visita" ? "Visita" : item.contactType === "E-mail" ? "E-mail" : item.contactType === "Reunião" ? "Reunião" : "Chamada",
      followUpNote: item.detail,
    });
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar src={owner.avatar} alt="" className="mt-0.5 size-7" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Tag tone={FOLLOW_UP_KIND_TONES[item.kind]} size="sm">
              {FOLLOW_UP_KIND_LABELS[item.kind]}
            </Tag>
            {item.companyId ? (
              <Button
                variant="link"
                size="none"
                className="text-left font-medium no-underline"
                onClick={() =>
                  openTarget(
                    item.opportunityId
                      ? { module: "Oportunidades", id: item.opportunityId, label: item.title }
                      : { module: "Clientes", id: item.companyId, label: item.title },
                  )
                }
              >
                {item.title}
              </Button>
            ) : (
              <span className="lead-style font-medium">{item.title}</span>
            )}
          </span>
          <span className="caption-style text-soft">{item.detail}</span>
          <span className="caption-style text-subtle">
            {item.owner}
            {item.due && (
              <>
                {" · "}
                <span className={cn(item.bucket === "atrasado" && "text-danger")}>
                  {followUpDueLabel(item.due, today)}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 pl-10 sm:pl-0">
        {item.offerId ? (
          <>
            <Button variant="primary" size="sm" onClick={register}>
              Registar contacto
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Resposta
                  <ChevronIcon aria-hidden className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setOfferStatus(item.offerId!, "Apresentada")}>
                  Apresentada ao cliente
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setOfferStatus(item.offerId!, "Recusada")}>
                  Cliente recusou
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : item.taskId ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => moveTaskStatus(item.taskId!, "Feita")}>
              Concluir
            </Button>
            <ScheduleMenu label="Adiar" onPick={(days) => postponeTask(item.taskId!, addDays(today, days))} />
          </>
        ) : item.kind === "agendado" ? (
          <>
            <Button variant="primary" size="sm" onClick={register}>
              Registar contacto
            </Button>
            <ScheduleMenu label="Adiar" onPick={schedule} />
          </>
        ) : (
          <>
            <ScheduleMenu label="Agendar contacto" variant="secondary" onPick={schedule} />
            <Button variant="ghost" size="sm" onClick={register}>
              Registar já
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export default function FollowUp() {
  const { items, today } = useFollowUps();
  const companies = useCompaniesStore((state) => state.companies);
  const connections = useCalendarSyncStore((state) => state.connections);
  const connectedCalendars = CALENDAR_PROVIDERS.filter((provider) => connections[provider.id]);
  const router = useRouter();
  const [owner, setOwner] = useState<string>(ALL);
  const [bucket, setBucket] = useState<FollowUpBucket | null>(null);

  const mine = useMemo(() => items.filter((item) => owner === ALL || item.owner === owner), [items, owner]);
  const count = (key: FollowUpBucket) => mine.filter((item) => item.bucket === key).length;
  const sections = FOLLOW_UP_BUCKETS.filter((section) => !bucket || section.key === bucket);

  function exportCalendar() {
    const events = mine
      .filter((item) => item.due && item.bucket !== "sugestao")
      .map((item) => {
        const company = companies.find((entry) => entry.id === item.companyId);
        return {
          uid: item.id,
          date: item.due! < today ? today : item.due!,
          title: `${FOLLOW_UP_KIND_LABELS[item.kind]}: ${item.title}`,
          description: `${item.detail}\nResponsável: ${item.owner}`,
          location: company?.profile ? [company.profile.address, company.profile.municipality].filter(Boolean).join(", ") : undefined,
        };
      });
    const stamp = `${nowLuandaLocal().replace(/[-:]/g, "")}00`;
    downloadIcs(
      `follow-up-${owner === ALL ? "equipa" : slugify(owner)}-${today}.ics`,
      buildIcs(events, owner === ALL ? "Follow-up — equipa" : `Follow-up — ${owner}`, stamp),
    );
  }

  function tile(key: FollowUpBucket, label: string, hint: string, tone?: "danger" | "warning") {
    return {
      key,
      label,
      value: formatNumber(count(key)),
      hint,
      tone: count(key) > 0 ? tone : undefined,
      pressed: bucket === key,
      onSelect: () => setBucket(bucket === key ? null : key),
    };
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader
        title="Follow-up"
        count={count("atrasado") + count("hoje")}
        actions={
          <div className="flex items-center gap-2">
            {connectedCalendars.length > 0 ? (
              <span className="caption-style text-soft hidden items-center gap-1.5 sm:flex">
                {connectedCalendars.map((provider) => (
                  <Asset key={provider.id} type="image" src={provider.logo} alt="" width={1} height={1} fit="contain" className="size-4" />
                ))}
                Sincronizado
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => {
                  useSettingsStore.getState().setTab("integracoes");
                  router.push("/definicoes");
                }}
              >
                Ligar calendário
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={exportCalendar} disabled={mine.every((item) => !item.due)}>
              Exportar .ics
            </Button>
          </div>
        }
      />
      <TotalsBar
        id="follow-up"
        summary={`${plural(count("atrasado"), "em atraso", "em atraso")} · ${formatNumber(count("hoje"))} para hoje`}
        items={[
          tile("atrasado", "Em atraso", "contactos e tarefas vencidos", "danger"),
          tile("hoje", "Hoje", "para fazer hoje", "warning"),
          tile("semana", "Próximos 7 dias", "já agendados"),
          tile("sugestao", "Sugestões", "sem compras ou propostas paradas"),
        ]}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4">
        <FilterMenu label="Gestor" value={owner} options={OWNER_OPTIONS} onChange={setOwner} />
        {bucket && (
          <Button variant="ghost" size="sm" onClick={() => setBucket(null)}>
            Ver tudo
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {sections.map((section) => {
          const sectionItems = mine.filter((item) => item.bucket === section.key);
          return (
            <section key={section.key} aria-labelledby={`follow-up-${section.key}`}>
              <h2
                id={`follow-up-${section.key}`}
                className="eyebrow-style text-subtle bg-background/95 border-border sticky top-0 z-10 flex items-center justify-between border-y px-5 py-2 font-normal backdrop-blur"
              >
                <span className={cn(section.key === "atrasado" && sectionItems.length > 0 && "text-danger")}>
                  {section.label}
                </span>
                <span className="normal-case tracking-normal">{formatNumber(sectionItems.length)}</span>
              </h2>
              {sectionItems.length > 0 ? (
                <ul className="divide-border divide-y">
                  {sectionItems.map((item) => (
                    <FollowUpRow key={item.id} item={item} today={today} />
                  ))}
                </ul>
              ) : (
                <p className="caption-style text-subtle px-5 py-4">{section.empty}</p>
              )}
            </section>
          );
        })}
      </ScrollArea>
    </section>
  );
}
