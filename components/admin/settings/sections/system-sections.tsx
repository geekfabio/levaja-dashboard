"use client";

import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_EVENT_LABELS } from "@/lib/leva-ja/settings";
import { TICKET_PRIORITY_LABELS } from "@/lib/leva-ja/services";
import type { NotificationChannel, PlatformSettings, TicketPriority } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import SectionForm from "../section-form";
import { CheckField, FieldGrid, NumberField, TextField, toggle } from "./fields";

type Props = { settings: PlatformSettings; canEdit: boolean };

const CHANNELS = Object.keys(NOTIFICATION_CHANNEL_LABELS) as NotificationChannel[];
const PRIORITIES: TicketPriority[] = ["urgent", "high", "medium", "low"];

function listFrom(text: string) {
  return text
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GeneralSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="general" settings={settings} canEdit={canEdit} description="Dados da empresa mostrados na app, nos recibos e nos contactos de apoio.">
      {({ draft, update, issueFor }) => (
        <FieldGrid>
          <TextField id="general-trade" label="Nome comercial" value={draft.tradeName} onChange={(tradeName) => update({ tradeName })} error={issueFor("tradeName")} />
          <TextField id="general-legal" label="Denominação social" value={draft.legalName} onChange={(legalName) => update({ legalName })} />
          <TextField id="general-nif" label="NIF" value={draft.nif} onChange={(nif) => update({ nif })} error={issueFor("nif")} />
          <TextField id="general-phone" label="Telefone de apoio" value={draft.supportPhone} onChange={(supportPhone) => update({ supportPhone })} error={issueFor("supportPhone")} placeholder="+244 9XX XXX XXX" />
          <TextField id="general-email" label="E-mail de apoio" value={draft.supportEmail} onChange={(supportEmail) => update({ supportEmail })} error={issueFor("supportEmail")} />
          <TextField id="general-hours" label="Horário de funcionamento" value={draft.openingHours} onChange={(openingHours) => update({ openingHours })} />
          <TextField id="general-terms" label="Termos e condições (URL)" value={draft.termsUrl} onChange={(termsUrl) => update({ termsUrl })} />
          <TextField id="general-privacy" label="Política de privacidade (URL)" value={draft.privacyUrl} onChange={(privacyUrl) => update({ privacyUrl })} />
        </FieldGrid>
      )}
    </SectionForm>
  );
}

