"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ModuleHeader from "@/components/_common/module-header";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import CallButton from "@/components/_common/call-button";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import { Textarea } from "@/components/_ui/textarea";
import type { Conversation } from "@/data/conversations";
import { useNow } from "@/hooks/use-now";
import { renderTemplate } from "@/lib/automation-engine";
import { lastMessage, withinWhatsAppWindow } from "@/lib/conversations";
import { formatDateTimeShort, formatMoney, formatTime } from "@/lib/format";
import { analyzeSms, SMS_PRICE } from "@/lib/sms";
import { cn } from "@/lib/utils";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useConversationsStore } from "@/stores/conversations-store";
import { useSettingsStore } from "@/stores/settings-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

function ConversationItem({ conversation, active, onSelect }: { conversation: Conversation; active: boolean; onSelect: () => void }) {
  const contact = useContactsStore((state) => state.contacts.find((item) => item.id === conversation.contactId));
  const last = lastMessage(conversation);
  return (
    <li>
      <Button
        variant="item"
        size="none"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn("flex w-full items-start gap-3 rounded-lg p-3 text-left", active && "bg-white/5")}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center justify-between gap-2">
            <span className="lead-style truncate font-medium">{contact?.name ?? "Contacto removido"}</span>
            {last && <span className="caption-style text-subtle shrink-0 tabular-nums">{formatDateTimeShort(last.at)}</span>}
          </span>
          <span className="caption-style text-subtle truncate">{contact?.companyName}</span>
          <span className="flex items-center gap-2">
            <Tag tone={conversation.channel === "WhatsApp" ? "green" : "blue"} size="sm">
              {conversation.channel}
            </Tag>
            <span className={cn("caption-style truncate", conversation.unread ? "text-foreground" : "text-soft")}>
              {last ? `${last.direction === "out" ? "Eu: " : ""}${last.body}` : "Sem mensagens"}
            </span>
          </span>
        </span>
        {conversation.unread > 0 && <CountBadge>{conversation.unread}</CountBadge>}
      </Button>
    </li>
  );
}

