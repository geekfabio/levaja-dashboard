"use client";

import { motion } from "motion/react";
import Tag from "@/components/_ui/tag";
import FilterMenu from "@/components/_common/filter-menu";
import StatTile from "@/components/_common/stat-tile";
import { ABC_CLASSES, ANY, type Campaign, type Channel } from "@/data/campaigns";
import { ACTIVITY_WINDOWS, SEGMENTS } from "@/data/companies";
import { useSettingsStore } from "@/stores/settings-store";
import { EXCLUSION_TONES, type Audience, type AudienceEntry } from "@/lib/campaigns";
import { formatAngolanPhone } from "@/lib/phone";
import { useCampaignsStore } from "@/stores/campaigns-store";

type AudienceStepProps = {
  campaign: Campaign;
  audience: Audience;
  readOnly: boolean;
};


const SEGMENT_OPTIONS = [
  { value: ANY, label: "Todos os segmentos" },
  ...SEGMENTS.map((segment) => ({ value: segment, label: segment })),
];

const ABC_OPTIONS = [
  { value: ANY, label: "Todas as classes" },
  ...ABC_CLASSES.map((abc) => ({ value: abc, label: `Classe ${abc}` })),
];

const INACTIVE_OPTIONS = [
  { value: ANY, label: "Qualquer período" },
  ...ACTIVITY_WINDOWS.map((days) => ({
    value: String(days),
    label: `Mais de ${days} dias`,
  })),
];

const STATS_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

function labelFor(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function contactLine(entry: AudienceEntry, channel: Channel) {
  if (channel === "Email") return entry.contact.email;
  if (!entry.phone) return entry.contact.phone;
  return `${formatAngolanPhone(entry.phone)} · ${entry.operator}`;
}

function EntryList({
  title,
  entries,
  empty,
  channel,
}: {
  title: string;
  entries: AudienceEntry[];
  empty: string;
  channel: Channel;
}) {
  return (
    <section className="border-border flex min-w-0 flex-col gap-3 rounded-xl border p-5">
      <h2 className="eyebrow-style text-faint font-normal">
        {title} · {entries.length}
      </h2>
      {entries.length === 0 ? (
        <span className="caption-style text-subtle">{empty}</span>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {entries.map((entry) => (
            <li
              key={entry.contact.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="lead-style truncate font-medium">
                  {entry.contact.name}
                </span>
                <span className="caption-style text-subtle truncate">
                  {entry.contact.companyName} · {contactLine(entry, channel)}
                </span>
              </span>
              {entry.reason && (
                <Tag tone={EXCLUSION_TONES[entry.reason]} size="sm">
                  {entry.reason}
                </Tag>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AudienceStep({ campaign, audience, readOnly }: AudienceStepProps) {
  const setAudience = useCampaignsStore((state) => state.setAudience);
  const zones = useSettingsStore((state) => state.zones);
  const zoneOptions = [
    { value: ANY, label: "Todas as zonas" },
    ...zones.map((zone) => ({ value: zone.name, label: zone.name })),
  ];
  const filters = campaign.audience;
  const found = audience.eligible.length + audience.excluded.length;

  return (
    <div className="flex flex-col gap-6 p-5">
      <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
        <h2 className="eyebrow-style text-faint font-normal">Segmento</h2>
        <span className="caption-style text-subtle">
          Os mesmos critérios de Clientes. O segmento é dinâmico — é recalculado
          sempre que os clientes ou o consentimento dos contactos mudam.
        </span>
        {readOnly ? (
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="neutral">{labelFor(zoneOptions, filters.zone)}</Tag>
            <Tag tone="neutral">{labelFor(SEGMENT_OPTIONS, filters.segment)}</Tag>
            <Tag tone="neutral">{labelFor(ABC_OPTIONS, filters.abc)}</Tag>
            <Tag tone="neutral">
              Sem compra: {labelFor(INACTIVE_OPTIONS, filters.inactiveDays)}
            </Tag>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <FilterMenu
              label="Zona"
              value={filters.zone}
              options={zoneOptions}
              onChange={(zone) => setAudience(campaign.id, { zone })}
            />
            <FilterMenu
              label="Segmento"
              value={filters.segment}
              options={SEGMENT_OPTIONS}
              onChange={(segment) => setAudience(campaign.id, { segment })}
            />
            <FilterMenu
              label="Classe ABC"
              value={filters.abc}
              options={ABC_OPTIONS}
              onChange={(abc) => setAudience(campaign.id, { abc })}
            />
            <FilterMenu
              label="Sem compra"
              value={filters.inactiveDays}
              options={INACTIVE_OPTIONS}
              onChange={(inactiveDays) => setAudience(campaign.id, { inactiveDays })}
            />
          </div>
        )}
      </section>

      <motion.div
        variants={STATS_VARIANTS}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile label="Clientes no segmento" value={audience.companies.length} index={0} />
        <StatTile label="Contactos encontrados" value={found} index={1} />
        <StatTile label="Excluídos" value={audience.excluded.length} index={2} />
        <StatTile
          label="Destinatários elegíveis"
          value={audience.eligible.length}
          index={3}
        />
      </motion.div>

      {audience.excluded.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="caption-style text-subtle">Motivos de exclusão:</span>
          {Object.entries(audience.exclusionCounts).map(([reason, count]) => (
            <Tag
              key={reason}
              tone={EXCLUSION_TONES[reason as keyof typeof EXCLUSION_TONES]}
              size="sm"
            >
              {reason} · {count}
            </Tag>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <EntryList
          title="Destinatários elegíveis"
          entries={audience.eligible}
          channel={campaign.channel}
          empty="Nenhum contacto elegível neste segmento."
        />
        <EntryList
          title="Excluídos automaticamente"
          entries={audience.excluded}
          channel={campaign.channel}
          empty="Nenhuma exclusão — todos os contactos podem receber."
        />
      </div>
    </div>
  );
}
