"use client";

import { useState, type FormEvent } from "react";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FormSection from "@/components/_common/form-section";
import type { Contact } from "@/data/contacts";
import { formatAngolanPhone, normalizeAngolanPhone } from "@/lib/phone";
import { isEmail } from "@/lib/settings";
import { useCompaniesStore } from "@/stores/companies-store";
import type { ContactPatch } from "@/stores/contacts-store";

export type ContactDraft = {
  name: string;
  role: string;
  companyId: string;
  phone: string;
  whatsapp: string;
  email: string;
};

export const CONTACT_FORM_ID = "contact-edit-form";

export function contactToDraft(contact: Contact): ContactDraft {
  return {
    name: contact.name,
    role: contact.role,
    companyId: contact.companyId,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    email: contact.email,
  };
}

function formatPhone(value: string) {
  const e164 = normalizeAngolanPhone(value);
  return e164 ? formatAngolanPhone(e164) : value.trim();
}

type ContactEditFormProps = {
  draft: ContactDraft;
  onChange: <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => void;
  onSubmit: (patch: ContactPatch) => void;
};

export default function ContactEditForm({ draft, onChange, onSubmit }: ContactEditFormProps) {
  const companies = useCompaniesStore((state) => state.companies);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactDraft, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = "Indique o nome.";
    if (!normalizeAngolanPhone(draft.phone)) next.phone = "Telefone angolano inválido (+244 e 9 dígitos).";
    if (draft.whatsapp.trim() && !normalizeAngolanPhone(draft.whatsapp)) {
      next.whatsapp = "Número de WhatsApp inválido.";
    }
    if (draft.email.trim() && !isEmail(draft.email)) next.email = "E-mail inválido.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`contact-edit-${first}`)?.focus();
      return;
    }
    const company = companies.find((item) => item.id === draft.companyId);
    onSubmit({
      name: draft.name.trim(),
      role: draft.role.trim(),
      companyId: draft.companyId,
      companyName: company?.name,
      phone: formatPhone(draft.phone),
      whatsapp: draft.whatsapp.trim() ? formatPhone(draft.whatsapp) : "",
      email: draft.email.trim().toLowerCase(),
    });
  }

  function field<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setErrors((current) => ({ ...current, [key]: undefined }));
    onChange(key, value);
  }

  function input(key: Exclude<keyof ContactDraft, "companyId">, label: string, props: { type?: string; inputMode?: "tel" | "email"; required?: boolean } = {}) {
    const id = `contact-edit-${key}`;
    return (
      <Field label={label} htmlFor={id} required={props.required} error={errors[key]}>
        <Input
          id={id}
          type={props.type}
          inputMode={props.inputMode}
          value={draft[key]}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
          className="aria-invalid:border-danger"
          onChange={(event) => field(key, event.target.value)}
        />
      </Field>
    );
  }

  return (
    <form id={CONTACT_FORM_ID} onSubmit={handleSubmit} noValidate>
      <FormSection title="Editar contacto">
        {input("name", "Nome", { required: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {input("role", "Cargo")}
          <Field label="Cliente" htmlFor="contact-edit-company">
            <Select value={draft.companyId} onValueChange={(value) => field("companyId", value)}>
              <SelectTrigger id="contact-edit-company">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies
                  .filter((company) => !company.archived)
                  .map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          {input("phone", "Telefone", { type: "tel", inputMode: "tel", required: true })}
          {input("whatsapp", "WhatsApp", { type: "tel", inputMode: "tel" })}
        </div>
        {input("email", "E-mail", { type: "email", inputMode: "email" })}
      </FormSection>
    </form>
  );
}
