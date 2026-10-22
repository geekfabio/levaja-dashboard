"use client";

import { useState, type FormEvent } from "react";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import SettingsPanel from "../settings-panel";
import SaveBar from "../save-bar";
import type { CompanyProfile } from "@/data/settings";
import { companyProfileErrors, emailFooter } from "@/lib/settings";
import { useSettingsStore } from "@/stores/settings-store";

const FIELDS: {
  key: keyof CompanyProfile;
  label: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "email" | "url";
  hint?: string;
}[] = [
  { key: "tradeName", label: "Nome comercial", required: true, hint: "Aparece no rodapé dos e-mails." },
  { key: "legalName", label: "Denominação social", required: true },
  { key: "nif", label: "NIF", required: true, inputMode: "numeric" },
  { key: "phone", label: "Telefone geral", required: true, type: "tel", inputMode: "tel" },
  { key: "email", label: "E-mail geral", required: true, type: "email", inputMode: "email" },
  { key: "website", label: "Sítio na internet", type: "url", inputMode: "url" },
  { key: "address", label: "Morada" },
  { key: "city", label: "Cidade", required: true },
];

export default function CompanyTab() {
  const company = useSettingsStore((state) => state.company);
  const saveCompany = useSettingsStore((state) => state.saveCompany);
  const [draft, setDraft] = useState(company);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const errors = companyProfileErrors(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(company);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    saveCompany({
      ...draft,
      nif: draft.nif.replace(/\s/g, ""),
    });
    setSaved(true);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 p-5">
      <SettingsPanel
        title="Dados da empresa"
        description="Usados no rodapé das mensagens, nos documentos exportados e no cabeçalho da aplicação."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={`company-${field.key}`}
              required={field.required}
              hint={field.hint}
              error={submitted ? errors[field.key] : undefined}
              className={field.key === "address" ? "sm:col-span-2" : undefined}
            >
              <Input
                id={`company-${field.key}`}
                type={field.type}
                inputMode={field.inputMode}
                value={draft[field.key]}
                aria-invalid={submitted && errors[field.key] ? true : undefined}
                className="aria-invalid:border-danger"
                onChange={(event) => {
                  setSaved(false);
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }));
                }}
              />
            </Field>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Rodapé dos e-mails" description="Pré-visualização com os dados acima.">
        <div className="bg-brand-paper text-brand-ink/60 flex flex-col gap-1 rounded-md px-4 py-4 text-center text-[12px] leading-[1.5]">
          <span>{emailFooter(draft)}</span>
          <span>
            Recebe este e-mail por ser cliente da Alimenta Angola.{" "}
            <span className="underline">Remover subscrição</span>
          </span>
        </div>
      </SettingsPanel>

      <SaveBar
        dirty={dirty}
        saved={saved}
        onReset={() => {
          setDraft(company);
          setSubmitted(false);
        }}
      />
    </form>
  );
}
