"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useChangeAdminRole, useCreateAdminUser, useSetAdminActive } from "@/hooks/admin/use-admin-users";
import { useSetTwoFactor } from "@/hooks/admin/use-trust";
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/leva-ja/permissions";
import type { AdminRole, AdminUser } from "@/types/leva-ja";

function RoleSelect({ id, value, onChange }: { id: string; value: AdminRole; onChange: (role: AdminRole) => void }) {
  return (
    <Field label="Papel" htmlFor={id} hint={ROLE_DESCRIPTIONS[value]}>
      <Select value={value} onValueChange={(next) => onChange(next as AdminRole)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ADMIN_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const mutation = useCreateAdminUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const issues = isRepositoryError(mutation.error) ? mutation.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Novo utilizador do painel"
      description="A pessoa entra com este e-mail e um código de acesso."
      confirmLabel="Criar utilizador"
      requireReason
      reasonLabel="Motivo"
      pending={mutation.isPending}
      error={issues.length ? null : mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ input: { name, email, role }, reason }).then(onClose, () => undefined)}
    >
      <Field label="Nome completo" htmlFor="user-name" required error={issueFor("name")}>
        <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <Field label="E-mail" htmlFor="user-email" required error={issueFor("email")}>
        <Input id="user-email" type="email" value={email} placeholder="nome@levaja.ao" onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <RoleSelect id="user-role" value={role} onChange={setRole} />
    </ConfirmDialog>
  );
}

export function ChangeRoleDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const mutation = useChangeAdminRole();
  const [role, setRole] = useState<AdminRole>(user.role);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Alterar o papel de ${user.name}`}
      description={`Papel actual: ${ROLE_LABELS[user.role]}. A mudança aplica-se na próxima acção da pessoa.`}
      confirmLabel="Alterar papel"
      requireReason
      reasonLabel="Motivo"
      canConfirm={role !== user.role}
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: user.id, role, reason }).then(onClose, () => undefined)}
    >
      <RoleSelect id="change-role" value={role} onChange={setRole} />
    </ConfirmDialog>
  );
}

export function ToggleActiveDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const mutation = useSetAdminActive();
  const activating = !user.active;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={activating ? `Activar ${user.name}?` : `Desactivar ${user.name}?`}
      description={activating ? "A pessoa volta a poder entrar no painel." : "A pessoa deixa de poder entrar e a sessão aberta termina na próxima acção."}
      confirmLabel={activating ? "Activar" : "Desactivar"}
      tone={activating ? "primary" : "danger"}
      requireReason
      reasonLabel="Motivo"
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: user.id, active: activating, reason }).then(onClose, () => undefined)}
    />
  );
}

export function TwoFactorDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const mutation = useSetTwoFactor();
  const enabling = !user.twoFactorEnabled;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={enabling ? `Exigir segundo factor a ${user.name}?` : `Desligar o segundo factor de ${user.name}?`}
      description={
        enabling
          ? "Na próxima entrada, além do código enviado por e-mail, a pessoa tem de indicar o código da aplicação de autenticação."
          : "A pessoa passa a entrar só com o código enviado por e-mail, a menos que a política da plataforma o exija a todos."
      }
      confirmLabel={enabling ? "Exigir" : "Desligar"}
      tone={enabling ? "primary" : "danger"}
      requireReason
      reasonLabel="Motivo"
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ userId: user.id, enabled: enabling, reason }).then(onClose, () => undefined)}
    />
  );
}