export function NotificationsSection({ settings, canEdit }: Props) {
  return (
    <SectionForm
      section="notifications"
      settings={settings}
      canEdit={canEdit}
      description="Mensagens enviadas aos clientes e prestadores em cada momento. Variáveis: {{codigo}}, {{prestador}}, {{motivo}}, {{valor}}, {{referencia}}, {{zona}}, {{telefone}}, {{documento}}."
    >
      {({ draft, update, issueFor, disabled }) => (
        <>
          <ul className="divide-border flex flex-col divide-y">
            {draft.templates.map((template) => (
              <li key={template.event} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="lead-style font-medium">{NOTIFICATION_EVENT_LABELS[template.event]}</span>
                  <span className="flex flex-wrap gap-4" role="group" aria-label={`Canais de ${NOTIFICATION_EVENT_LABELS[template.event]}`}>
                    {CHANNELS.map((channel) => (
                      <CheckField
                        key={channel}
                        checked={template.channels.includes(channel)}
                        disabled={disabled}
                        onChange={(on) => update({ templates: draft.templates.map((item) => (item.event === template.event ? { ...item, channels: toggle(item.channels, channel, on) } : item)) })}
                      >
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                      </CheckField>
                    ))}
                  </span>
                </div>
                <Field label="Mensagem" htmlFor={`template-${template.event}`} error={issueFor(`templates.${template.event}`)}>
                  <Textarea
                    id={`template-${template.event}`}
                    rows={2}
                    value={template.body}
                    onChange={(event) => update({ templates: draft.templates.map((item) => (item.event === template.event ? { ...item, body: event.target.value } : item)) })}
                  />
                </Field>
              </li>
            ))}
          </ul>
          <Field label="Contactos avisados num alerta SOS" htmlFor="sos-escalation" error={issueFor("sosEscalation")} hint="Um por linha: telefones ou e-mails.">
            <Textarea id="sos-escalation" rows={3} value={draft.sosEscalation.join("\n")} onChange={(event) => update({ sosEscalation: listFrom(event.target.value) })} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function SupportSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="support" settings={settings} canEdit={canEdit} description="Prazos de primeira resposta por prioridade e respostas prontas para as ocorrências.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PRIORITIES.map((priority) => (
              <NumberField
                key={priority}
                id={`sla-${priority}`}
                label={`Prioridade ${TICKET_PRIORITY_LABELS[priority].toLowerCase()} (horas)`}
                value={draft.firstResponseHours[priority]}
                error={issueFor(`firstResponseHours.${priority}`)}
                onChange={(hours) => update({ firstResponseHours: { ...draft.firstResponseHours, [priority]: hours } })}
              />
            ))}
          </div>
          <CheckField checked={draft.satisfactionSurvey} disabled={disabled} onChange={(satisfactionSurvey) => update({ satisfactionSurvey })}>
            Pedir uma avaliação ao utilizador quando a ocorrência é resolvida
          </CheckField>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow-style text-faint">Respostas prontas</span>
              {!disabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ cannedReplies: [...draft.cannedReplies, { id: `cr-${crypto.randomUUID().slice(0, 6)}`, title: "", body: "" }] })}
                >
                  <PlusIcon aria-hidden className="size-3" />
                  Adicionar resposta
                </Button>
              )}
            </div>
            <ul className="divide-border flex flex-col divide-y">
              {draft.cannedReplies.map((reply, index) => (
                <li key={reply.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-end gap-2">
                    <Field label="Título" htmlFor={`reply-title-${index}`} className="flex-1" error={issueFor(`cannedReplies.${reply.id}`)}>
                      <Input
                        id={`reply-title-${index}`}
                        value={reply.title}
                        onChange={(event) => update({ cannedReplies: draft.cannedReplies.map((item) => (item.id === reply.id ? { ...item, title: event.target.value } : item)) })}
                      />
                    </Field>
                    {!disabled && (
                      <Button variant="ghost" size="md" aria-label={`Remover a resposta ${reply.title || index + 1}`} onClick={() => update({ cannedReplies: draft.cannedReplies.filter((item) => item.id !== reply.id) })}>
                        Remover
                      </Button>
                    )}
                  </div>
                  <Textarea
                    aria-label={`Texto da resposta ${reply.title || index + 1}`}
                    rows={2}
                    value={reply.body}
                    onChange={(event) => update({ cannedReplies: draft.cannedReplies.map((item) => (item.id === reply.id ? { ...item, body: event.target.value } : item)) })}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SectionForm>
  );
}

export function SecuritySection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="security" settings={settings} canEdit={canEdit} description="Regras de acesso ao painel para todos os utilizadores.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <CheckField checked={draft.require2fa} disabled={disabled} onChange={(require2fa) => update({ require2fa })}>
            Exigir verificação em dois passos a todos os utilizadores do painel
          </CheckField>
          <FieldGrid>
            <NumberField id="security-session" label="Duração da sessão (horas)" value={draft.sessionHours} onChange={(sessionHours) => update({ sessionHours })} error={issueFor("sessionHours")} />
          </FieldGrid>
          <Field label="IPs autorizados" htmlFor="security-ips" error={issueFor("ipAllowlist")} hint="Um por linha, por exemplo 197.149.0.0/16. Vazio permite qualquer IP.">
            <Textarea id="security-ips" rows={3} value={draft.ipAllowlist.join("\n")} onChange={(event) => update({ ipAllowlist: listFrom(event.target.value) })} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function AppSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="app" settings={settings} canEdit={canEdit} description="Versões mínimas da app, modo de manutenção e avisos mostrados aos utilizadores.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <FieldGrid>
            <TextField id="app-android" label="Versão mínima Android" value={draft.minVersionAndroid} onChange={(minVersionAndroid) => update({ minVersionAndroid })} error={issueFor("minVersionAndroid")} />
            <TextField id="app-ios" label="Versão mínima iOS" value={draft.minVersionIos} onChange={(minVersionIos) => update({ minVersionIos })} error={issueFor("minVersionIos")} />
          </FieldGrid>
          <CheckField checked={draft.maintenance} disabled={disabled} onChange={(maintenance) => update({ maintenance })}>
            Modo de manutenção (a app deixa de aceitar pedidos novos)
          </CheckField>
          <Field label="Mensagem de manutenção" htmlFor="app-maintenance" error={issueFor("maintenanceMessage")}>
            <Textarea id="app-maintenance" rows={2} value={draft.maintenanceMessage} onChange={(event) => update({ maintenanceMessage: event.target.value })} />
          </Field>
          <Field label="Aviso na app" htmlFor="app-banner" hint="Mostrado no topo do ecrã inicial. Deixe vazio para não mostrar.">
            <Input id="app-banner" value={draft.banner} onChange={(event) => update({ banner: event.target.value })} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}
