"use client";

import { useState } from "react";
import Asset from "@/components/_ui/asset";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import FilterMenu from "@/components/_common/filter-menu";
import Tag from "@/components/_ui/tag";
import {
  CALENDAR_PROVIDERS,
  CRM_CALENDAR_NAME,
  SYNC_DIRECTIONS,
  SYNC_KINDS,
  type CalendarProviderId,
  type SyncDirection,
} from "@/data/calendar-sync";
import { useNow } from "@/hooks/use-now";
import { formatDateTimeShort, formatRelative, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCalendarSyncStore, type SyncLogAction } from "@/stores/calendar-sync-store";
import SettingsPanel from "../settings-panel";
import CalendarConsentDialog from "./calendar-consent-dialog";

const ACTION_TONES: Record<SyncLogAction, "green" | "blue" | "neutral" | "purple"> = {
  Criado: "green",
  Atualizado: "blue",
  Removido: "neutral",
  "Alterado no calendário": "purple",
};

const DIRECTION_OPTIONS = SYNC_DIRECTIONS.map((value) => ({ value, label: value }));

export default function CalendarsPanel() {
  const connections = useCalendarSyncStore((state) => state.connections);
  const synced = useCalendarSyncStore((state) => state.synced);
  const log = useCalendarSyncStore((state) => state.log);
  const startConnect = useCalendarSyncStore((state) => state.startConnect);
  const disconnect = useCalendarSyncStore((state) => state.disconnect);
  const syncNow = useCalendarSyncStore((state) => state.syncNow);
  const setDirection = useCalendarSyncStore((state) => state.setDirection);
  const toggleKind = useCalendarSyncStore((state) => state.toggleKind);
  const simulateExternalChange = useCalendarSyncStore((state) => state.simulateExternalChange);
  const now = useNow();
  const [confirming, setConfirming] = useState<CalendarProviderId | null>(null);

  return (
    <SettingsPanel
      title="Calendários"
      description={`Visitas e reuniões agendadas no CRM aparecem no calendário do gestor, num calendário próprio («${CRM_CALENDAR_NAME}»). Com sincronização nos dois sentidos, mudar a data no calendário muda-a no CRM.`}
    >
      <ul className="grid gap-3 lg:grid-cols-3">
        {CALENDAR_PROVIDERS.map((provider) => {
          const connection = connections[provider.id];
          const count = synced.filter((event) => event.provider === provider.id).length;
          return (
            <li
              key={provider.id}
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-4",
                connection ? "border-(--tag-green-border) bg-white/2" : "border-line-strong",
              )}
            >
              <div className="flex items-start gap-3">
                <Asset type="image" src={provider.logo} alt="" width={1} height={1} fit="contain" className="size-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="lead-style font-medium">{provider.name}</span>
                  <span className="caption-style text-subtle truncate">{connection ? connection.account : provider.vendor}</span>
                </div>
                <Tag tone={connection ? "green" : "neutral"} size="sm">
                  {connection ? "Ligado" : "Desligado"}
                </Tag>
              </div>

              {connection ? (
                <>
                  <span className="caption-style text-soft">
                    {plural(count, "evento sincronizado", "eventos sincronizados")}
                    {connection.lastSyncAt && ` · última sincronização ${now === null ? formatDateTimeShort(connection.lastSyncAt) : formatRelative(connection.lastSyncAt, now)}`}
                  </span>
                  <div className="flex flex-col gap-2">
                    {SYNC_KINDS.map((kind) => (
                      <label key={kind.key} className="caption-style text-soft flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={connection.kinds[kind.key]}
                          onCheckedChange={() => toggleKind(provider.id, kind.key)}
                          aria-label={`Sincronizar ${kind.label.toLowerCase()} com ${provider.name}`}
                        />
                        {kind.label}
                      </label>
                    ))}
                  </div>
                  {provider.id !== "apple" ? (
                    <FilterMenu
                      label="Sentido"
                      value={connection.direction}
                      options={DIRECTION_OPTIONS}
                      onChange={(value) => setDirection(provider.id, value as SyncDirection)}
                    />
                  ) : (
                    <span className="caption-style text-subtle">Só do CRM para o calendário (subscrição iCloud).</span>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Button variant="secondary" size="sm" onClick={() => syncNow(provider.id)}>
                      Sincronizar agora
                    </Button>
                    {connection.direction === "Nos dois sentidos" && (
                      <Button variant="ghost" size="sm" onClick={() => simulateExternalChange(provider.id)}>
                        Simular alteração no calendário
                      </Button>
                    )}
                    {confirming === provider.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => {
                          disconnect(provider.id);
                          setConfirming(null);
                        }}
                      >
                        Confirmar desligar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(provider.id)}>
                        Desligar
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Button variant="secondary" size="sm" className="self-start" onClick={() => startConnect(provider.id)}>
                  Ligar {provider.name}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {log.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="eyebrow-style text-faint">Últimas sincronizações</span>
          <ul className="divide-border flex flex-col divide-y">
            {log.slice(0, 12).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
                <Tag tone={ACTION_TONES[entry.action]} size="sm">
                  {entry.action}
                </Tag>
                <span className="lead-style min-w-0 flex-1 truncate">{entry.title}</span>
                <span className="caption-style text-subtle tabular-nums">
                  {CALENDAR_PROVIDERS.find((provider) => provider.id === entry.provider)?.name} · {entry.detail} · {formatDateTimeShort(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <span className="caption-style text-subtle">
        Simulação: a ligação real precisa das credenciais OAuth do Google e da Microsoft em Supabase secrets e de um processo no servidor que receba as alterações. Até lá, a exportação .ics do Follow-up continua disponível.
      </span>
      <CalendarConsentDialog />
    </SettingsPanel>
  );
}
