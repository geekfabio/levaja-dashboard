"use client";

import { Fragment } from "react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import SettingsPanel from "../settings-panel";
import InviteDialog from "./invite-dialog";
import { CURRENT_USER } from "@/data/companies";
import {
  DATA_SCOPES,
  PERMISSIONS,
  ROLES,
  ROLE_DESCRIPTIONS,
  type DataScope,
  type Role,
} from "@/data/settings";
import { useSettingsStore } from "@/stores/settings-store";
import UserPlusIcon from "@/public/assets/images/companies/sidebar/user-plus.svg";

function UserAvatar({ name, src }: { name: string; src?: string }) {
  if (src) return <Avatar src={src} alt="" />;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className="bg-muted text-soft flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-medium"
    >
      {initials}
    </span>
  );
}

const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((permission) => permission.group))];

function PermissionMatrix() {
  const rolePermissions = useSettingsStore((state) => state.rolePermissions);
  const roleScopes = useSettingsStore((state) => state.roleScopes);
  const togglePermission = useSettingsStore((state) => state.togglePermission);
  const setRoleScope = useSettingsStore((state) => state.setRoleScope);

  return (
    <ScrollArea orientation="horizontal" className="-mx-5">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Permissão</TableHead>
            {ROLES.map((role) => (
              <TableHead key={role} className="text-center" title={ROLE_DESCRIPTIONS[role]}>
                {role}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="pl-5">
              <span className="flex flex-col gap-1">
                <span className="lead-style">Clientes visíveis</span>
                <span className="caption-style text-subtle">Âmbito dos dados de cada perfil</span>
              </span>
            </TableCell>
            {ROLES.map((role) => (
              <TableCell key={role} className="text-center">
                <Select
                  value={roleScopes[role]}
                  disabled={role === "Administrador"}
                  onValueChange={(scope) => setRoleScope(role, scope as DataScope)}
                >
                  <SelectTrigger aria-label={`Clientes visíveis — ${role}`} className="h-[30px] w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {scope}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            ))}
          </TableRow>
          {PERMISSION_GROUPS.map((group) => (
            <Fragment key={group}>
              <TableRow>
                <TableCell colSpan={ROLES.length + 1} className="eyebrow-style text-faint h-[34px] pl-5">
                  {group}
                </TableCell>
              </TableRow>
              {PERMISSIONS.filter((permission) => permission.group === group).map((permission) => (
                <TableRow key={permission.key} className="hover:bg-card/60">
                  <TableCell className="text-soft pl-5">{permission.label}</TableCell>
                  {ROLES.map((role: Role) => (
                    <TableCell key={role} className="text-center">
                      <Checkbox
                        aria-label={`${permission.label} — ${role}`}
                        checked={rolePermissions[role].includes(permission.key)}
                        disabled={role === "Administrador"}
                        onCheckedChange={() => togglePermission(role, permission.key)}
                        className="align-middle"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function UsersTable() {
  const users = useSettingsStore((state) => state.users);
  const setUserRole = useSettingsStore((state) => state.setUserRole);
  const removeUser = useSettingsStore((state) => state.removeUser);

  return (
    <ScrollArea orientation="horizontal" className="-mx-5">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Utilizador</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="pr-5 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.email === CURRENT_USER.email;
            const pending = user.status === "Convite pendente";
            return (
              <TableRow key={user.id}>
                <TableCell className="pl-5">
                  <span className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={user.name} src={user.avatar} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="lead-style truncate">
                        {user.name}
                        {isSelf && <span className="text-subtle"> (você)</span>}
                      </span>
                      <span className="caption-style text-subtle truncate">{user.email}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    disabled={isSelf}
                    onValueChange={(role) => setUserRole(user.id, role as Role)}
                  >
                    <SelectTrigger
                      aria-label={`Perfil de ${user.name}`}
                      title={isSelf ? "Não pode alterar o seu próprio perfil." : undefined}
                      className="h-[30px] w-[170px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Tag tone={pending ? "amber" : "green"} size="sm">
                    {user.status}
                  </Tag>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {pending && (
                    <Button variant="ghost" size="sm" onClick={() => removeUser(user.id)}>
                      Cancelar convite
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function AccessTab() {
  const users = useSettingsStore((state) => state.users);
  const setInviteOpen = useSettingsStore((state) => state.setInviteOpen);

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
        Esta matriz é a especificação dos perfis de acesso. Nesta versão os dados estão só em
        memória e as permissões ainda não são aplicadas — passam a ser regras de segurança da
        base de dados (RLS) quando a ligação ao Supabase estiver ativa.
      </div>

      <SettingsPanel
        title="Perfis e permissões"
        description="O perfil Administrador tem sempre acesso total e não pode ser alterado."
      >
        <PermissionMatrix />
      </SettingsPanel>

      <SettingsPanel
        title={`Utilizadores · ${users.length}`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlusIcon aria-hidden className="size-3" />
            Convidar
          </Button>
        }
      >
        <UsersTable />
      </SettingsPanel>

      <InviteDialog />
    </div>
  );
}
