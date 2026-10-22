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
import { COMPANIES, CURRENT_USER, OWNERS } from "@/data/companies";
import { TICKET_PRIORITIES, type Ticket, type TicketPriority } from "@/data/tickets";
import { nowLuandaLocal } from "@/lib/format";
import { useTicketsStore } from "@/stores/tickets-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const NO_COMPANY = "none";

type FormState = {
  subject: string;
  description: string;
  companyId: string;
  contactName: string;
  priority: TicketPriority;
  assignee: string;
};

const EMPTY_FORM: FormState = {
  subject: "",
  description: "",
  companyId: NO_COMPANY,
  contactName: "",
  priority: "Normal",
  assignee: OWNERS[0].name,
};

export default function NewTicketDialog() {
  const open = useTicketsStore((state) => state.newTicketOpen);
  const setOpen = useTicketsStore((state) => state.setNewTicketOpen);
  const addTicket = useTicketsStore((state) => state.addTicket);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = form.subject.trim();
    if (!subject) {
      setSubjectError("Indique o assunto do ticket.");
      subjectRef.current?.focus();
      return;
    }

    const company = COMPANIES.find((item) => item.id === form.companyId);
    const assigneeOwner =
      OWNERS.find((owner) => owner.name === form.assignee) ?? CURRENT_USER;

    const ticket: Ticket = {
      id: `tk-${Date.now()}`,
      subject,
      description: form.description.trim(),
      companyId: company?.id,
      companyName: company?.name,
      contactName: form.contactName.trim() || undefined,
      status: "Aberto",
      priority: form.priority,
      origin: "Manual",
      assignee: assigneeOwner.name,
      assigneeAvatar: assigneeOwner.avatar,
      createdAt: nowLuandaLocal(),
      updatedAt: nowLuandaLocal(),
      comments: [],
      timeline: [
        { id: "t1", label: "Ticket criado", date: nowLuandaLocal(), author: CURRENT_USER.name },
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
          setSubjectError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo Ticket</DialogTitle>
            <DialogDescription>
              Registe um pedido ou incidente. Aparece na lista de imediato.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Pedido">
            <Field
              label="Assunto"
              htmlFor="ticket-subject"
              required
              error={subjectError ?? undefined}
            >
              <Input
                ref={subjectRef}
                id="ticket-subject"
                value={form.subject}
                onChange={(event) => {
                  update("subject", event.target.value);
                  if (subjectError) setSubjectError(null);
                }}
                placeholder="Resumo do pedido"
                autoComplete="off"
                aria-invalid={subjectError ? true : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <Field label="Descrição" htmlFor="ticket-description">
              <Textarea
                id="ticket-description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Detalhe o pedido ou incidente"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente" htmlFor="ticket-company">
                <Select
                  value={form.companyId}
                  onValueChange={(value) => update("companyId", value)}
                >
                  <SelectTrigger id="ticket-company">
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
              <Field label="Contacto" htmlFor="ticket-contact">
                <Input
                  id="ticket-contact"
                  value={form.contactName}
                  onChange={(event) => update("contactName", event.target.value)}
                  placeholder="Nome do contacto"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Encaminhamento">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prioridade" htmlFor="ticket-priority">
                <Select
                  value={form.priority}
                  onValueChange={(value) => update("priority", value as TicketPriority)}
                >
                  <SelectTrigger id="ticket-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável" htmlFor="ticket-assignee">
                <Select
                  value={form.assignee}
                  onValueChange={(value) => update("assignee", value)}
                >
                  <SelectTrigger id="ticket-assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERS.map((owner) => (
                      <SelectItem key={owner.name} value={owner.name}>
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <PlusIcon aria-hidden className="size-3" />
              Criar Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
