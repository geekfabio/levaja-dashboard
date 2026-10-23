"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { CheckField, toggle } from "@/components/admin/settings/sections/fields";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateWebhook } from "@/hooks/admin/use-trust";
import { WEBHOOK_EVENTS, webhookUrlIssue } from "@/lib/leva-ja/trust";

export default function CreateWebhookDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (secret: string) => void }) {
  const mutation = useCreateWebhook();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>(["request.created"]);
  const [touched, setTouched] = useState(false);
  const issues = isRepositoryError(mutation.error) ? mutation.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const urlIssue = touched && url.trim() ? webhookUrlIssue(url) : null;
  const reset = () => {
    setUrl("");
    setDescription("");
    setEvents(["request.created"]);
    setTouched(false);
    mutation.reset();
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
      title="Novo webhook"
      description="A plataforma avisa este endereço quando os eventos escolhidos acontecem. Cada envio leva uma assinatura feita com o segredo."
      confirmLabel="Criar webhook"
      canConfirm={!webhookUrlIssue(url) && events.length > 0}
      pending={mutation.isPending}
      error={issues.length ? null : mutationError(mutation.error)}
      onConfirm={() =>
        mutation
          .mutateAsync({
            url: url.trim(),
            description: description.trim(),
            events,
          })
          .then(
            (result) => {
              reset();
              onCreated(result.secret);
            },
            () => undefined,
          )
      }
    >
      <Field label="Endereço" htmlFor="webhook-url" required error={urlIssue ?? issueFor("url")}>
        <Input
          id="webhook-url"
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://api.empresa.ao/levaja/eventos"
          onBlur={() => setTouched(true)}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <Field label="Descrição" htmlFor="webhook-description">
        <Input id="webhook-description" value={description} placeholder="Para que serve" onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="caption-style text-subtle pb-1">Eventos</legend>
        {WEBHOOK_EVENTS.map((event) => (
          <CheckField key={event.key} checked={events.includes(event.key)} onChange={(on) => setEvents(toggle(events, event.key, on))}>
            {event.label}
          </CheckField>
        ))}
        {issueFor("events") ? (
          <span role="alert" className="caption-style text-danger">
            {issueFor("events")}
          </span>
        ) : null}
      </fieldset>
    </ConfirmDialog>
  );
}
