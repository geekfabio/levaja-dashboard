"use client";

import { Fragment, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useRolePermissions, useUpdateRolePermissions } from "@/hooks/admin/use-settings";
import { ADMIN_ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSION_GROUPS, ROLE_LABELS } from "@/lib/leva-ja/permissions";
import type { AdminPermission, AdminRole, RolePermissions } from "@/types/leva-ja";

function Editor({ matrix }: { matrix: RolePermissions }) {
  const [draft, setDraft] = useState<RolePermissions>(() => structuredClone(matrix));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useUpdateRolePermissions();
  const dirty = JSON.stringify(draft) !== JSON.stringify(matrix);
  const editable = ADMIN_ROLES.filter((role) => role !== "admin");

  function set(role: AdminRole, permission: AdminPermission, on: boolean) {
    setDraft((current) => ({
      ...current,
      [role]: on ? [...new Set([...current[role], permission])] : current[role].filter((item) => item !== permission),
    }));
  }

  return (
    <SettingsPanel
      title="Papéis e permissões"
      description="O que cada papel pode ver e fazer. O papel Administrador tem sempre todas as permissões."
      className="bg-card"
      actions={
        <Button variant="ghost" size="sm" onClick={() => setDraft(structuredClone({ ...DEFAULT_ROLE_PERMISSIONS }))}>
          Repor valores de origem
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <Table aria-label="Permissões por papel">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Permissão</TableHead>
              {ADMIN_ROLES.map((role) => (
                <TableHead key={role} scope="col" className="text-center">
                  {ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={ADMIN_ROLES.length + 1} className="eyebrow-style text-faint h-8">
                    {group.title}
                  </TableCell>
                </TableRow>
                {group.permissions.map((permission) => (
                  <TableRow key={permission.key}>
                    <TableCell className="whitespace-normal">{permission.label}</TableCell>
                    {ADMIN_ROLES.map((role) => (
                      <TableCell key={role} className="text-center">
                        <span className="inline-flex">
                          <Checkbox
                            aria-label={`${ROLE_LABELS[role]}: ${permission.label}`}
                            checked={role === "admin" || draft[role].includes(permission.key)}
                            disabled={role === "admin"}
                            onCheckedChange={(value) => set(role, permission.key, value === true)}
                          />
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="caption-style text-soft">
          {editable.map((role) => `${ROLE_LABELS[role]}: ${draft[role].length}`).join(" · ")}
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" size="md" disabled={!dirty} onClick={() => setDraft(structuredClone(matrix))}>
            Descartar
          </Button>
          <Button variant="primary" size="md" disabled={!dirty} onClick={() => setConfirmOpen(true)}>
            Guardar permissões
          </Button>
        </span>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) mutation.reset();
        }}
        title="Guardar as novas permissões?"
        description="Os utilizadores de cada papel passam a ver e a poder fazer apenas o que estiver marcado."
        confirmLabel="Guardar"
        requireReason
        reasonLabel="Motivo da alteração"
        pending={mutation.isPending}
        error={mutationError(mutation.error)}
        onConfirm={(reason) => mutation.mutateAsync({ matrix: draft, reason }).then(() => setConfirmOpen(false), () => undefined)}
      />
    </SettingsPanel>
  );
}

export default function RolesMatrix() {
  const query = useRolePermissions(true);
  return (
    <AsyncState query={query} skeleton={<Skeleton className="h-[520px] rounded-xl" />} errorDescription={errorMessage}>
      {(matrix) => <Editor key={JSON.stringify(matrix)} matrix={matrix} />}
    </AsyncState>
  );
}
