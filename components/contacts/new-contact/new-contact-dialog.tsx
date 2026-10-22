"use client";

import { useCompaniesStore } from "@/stores/companies-store";
import { useRef, useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { COMPANIES } from "@/data/companies";
import { CONSENT_CHANNEL_LABELS, type Contact, type ConsentChannel } from "@/data/contacts";
import { useContactsStore } from "@/stores/contacts-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const CHANNELS = Object.keys(CONSENT_CHANNEL_LABELS) as ConsentChannel[];

type FormState = {
  name: string;
  role: string;
  companyId: string;
  phone: string;
  whatsapp: string;
  email: string;
  consentChannels: ConsentChannel[];
};

const EMPTY_FORM: FormState = {
  name: "",
  role: "",
  companyId: COMPANIES[0].id,
  phone: "",
  whatsapp: "",
  email: "",
  consentChannels: [],
};

export default function NewContactDialog() {
  const companies = useCompaniesStore((state) => state.companies);
  const open = useContactsStore((state) => state.newContactOpen);
  const setOpen = useContactsStore((state) => state.setNewContactOpen);
  const addContact = useContactsStore((state) => state.addContact);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: ConsentChannel) {
    setForm((current) => ({
      ...current,
      consentChannels: current.consentChannels.includes(channel)
        ? current.consentChannels.filter((item) => item !== channel)
        : [...current.consentChannels, channel],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError("Indique o nome do contacto.");
      nameRef.current?.focus();
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    if (!company) return;

    const contact: Contact = {
      id: `ct-${Date.now()}`,
      name,
      role: form.role.trim(),
      companyId: company.id,
      companyName: company.name,
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      email: form.email.trim(),
      preferredLanguage: "Português",
      contactability: "Válido",
      consent: {
        email: {
          granted: form.consentChannels.includes("email"),
          date: today(),
          origin: "Formulário de registo",
        },
        sms: {
          granted: form.consentChannels.includes("sms"),
          date: today(),
          origin: "Formulário de registo",
        },
        whatsapp: {
          granted: form.consentChannels.includes("whatsapp"),
          date: today(),
          origin: "Formulário de registo",
        },
      },
    };

    addContact(contact);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setNameError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo Contacto</DialogTitle>
            <DialogDescription>
              Adicione uma pessoa de contacto a um cliente. Aparece na lista
              de imediato.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Pessoa">
            <Field
              label="Nome"
              htmlFor="contact-name"
              required
              error={nameError ?? undefined}
            >
              <Input
                ref={nameRef}
                id="contact-name"
                value={form.name}
                onChange={(event) => {
                  update("name", event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Nome do contacto"
                autoComplete="off"
                aria-invalid={nameError ? true : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cargo" htmlFor="contact-role">
                <Input
                  id="contact-role"
                  value={form.role}
                  onChange={(event) => update("role", event.target.value)}
                  placeholder="Gerente, Proprietário…"
                />
              </Field>
              <Field label="Cliente" htmlFor="contact-company">
                <Select
                  value={form.companyId}
                  onValueChange={(value) => update("companyId", value)}
                >
                  <SelectTrigger id="contact-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.filter((company) => !company.archived).map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Contactos e consentimento">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder="+244 9XX XXX XXX"
                />
              </Field>
              <Field label="WhatsApp" htmlFor="contact-whatsapp">
                <Input
                  id="contact-whatsapp"
                  value={form.whatsapp}
                  onChange={(event) => update("whatsapp", event.target.value)}
                  placeholder="Igual ao telefone, se vazio"
                />
              </Field>
            </div>

            <Field label="E-mail" htmlFor="contact-email">
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="nome@cliente.co.ao"
              />
            </Field>

            <Field label="Consentimento inicial" htmlFor="contact-consent">
              <div className="flex flex-col gap-2">
                {CHANNELS.map((channel) => (
                  <label
                    key={channel}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={form.consentChannels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    <span className="lead-style">
                      {CONSENT_CHANNEL_LABELS[channel]}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <PlusIcon aria-hidden className="size-3" />
              Criar Contacto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
