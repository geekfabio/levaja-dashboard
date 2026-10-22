"use client";

import { motion } from "motion/react";
import Tag from "@/components/_ui/tag";
import StatTile from "@/components/_common/stat-tile";
import { CAMPAIGN_EVENT_TONES } from "@/data/campaign-events";
import type { Campaign, CampaignMetrics } from "@/data/campaigns";
import { campaignRates, eventsForCampaign } from "@/lib/campaigns";
import { formatDateTime, formatNumber, formatPercentDecimal } from "@/lib/format";
import { useContactsStore } from "@/stores/contacts-store";

type ResultsStepProps = {
  campaign: Campaign;
};

const STATS_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

function BarRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total === 0 ? 0 : (value / total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="lead-style">{label}</span>
        <span className="caption-style text-subtle tabular-nums">
          {formatNumber(value)} · {formatPercentDecimal(percent)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/4">
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${Math.max(percent, value > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function funnelRows(channel: Campaign["channel"], metrics: CampaignMetrics) {
  const rows = [
    { label: "Enviados", value: metrics.sent },
    { label: "Entregues", value: metrics.delivered },
  ];
  if (channel === "Email") {
    rows.push(
      { label: "Abertos", value: metrics.opened },
      { label: "Clicaram", value: metrics.clicked },
    );
  }
  return rows;
}

export default function ResultsStep({ campaign }: ResultsStepProps) {
  const contacts = useContactsStore((state) => state.contacts);
  const metrics = campaign.metrics;

  if (!metrics) {
    return (
      <div className="caption-style text-subtle p-5">
        Sem métricas registadas para esta campanha.
      </div>
    );
  }

  const rates = campaignRates(metrics);
  const isEmail = campaign.channel === "Email";
  const events = eventsForCampaign(campaign.id);
  const failed = metrics.hardBounces + metrics.softBounces;
  const maxClicks = Math.max(1, ...metrics.links.map((link) => link.clicks));

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
        Métricas de exemplo.{" "}
        {campaign.sentAt && <>Enviada a {formatDateTime(campaign.sentAt)}. </>}
        Com o fornecedor ligado, estes números chegam por webhook e atualizam-se
        sozinhos.
      </div>

      <motion.div
        variants={STATS_VARIANTS}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile label="Enviados" value={metrics.sent} index={0} />
        <StatTile
          label="Taxa de entrega"
          value={rates.delivered}
          decimals={1}
          suffix="%"
          index={1}
        />
        {isEmail ? (
          <>
            <StatTile
              label="Taxa de abertura"
              value={rates.opened}
              decimals={1}
              suffix="%"
              index={2}
            />
            <StatTile
              label="Taxa de cliques"
              value={rates.clicked}
              decimals={1}
              suffix="%"
              index={3}
            />
          </>
        ) : (
          <>
            <StatTile label="Entregues" value={metrics.delivered} index={2} />
            <StatTile label="Falhados" value={failed} index={3} />
          </>
        )}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Percurso da mensagem</h2>
          <span className="caption-style text-subtle">
            Percentagens sobre os enviados. As taxas de abertura e de cliques
            acima são calculadas sobre os entregues.
          </span>
          {funnelRows(campaign.channel, metrics).map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} total={metrics.sent} />
          ))}
        </section>

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">
            {isEmail ? "Devoluções e remoções" : "Falhas de entrega"}
          </h2>
          <ul className="divide-border flex flex-col divide-y">
            <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <span className="lead-style">
                {isEmail ? "Devoluções permanentes" : "Número inexistente"}
              </span>
              <span className="lead-style tabular-nums">{formatNumber(metrics.hardBounces)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-3">
              <span className="lead-style">
                {isEmail ? "Devoluções temporárias" : "Sem rede ou desligado"}
              </span>
              <span className="lead-style tabular-nums">{formatNumber(metrics.softBounces)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-3 last:pb-0">
              <span className="lead-style">
                {isEmail ? "Remoções da subscrição" : "Respostas PARAR"}
              </span>
              <span className="lead-style tabular-nums">
                {formatNumber(metrics.unsubscribed)}
                <span className="caption-style text-subtle ml-2">
                  {formatPercentDecimal(rates.unsubscribed)}
                </span>
              </span>
            </li>
          </ul>
        </section>
      </div>

      {isEmail && metrics.links.length > 0 && (
        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Cliques por ligação</h2>
          {metrics.links.map((link) => (
            <div key={link.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="lead-style truncate">{link.label}</span>
                <span className="caption-style text-subtle tabular-nums">
                  {formatNumber(link.clicks)} cliques
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/4">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${(link.clicks / maxClicks) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="eyebrow-style text-faint font-normal">
          Atividade dos contactos · {events.length}
        </h2>
        <span className="caption-style text-subtle">
          Cada evento também aparece na linha do tempo da ficha do cliente.
        </span>
        {events.length === 0 ? (
          <span className="caption-style text-subtle">Sem eventos por contacto.</span>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {events.map((event) => {
              const contact = contacts.find((item) => item.id === event.contactId);
              return (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="lead-style truncate font-medium">
                      {contact?.name ?? "Contacto removido"}
                    </span>
                    <span className="caption-style text-subtle truncate">
                      {contact?.companyName}
                      {event.detail ? ` · ${event.detail}` : ""} ·{" "}
                      {formatDateTime(event.date)}
                    </span>
                  </span>
                  <Tag tone={CAMPAIGN_EVENT_TONES[event.type]} size="sm">
                    {event.type}
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
