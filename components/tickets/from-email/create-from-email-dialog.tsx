"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import FormSection from "@/components/_common/form-section";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { COMPANIES, CURRENT_USER } from "@/data/companies";
import type { Ticket } from "@/data/tickets";
import { nowLuandaLocal } from "@/lib/format";
import { useTicketsStore } from "@/stores/tickets-store";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";

const NO_COMPANY = "none";

type FormState = {
  from: string;
  subject: string;
  body: string;
  companyId: string;
};

const EMPTY_FORM: FormState = {
  from: "",
  subject: "",
  body: "",
  companyId: NO_COMPANY,
};

export default function CreateFromEmailDialog() {
  const open = useTicketsStore((state) => state.fromEmailOpen);
  const setOpen = useTicketsStore((state) => state.setFromEmailOpen);
  const addTicket = useTicketsStore((state) => state.addTicket);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = form.subject.trim();
    if (!subject) {
      setError("Indique o assunto do e-mail.");
      subjectRef.current?.focus();
      return;
    }

    const company = COMPANIES.find((item) => item.id === form.companyId);

    const ticket: Ticket = {
      id: `tk-${Date.now()}`,
      subject,
      description: form.body.trim(),
      companyId: company?.id,
      companyName: company?.name,
      contactName: form.from.trim() || undefined,
      status: "Aberto",
      priority: "Normal",
      origin: "E-mail",
      assignee: CURRENT_USER.name,
      assigneeAvatar: CURRENT_USER.avatar,
      createdAt: nowLuandaLocal(),
      updatedAt: nowLuandaLocal(),
      comments: [],
      timeline: [
        {
          id: "t1",
          label: "Ticket criado a partir de e-mail",
          date: nowLuandaLocal(),
          author: form.from.trim() || "E-mail",
        },
      ],
    };

    addTicket(ticket);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <MailIcon aria-hidden className="text-icon size-3.5" />
              <DialogTitle>Criar Ticket a Partir de E-mail</DialogTitle>
            </div>
            <DialogDescription>
              Preencha os dados do e-mail recebido. Sem ligação a uma caixa de
              entrada real — isso depende de Supabase e de um fornecedor de
              e-mail (ver UI_ROADMAP.md).
            </DialogDescription>
          </DialogHeader>

          <FormSection title="E-mail recebido">
            <Field label="De" htmlFor="email-from">
              <Input
                id="email-from"
                type="email"
                value={form.from}
                onChange={(event) => update("from", event.target.value)}
                placeholder="cliente@empresa.co.ao"
              />
            </Field>

            <Field
              label="Assunto"
              htmlFor="email-subject"
              required
              error={error ?? undefined}
            >
              <Input
                ref={subjectRef}
                id="email-subject"
                value={form.subject}
                onChange={(event) => {
                  update("subject", event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Assunto do e-mail"
                aria-invalid={error ? true : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <Field label="Mensagem" htmlFor="email-body">
              <Textarea
                id="email-body"
                value={form.body}
                onChange={(event) => update("body", event.target.value)}
                placeholder="Cole aqui o corpo do e-mail"
                rows={5}
              />
            </Field>

            <Field label="Cliente" htmlFor="email-company">
              <Select
                value={form.companyId}
                onValueChange={(value) => update("companyId", value)}
              >
                <SelectTrigger id="email-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>Sem cliente associado</SelectItem>
                  {COMPANIES.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <MailIcon aria-hidden className="size-3" />
              Criar Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
