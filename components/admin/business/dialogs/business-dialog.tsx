"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateBusiness } from "@/hooks/admin/use-commerce";
import { shiftDay } from "@/lib/format";
import { ContractFields, contractFromDraft } from "./contract-fields";
import type { ContractDraft } from "./contract-fields";

const FIELDS = [
  { key: "name", label: "Nome da empresa", placeholder: "Por exemplo: Sonangol Logística" },
  { key: "nif", label: "NIF", placeholder: "5410002871" },
  { key: "sector", label: "Sector", placeholder: "Retalho, energia, saúde…" },
  { key: "contactName", label: "Responsável", placeholder: "Nome e apelido" },
  { key: "phone", label: "Telefone", placeholder: "+244 9XX XXX XXX" },
  { key: "email", label: "E-mail", placeholder: "compras@empresa.ao" },
] as const;

type Draft = Record<(typeof FIELDS)[number]["key"], string>;

export default function BusinessDialog({ open, onOpenChange, today }: { open: boolean; onOpenChange: (open: boolean) => void; today: string }) {
  const create = useCreateBusiness();
  const empty: Draft = { name: "", nif: "", sector: "", contactName: "", phone: "", email: "" };
  const [draft, setDraft] = useState<Draft>(empty);
  const [contract, setContract] = useState<ContractDraft>({ discount: "5", terms: "30", limit: "100000", startsAt: today, endsAt: shiftDay(today, 365) });
  const issues = isRepositoryError(create.error) ? create.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          create.reset();
          setDraft(empty);
        }
      }}
      title="Nova conta empresarial"
      description="Contrato com desconto, prazo de pagamento e limite de crédito. Os utilizadores acrescentam-se depois."
      confirmLabel="Criar conta"
      pending={create.isPending}
      error={issues.length ? null : mutationError(create.error)}
      onConfirm={() => create.mutateAsync({ ...draft, contract: contractFromDraft(contract) }).then(() => onOpenChange(false), () => undefined)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`business-${field.key}`} required={field.key !== "sector"} error={issueFor(field.key)}>
            <Input id={`business-${field.key}`} value={draft[field.key]} placeholder={field.placeholder} aria-invalid={Boolean(issueFor(field.key))} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} />
          </Field>
        ))}
      </div>
      <ContractFields draft={contract} onChange={setContract} issueFor={issueFor} />
    </ConfirmDialog>
  );
}
