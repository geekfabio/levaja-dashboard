"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { isRepositoryError } from "@/data/leva-ja";
import type { FleetInput } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateFleet } from "@/hooks/admin/use-network";

const FIELDS: { key: keyof FleetInput; label: string; placeholder: string; type?: string; inputMode?: "numeric" | "tel" | "email" }[] = [
  { key: "name", label: "Nome da frota", placeholder: "Por exemplo: Kianda Transportes" },
  { key: "nif", label: "NIF", placeholder: "5417203398", inputMode: "numeric" },
  { key: "contactName", label: "Responsável", placeholder: "Nome e apelido" },
  { key: "phone", label: "Telefone", placeholder: "+244 9XX XXX XXX", type: "tel", inputMode: "tel" },
  { key: "email", label: "E-mail", placeholder: "geral@empresa.ao", type: "email", inputMode: "email" },
];

export default function FleetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateFleet();
  const [draft, setDraft] = useState<FleetInput>({ name: "", nif: "", contactName: "", phone: "", email: "" });
  const issues = isRepositoryError(create.error) ? create.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          create.reset();
          setDraft({ name: "", nif: "", contactName: "", phone: "", email: "" });
        }
      }}
      title="Nova frota"
      description="Empresa com várias viaturas e motoristas. Os motoristas acrescentam-se depois de criada."
      confirmLabel="Criar frota"
      pending={create.isPending}
      error={issues.length ? null : mutationError(create.error)}
      onConfirm={() => create.mutateAsync(draft).then(() => onOpenChange(false), () => undefined)}
    >
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label} htmlFor={`fleet-${field.key}`} required error={issueFor(field.key)}>
          <Input
            id={`fleet-${field.key}`}
            type={field.type ?? "text"}
            inputMode={field.inputMode}
            value={draft[field.key]}
            placeholder={field.placeholder}
            aria-invalid={Boolean(issueFor(field.key))}
            onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        </Field>
      ))}
    </ConfirmDialog>
  );
}