function Thread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const contact = useContactsStore((state) => state.contacts.find((item) => item.id === conversation.contactId));
  const company = useCompaniesStore((state) => state.companies.find((item) => item.id === contact?.companyId));
  const reply = useConversationsStore((state) => state.reply);
  const startActivity = useActivitiesStore((state) => state.startActivity);
  const smsTemplates = useSettingsStore((state) => state.smsTemplates);
  const openTarget = useOpenTarget();
  const now = useNow();
  const [draft, setDraft] = useState("");
  const [templateId, setTemplateId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const insideWindow = now === null || withinWhatsAppWindow(conversation, now);
  const consentKey = conversation.channel === "WhatsApp" ? "whatsapp" : "sms";
  const consent = contact?.consent[consentKey].granted && contact.contactability === "Válido";
  const smsUnits = conversation.channel === "SMS" ? analyzeSms(draft) : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.messages.length]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    let body = draft;
    if (!insideWindow) {
      const template = smsTemplates.find((item) => item.id === templateId);
      if (!template || !contact) return;
      body = renderTemplate(template.body, { nome: contact.name.split(" ")[0], zona: company?.zone ?? "", desconto: "", validade: "" });
    }
    if (!body.trim()) return;
    reply(conversation.id, body);
    setDraft("");
    setTemplateId("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Voltar às conversas" onClick={onBack}>
          <ChevronIcon aria-hidden className="size-3 rotate-90" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="lead-style truncate font-medium">{contact?.name}</span>
          {company && (
            <Button
              variant="link"
              size="none"
              className="caption-style text-soft justify-start"
              onClick={() => openTarget({ module: "Clientes", id: company.id, label: company.name })}
            >
              {contact?.role} · {company.name}
            </Button>
          )}
        </div>
        {contact && <CallButton phone={contact.phone} companyId={contact.companyId} label="Ligar" />}
        {contact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startActivity({
                companyId: contact.companyId,
                type: conversation.channel === "WhatsApp" ? "WhatsApp" : "Chamada",
                followUpNote: lastMessage(conversation)?.body,
              })
            }
          >
            Registar atividade
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col gap-2 p-4" aria-label={`Mensagens com ${contact?.name}`}>
          {conversation.messages.map((item) =>
            item.direction === "system" ? (
              <li key={item.id} className="caption-style text-(--tag-amber-text) self-center rounded-full bg-(--tag-amber-bg) px-3 py-1 text-center">
                {item.body}
              </li>
            ) : (
              <li
                key={item.id}
                className={cn(
                  "flex max-w-[min(520px,85%)] flex-col gap-1 rounded-xl px-3 py-2",
                  item.direction === "in" ? "bg-card self-start" : "self-end bg-white/8",
                )}
              >
                <span className="lead-style whitespace-pre-wrap">{item.body}</span>
                <span className="caption-style text-subtle self-end tabular-nums">
                  {item.author && `${item.author} · `}
                  {formatTime(item.at)}
                  {item.status === "Simulado" && " · sandbox"}
                  {item.status === "Bloqueado" && <span className="text-danger"> · não enviado (sem consentimento)</span>}
                </span>
              </li>
            ),
          )}
          <div ref={endRef} />
        </ol>
      </ScrollArea>

      <form onSubmit={send} className="border-border flex shrink-0 flex-col gap-2 border-t p-3">
        {!consent ? (
          <p className="caption-style text-danger">
            Sem consentimento de {conversation.channel} ou contacto não contactável — não é possível enviar. Registe o consentimento na ficha do contacto.
          </p>
        ) : !insideWindow ? (
          <div className="flex flex-col gap-2">
            <span className="caption-style text-(--tag-amber-text)">
              Passaram mais de 24 h desde a última mensagem do cliente. O WhatsApp só permite modelos aprovados até o cliente voltar a responder.
            </span>
            <div className="flex gap-2">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label="Modelo aprovado" className="flex-1">
                  <SelectValue placeholder="Escolher modelo aprovado…" />
                </SelectTrigger>
                <SelectContent>
                  {smsTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="primary" size="sm" disabled={!templateId}>
                Enviar modelo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Textarea
              aria-label="Mensagem"
              rows={2}
              value={draft}
              placeholder={`Escrever por ${conversation.channel}… (Enter envia, Shift+Enter muda de linha)`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="caption-style text-subtle">
                {smsUnits && draft
                  ? `${smsUnits.messages} SMS · ${formatMoney(smsUnits.messages * SMS_PRICE)} · `
                  : ""}
                Modo sandbox — vai para o destinatário de teste.
              </span>
              <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()}>
                Enviar
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default function Conversations() {
  const conversations = useConversationsStore((state) => state.conversations);
  const activeId = useConversationsStore((state) => state.activeId);
  const open = useConversationsStore((state) => state.open);
  const simulateIncoming = useConversationsStore((state) => state.simulateIncoming);
  const [filter, setFilter] = useState<"todas" | "por-ler">("todas");

  const sorted = useMemo(
    () =>
      [...conversations]
        .filter((item) => filter === "todas" || item.unread > 0)
        .sort((a, b) => (lastMessage(b)?.at ?? "").localeCompare(lastMessage(a)?.at ?? "")),
    [conversations, filter],
  );
  const active = conversations.find((item) => item.id === activeId);
  const unread = conversations.reduce((sum, item) => sum + item.unread, 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Conversas" count={unread || undefined} />
      <div className="flex min-h-0 flex-1">
        <aside className={cn("border-border flex min-h-0 w-full flex-col border-r md:w-[340px] md:shrink-0", active && "hidden md:flex")}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 p-3">
            <div className="flex gap-1">
              <Button variant={filter === "todas" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("todas")}>
                Todas
              </Button>
              <Button variant={filter === "por-ler" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("por-ler")}>
                Por ler · {unread}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={simulateIncoming}>
              Simular mensagem
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="flex flex-col gap-0.5 px-2 pb-3">
              {sorted.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  onSelect={() => open(conversation.id)}
                />
              ))}
              {sorted.length === 0 && <li className="caption-style text-subtle p-4 text-center">Nada por ler.</li>}
            </ul>
          </ScrollArea>
        </aside>
        {active ? (
          <Thread key={active.id} conversation={active} onBack={() => open(null)} />
        ) : (
          <div className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center md:flex">
            <span className="lead-style font-medium">Escolha uma conversa</span>
            <span className="caption-style text-subtle max-w-[32em]">
              Mensagens de WhatsApp e SMS dos contactos. Uma resposta «PARAR» retira o consentimento desse canal automaticamente.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
