"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { formatDateTimeNumeric } from "@/lib/format";
import { hasPermission, ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { usePlatformSettings } from "@/hooks/admin/use-settings";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { AdminUser } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import AccessLogPanel from "./security/access-log-panel";
import SessionsPanel from "./security/sessions-panel";
import { ChangeRoleDialog, CreateUserDialog, ToggleActiveDialog, TwoFactorDialog } from "./user-dialogs";

type Dialog = { kind: "create" } | { kind: "role"; user: AdminUser } | { kind: "active"; user: AdminUser } | { kind: "two_factor"; user: AdminUser } | null;

const TAB_CLASS = "focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset";

export default function Users() {
  const session = useAdminSessionStore((state) => state.session?.user);
  const me = session?.id;
  const canSecure = session ? hasPermission(session.role, "security.manage") : false;
  const query = useAdminUsers();
  const settings = usePlatformSettings();
  const requireAll = settings.data?.security.require2fa ?? false;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState("utilizadores");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Utilizadores do painel"
        count={query.data?.length}
        actions={
          <Button variant="primary" size="sm" onClick={() => setDialog({ kind: "create" })}>
            <PlusIcon aria-hidden className="size-3" />
            Novo utilizador
          </Button>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          <Tabs value={canSecure ? tab : "utilizadores"} onValueChange={setTab}>
            {canSecure && (
              <TabsList aria-label="Secções dos utilizadores" className="border-border mb-4 border-b">
                <TabsTrigger value="utilizadores" className={TAB_CLASS}>
                  Utilizadores
                </TabsTrigger>
                <TabsTrigger value="sessoes" className={TAB_CLASS}>
                  Sessões activas
                </TabsTrigger>
                <TabsTrigger value="acessos" className={TAB_CLASS}>
                  Registo de acessos
                </TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="utilizadores">
              <AsyncState
                query={query}
                skeleton={<Skeleton className="h-72 rounded-xl" />}
                errorDescription={errorMessage}
                isEmpty={(items) => items.length === 0}
                empty={{ title: "Sem utilizadores" }}
              >
                {(users) => (
                  <div className="border-border bg-card overflow-x-auto rounded-xl border">
                    <Table aria-label="Utilizadores do painel">
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">Nome</TableHead>
                          <TableHead scope="col">E-mail</TableHead>
                          <TableHead scope="col">Papel</TableHead>
                          <TableHead scope="col">Estado</TableHead>
                          <TableHead scope="col">Segundo factor</TableHead>
                          <TableHead scope="col">Última sessão</TableHead>
                          <TableHead scope="col">
                            <span className="sr-only">Acções</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => {
                          const self = user.id === me;
                          return (
                            <TableRow key={user.id}>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  <span aria-hidden className="bg-muted text-soft flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                                    {user.initials}
                                  </span>
                                  <span className="font-medium">{user.name}</span>
                                  {self && (
                                    <Tag tone="neutral" size="sm">
                                      Sessão actual
                                    </Tag>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-soft">{user.email}</TableCell>
                              <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                              <TableCell>
                                <ToneBadge tone={user.active ? "success" : "neutral"} label={user.active ? "Activo" : "Desactivado"} />
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  <ToneBadge
                                    tone={user.twoFactorEnabled || requireAll ? "success" : "neutral"}
                                    label={user.twoFactorEnabled ? "Activo" : requireAll ? "Exigido pela política" : "Desligado"}
                                  />
                                  {canSecure && (
                                    <Button
                                      variant="link"
                                      size="none"
                                      onClick={() => setDialog({ kind: "two_factor", user })}
                                      aria-label={`${user.twoFactorEnabled ? "Desligar" : "Exigir"} o segundo factor de ${user.name}`}
                                    >
                                      {user.twoFactorEnabled ? "Desligar" : "Exigir"}
                                    </Button>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-soft tabular-nums">{user.lastLoginAt ? formatDateTimeNumeric(user.lastLoginAt) : "Nunca"}</TableCell>
                              <TableCell>
                                {!self && (
                                  <span className="flex justify-end gap-1.5">
                                    <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "role", user })} aria-label={`Alterar o papel de ${user.name}`}>
                                      Alterar papel
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "active", user })} aria-label={`${user.active ? "Desactivar" : "Activar"} ${user.name}`}>
                                      {user.active ? "Desactivar" : "Activar"}
                                    </Button>
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </AsyncState>
            </TabsContent>
            {canSecure && (
              <>
                <TabsContent value="sessoes">
                  <SessionsPanel />
                </TabsContent>
                <TabsContent value="acessos">
                  <AccessLogPanel />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </ScrollArea>
      {dialog?.kind === "create" && <CreateUserDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "role" && <ChangeRoleDialog user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === "active" && <ToggleActiveDialog user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === "two_factor" && <TwoFactorDialog user={dialog.user} onClose={() => setDialog(null)} />}
    </section>
  );
}
