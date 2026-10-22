"use client";

import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Tag from "@/components/_ui/tag";
import SettingsPanel from "../settings-panel";
import CalendarsPanel from "./calendars-panel";
import { IDENTIFIER_TYPES } from "@/data/sales";
import { useNow } from "@/hooks/use-now";
import { formatDateTimeShort, formatMoney, formatRelative } from "@/lib/format";
import { mockSalesSource } from "@/lib/integrations/sales/mock-source";
import { cn } from "@/lib/utils";
import { useCompaniesStore } from "@/stores/companies-store";
import { SIMULATION_INTERVALS, useSalesStore } from "@/stores/sales-store";

const IDENTIFIER_HINTS = {
  "Cartão de cliente": "Número impresso no cartão, lido na caixa.",
  NIF: "NIF indicado na fatura.",
  Telefone: "Número de telefone do cliente (+244).",
} as const;

export default function IntegrationsTab() {
  const autoSimulate = useSalesStore((state) => state.autoSimulate);
  const intervalSeconds = useSalesStore((state) => state.intervalSeconds);
  const identificationOrder = useSalesStore((state) => state.identificationOrder);
  const lastSyncAt = useSalesStore((state) => state.lastSyncAt);
  const events = useSalesStore((state) => state.events);
  const setAutoSimulate = useSalesStore((state) => state.setAutoSimulate);
  const setIntervalSeconds = useSalesStore((state) => state.setIntervalSeconds);
  const toggleIdentifier = useSalesStore((state) => state.toggleIdentifier);
  const simulate = useSalesStore((state) => state.simulate);
  const setAssociateId = useSalesStore((state) => state.setAssociateId);
  const companies = useCompaniesStore((state) => state.companies);
  const now = useNow();

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
        A ligação ao sistema de vendas está em <strong className="text-foreground font-medium">modo de simulação</strong>:
        as compras são geradas pelo próprio CRM. Quando o sistema real estiver disponível, envia cada
        venda para o CRM (webhook ou sincronização periódica) e este ecrã passa a mostrar o estado da
        ligação real — o resto do CRM não muda.
      </div>

      <SettingsPanel
        title="Sistema de vendas"
        description="Cada compra (cartão, numerário, transferência ou crédito) chega ao CRM, é associada ao cliente e atualiza a ficha, a classe ABC e o risco."
        actions={
          <Tag tone={autoSimulate ? "green" : "neutral"} size="sm" className="gap-1.5">
            <span aria-hidden className={cn("size-1.5 rounded-full", autoSimulate ? "bg-(--tag-green-text)" : "bg-subtle")} />
            {autoSimulate ? "A receber (simulação)" : "Simulação em pausa"}
          </Tag>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="caption-style text-subtle">Origem</dt>
            <dd className="lead-style">{mockSalesSource.name}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="caption-style text-subtle">Modo</dt>
            <dd className="lead-style">{mockSalesSource.mode}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="caption-style text-subtle">Última compra recebida</dt>
            <dd className="lead-style tabular-nums">
              {lastSyncAt ? (now === null ? formatDateTimeShort(lastSyncAt) : formatRelative(lastSyncAt, now)) : "Nenhuma nesta sessão"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => simulate(true)}>
            Simular compra agora
          </Button>
          <Button
            variant={autoSimulate ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={autoSimulate}
            onClick={() => setAutoSimulate(!autoSimulate)}
          >
            {autoSimulate ? "Parar chegada automática" : "Ligar chegada automática"}
          </Button>
          <span className="caption-style text-subtle">a cada</span>
          <div role="group" aria-label="Intervalo da simulação" className="flex items-center gap-1">
            {SIMULATION_INTERVALS.map((seconds) => (
              <Button
                key={seconds}
                variant={intervalSeconds === seconds ? "muted" : "ghost"}
                size="sm"
                aria-pressed={intervalSeconds === seconds}
                onClick={() => setIntervalSeconds(seconds)}
              >
                {seconds} s
              </Button>
            ))}
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Identificação do cliente"
        description="Como o CRM reconhece o cliente em cada compra. Compras sem nenhum destes dados ficam em Vendas → Por associar."
      >
        <ul className="flex flex-col gap-3">
          {IDENTIFIER_TYPES.map((type) => (
            <li key={type}>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={identificationOrder.includes(type)}
                  onCheckedChange={() => toggleIdentifier(type)}
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="lead-style">{type}</span>
                  <span className="caption-style text-subtle">{IDENTIFIER_HINTS[type]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel title="Compras recebidas nesta sessão" description="As 30 mais recentes.">
        {events.length === 0 ? (
          <p className="caption-style text-subtle">Ainda nenhuma. Use &ldquo;Simular compra agora&rdquo; para ver o fluxo.</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="lead-style tabular-nums">{event.document}</span>
                  <span className="caption-style text-subtle">
                    {formatDateTimeShort(event.at)} ·{" "}
                    {event.companyId
                      ? (companies.find((company) => company.id === event.companyId)?.name ?? "—")
                      : "cliente não identificado"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="lead-style tabular-nums">{formatMoney(event.total)}</span>
                  {event.result === "Associada" ? (
                    <Tag tone="green" size="sm">Associada</Tag>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setAssociateId(event.id)}>
                      Associar
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsPanel>
      <CalendarsPanel />
    </div>
  );
}
