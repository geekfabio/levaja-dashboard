"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Textarea } from "@/components/_ui/textarea";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAudienceEstimate, useCreateBroadcast } from "@/hooks/admin/use-commerce";
import { formatNumber } from "@/lib/format";
import { BROADCAST_CHANNEL_LABELS, BROADCAST_SEGMENT_LABELS, renderBroadcast, smsParts } from "@/lib/leva-ja/commerce";
import type { BroadcastAudienceKind, BroadcastChannel, BroadcastSegment, Zone } from "@/types/leva-ja";

const SEGMENTS: Record<BroadcastAudienceKind, BroadcastSegment[]> = {
  clients: ["all", "inactive_30", "new_30", "business"],
  providers: ["all", "online", "inactive_30", "new_30", "business"],
};

const PROVIDER_SEGMENT_LABELS: Partial<Record<BroadcastSegment, string>> = { business: "Motoristas de frotas" };

export default function BroadcastDialog({ open, onOpenChange, zones }: { open: boolean; onOpenChange: (open: boolean) => void; zones: Zone[] }) {
  const create = useCreateBroadcast();
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<BroadcastChannel>("push");
  const [kind, setKind] = useState<BroadcastAudienceKind>("clients");
  const [segment, setSegment] = useState<BroadcastSegment>("all");
  const [zone, setZone] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Olá {nome}, ");
  const audience = { kind, segment, zoneIds: zone === "all" ? [] : [zone] };
  const estimate = useAudienceEstimate(audience, open);
  const issues = isRepositoryError(create.error) ? create.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const length = [...message].length;
  const counter = channel === "sms" ? `${formatNumber(length)} caracteres · ${smsParts(message)} SMS` : channel === "push" ? `${formatNumber(length)} de 240 caracteres` : `${formatNumber(length)} caracteres`;
  const sample = estimate.data?.sample[0] ?? "Ana Neto";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) create.reset();
      }}
      title="Nova comunicação"
      description="Fica guardada como rascunho. O envio é sempre simulado neste painel: nenhuma mensagem sai para clientes ou prestadores."
      confirmLabel="Guardar rascunho"
      pending={create.isPending}
      error={issues.length ? null : mutationError(create.error)}
      onConfirm={() => create.mutateAsync({ title, channel, audience, subject: channel === "email" ? subject : undefined, message }).then(() => onOpenChange(false), () => undefined)}
    >
      <Field label="Título interno" htmlFor="broadcast-title" required error={issueFor("title")}>
        <Input id="broadcast-title" value={title} placeholder="Por exemplo: Aviso de chuva" onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Canal" htmlFor="broadcast-channel">
          <Select value={channel} onValueChange={(value) => setChannel(value as BroadcastChannel)}>
            <SelectTrigger id="broadcast-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BROADCAST_CHANNEL_LABELS) as BroadcastChannel[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {BROADCAST_CHANNEL_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Destinatários" htmlFor="broadcast-kind">
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as BroadcastAudienceKind);
              setSegment("all");
            }}
          >
            <SelectTrigger id="broadcast-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clients">Clientes</SelectItem>
              <SelectItem value="providers">Prestadores</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Segmento" htmlFor="broadcast-segment">
          <Select value={segment} onValueChange={(value) => setSegment(value as BroadcastSegment)}>
            <SelectTrigger id="broadcast-segment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS[kind].map((key) => (
                <SelectItem key={key} value={key}>
                  {(kind === "providers" && PROVIDER_SEGMENT_LABELS[key]) || BROADCAST_SEGMENT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Zona" htmlFor="broadcast-zone">
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger id="broadcast-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as zonas</SelectItem>
              {zones.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <p className="caption-style text-soft" aria-live="polite">
        {estimate.data ? `${formatNumber(estimate.data.recipients)} destinatário(s) com estes critérios.` : "A calcular o público…"}
      </p>
      {channel === "email" && (
        <Field label="Assunto" htmlFor="broadcast-subject" required error={issueFor("subject")}>
          <Input id="broadcast-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Field>
      )}
      <Field label="Mensagem" htmlFor="broadcast-message" required error={issueFor("message")} hint={`${counter}. Use {nome} para o primeiro nome.`}>
        <Textarea id="broadcast-message" rows={4} value={message} aria-invalid={Boolean(issueFor("message"))} onChange={(event) => setMessage(event.target.value)} />
      </Field>
      <div className="bg-muted flex flex-col gap-1 rounded-xl p-3">
        <span className="caption-style text-subtle">Pré-visualização para {sample}</span>
        <p className="p-style">{renderBroadcast(message, sample)}</p>
      </div>
    </ConfirmDialog>
  );
}
