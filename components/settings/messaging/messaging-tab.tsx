"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import FilterMenu from "@/components/_common/filter-menu";
import { LOW_BALANCE_THRESHOLD, SMS_PACKAGES } from "@/data/sms-credit";
import { formatDateTimeShort, formatMoney, formatNumber } from "@/lib/format";
import { PROVIDERS, type MessageChannel } from "@/lib/messaging";
import { SMS_PRICE } from "@/lib/sms";
import { cn } from "@/lib/utils";
import { useMessagingStore } from "@/stores/messaging-store";
import SettingsPanel from "../settings-panel";

const ALL = "all";
const CHANNELS: MessageChannel[] = ["SMS", "E-mail", "WhatsApp"];
const CHANNEL_OPTIONS = [{ value: ALL, label: "Todos os canais" }, ...CHANNELS.map((value) => ({ value, label: value }))];

export default function MessagingTab() {
  const balance = useMessagingStore((state) => state.balance);
  const topUps = useMessagingStore((state) => state.topUps);
  const reservations = useMessagingStore((state) => state.reservations);
  const outbox = useMessagingStore((state) => state.outbox);
  const requestTopUp = useMessagingStore((state) => state.requestTopUp);
  const confirmTopUp = useMessagingStore((state) => state.confirmTopUp);
  const cancelTopUp = useMessagingStore((state) => state.cancelTopUp);
  const [channel, setChannel] = useState<string>(ALL);
  const reserved = Object.values(reservations).reduce((sum, value) => sum + value, 0);
  const available = balance - reserved;
  const visible = outbox.filter((record) => channel === ALL || record.channel === channel);

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel
        title="Modo de envio"
        description="Sem MESSAGING_LIVE=true e sem fornecedores ligados, todas as mensagens ficam em modo sandbox: registadas na caixa de saída e reencaminhadas para o destinatário de teste. Nada chega a clientes reais."
      >
        <ul className="divide-border flex flex-col divide-y">
          {CHANNELS.map((item) => (
            <li key={item} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <span className="flex flex-col gap-0.5">
                <span className="lead-style">{item} · {PROVIDERS[item].name}</span>
                <span className="caption-style text-subtle">{PROVIDERS[item].status}</span>
              </span>
              <Tag tone="amber" size="sm">Sandbox</Tag>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel
        title="Saldo de SMS"
        description={`Pré-pago à Umoja Global, a ${formatMoney(SMS_PRICE)} por mensagem. Campanhas agendadas reservam o custo; o agendamento é bloqueado se faltar saldo.`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-line-strong flex flex-col gap-1 rounded-lg border p-3">
            <span className="caption-style text-soft flex items-center gap-1.5">
              {balance < LOW_BALANCE_THRESHOLD && <span aria-hidden className="bg-warning size-1.5 rounded-full" />}
              Saldo
            </span>
            <span className="text-[22px] leading-none font-semibold tabular-nums">{formatMoney(balance)}</span>
            <span className="caption-style text-subtle">≈ {formatNumber(Math.floor(balance / SMS_PRICE))} mensagens</span>
          </div>
          <div className="border-line-strong flex flex-col gap-1 rounded-lg border p-3">
            <span className="caption-style text-soft">Reservado</span>
            <span className="text-[22px] leading-none font-semibold tabular-nums">{formatMoney(reserved)}</span>
            <span className="caption-style text-subtle">campanhas agendadas</span>
          </div>
          <div className="border-line-strong flex flex-col gap-1 rounded-lg border p-3">
            <span className="caption-style text-soft">Disponível</span>
            <span className={cn("text-[22px] leading-none font-semibold tabular-nums", available < LOW_BALANCE_THRESHOLD && "text-warning")}>
              {formatMoney(available)}
            </span>
            <span className="caption-style text-subtle">para novos envios</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="lead-style">Carregar saldo</span>
          <div className="flex flex-wrap gap-2">
            {SMS_PACKAGES.map((amount) => (
              <Button key={amount} variant="secondary" size="sm" onClick={() => requestTopUp(amount)}>
                {formatMoney(amount)} · {formatNumber(amount / SMS_PRICE)} SMS
              </Button>
            ))}
          </div>
          <span className="caption-style text-subtle">
            Gera uma referência Multicaixa. Em produção o saldo entra quando a Umoja Global confirma o pagamento; aqui confirma-se à mão.
          </span>
        </div>
        <ul className="divide-border flex flex-col divide-y">
          {topUps.map((topUp) => (
            <li key={topUp.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex flex-col gap-0.5">
                <span className="lead-style tabular-nums">{formatMoney(topUp.amount)} · {topUp.reference}</span>
                <span className="caption-style text-subtle">{formatDateTimeShort(topUp.at)} · {topUp.by}</span>
              </span>
              <span className="flex items-center gap-2">
                <Tag tone={topUp.status === "Confirmado" ? "green" : topUp.status === "Cancelado" ? "neutral" : "amber"} size="sm">
                  {topUp.status}
                </Tag>
                {topUp.status === "A aguardar pagamento" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => cancelTopUp(topUp.id)}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => confirmTopUp(topUp.id)}>
                      Confirmar pagamento
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel
        title={`Caixa de saída · ${outbox.length}`}
        description="Tudo o que as automações e as conversas mandaram nesta sessão, com o texto final, o custo e para onde foi reencaminhado."
        actions={<FilterMenu label="Canal" value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} align="end" />}
      >
        {visible.length === 0 ? (
          <p className="caption-style text-subtle">Ainda nenhuma mensagem nesta sessão.</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {visible.slice(0, 50).map((record) => (
              <li key={record.id} className="flex flex-col gap-1 py-2.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Tag tone={record.status === "Simulado" ? "blue" : "red"} size="sm">
                    {record.status === "Simulado" ? "Envio simulado" : "Bloqueado"}
                  </Tag>
                  <span className="lead-style">
                    {record.channel} para {record.toName ?? record.to}
                  </span>
                  <span className="caption-style text-subtle tabular-nums">
                    {formatDateTimeShort(record.at)}
                    {record.cost > 0 && ` · ${formatMoney(record.cost)}`}
                  </span>
                </span>
                <span className="caption-style text-soft">“{record.subject ? `${record.subject} — ` : ""}{record.body}”</span>
                <span className="caption-style text-subtle">
                  {record.status === "Simulado"
                    ? `${record.source} · reencaminhado para ${record.deliveredTo} (sandbox), não para ${record.to}.`
                    : `${record.source} · ${record.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsPanel>
    </div>
  );
}
