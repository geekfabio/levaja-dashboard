"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { CheckField, toggle } from "@/components/admin/settings/sections/fields";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateApiKey } from "@/hooks/admin/use-trust";
import { API_SCOPES } from "@/lib/leva-ja/trust";

const EXPIRY_OPTIONS = [
  { value: "90", label: "90 dias" },
  { value: "30", label: "30 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Sem validade" },
];

export default function CreateKeyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (secret: string) => void }) {
  const mutation = useCreateApiKey();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["requests.read"]);
  const [expiry, setExpiry] = useState("90");
  const issues = isRepositoryError(mutation.error) ? mutation.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const reset = () => {
    setName("");
    setScopes(["requests.read"]);
    setExpiry("90");
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
      title="Nova chave de API"
      description="Para sistemas de parceiros (por exemplo, o ERP de uma conta empresarial). Dê só as permissões necessárias."
      confirmLabel="Criar chave"
      canConfirm={name.trim().length >= 3 && scopes.length > 0}
      pending={mutation.isPending}
      error={issues.length ? null : mutationError(mutation.error)}
      onConfirm={() =>
        mutation
          .mutateAsync({
            name: name.trim(),
            scopes,
            expiresInDays: expiry === "never" ? null : Number(expiry),
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
      <Field label="Nome" htmlFor="key-name" required error={issueFor("name")}>
        <Input id="key-name" value={name} placeholder="Por exemplo: ERP da conta empresarial" onChange={(event) => setName(event.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="caption-style text-subtle pb-1">Permissões</legend>
        {API_SCOPES.map((scope) => (
          <CheckField key={scope.key} checked={scopes.includes(scope.key)} onChange={(on) => setScopes(toggle(scopes, scope.key, on))}>
            {scope.label}
          </CheckField>
        ))}
        {issueFor("scopes") ? (
          <span role="alert" className="caption-style text-danger">
            {issueFor("scopes")}
          </span>
        ) : null}
      </fieldset>
      <Field label="Validade" htmlFor="key-expiry">
        <Select value={expiry} onValueChange={setExpiry}>
          <SelectTrigger id="key-expiry">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </ConfirmDialog>
  );
}
