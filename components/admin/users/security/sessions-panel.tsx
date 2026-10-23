"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import type { SessionView } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClock } from "@/hooks/admin/use-clock";
import { useAdminSessions, useRevokeSession } from "@/hooks/admin/use-trust";
import { formatDateTimeNumeric, formatElapsed } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";

export default function SessionsPanel() {
  const now = useClock();
  const query = useAdminSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<SessionView | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="caption-style text-subtle max-w-[60em]">Sessões abertas nos últimos 30 dias. Terminar uma sessão obriga a pessoa a entrar de novo nesse dispositivo.</p>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-60 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(items) => items.length === 0}
        empty={{
          title: "Sem sessões abertas",
          description: "Ninguém tem sessão aberta neste momento.",
        }}
      >
        {(sessions) => (
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table aria-label="Sessões activas">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Utilizador</TableHead>
                  <TableHead scope="col">Dispositivo</TableHead>
                  <TableHead scope="col">Endereço IP</TableHead>
                  <TableHead scope="col">Local</TableHead>
                  <TableHead scope="col">Início</TableHead>
                  <TableHead scope="col">Última actividade</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Acções</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{session.userName}</span>
                        <span className="caption-style text-subtle">{ROLE_LABELS[session.role]}</span>
                        {session.current && (
                          <Tag tone="neutral" size="sm">
                            Esta sessão
                          </Tag>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-soft">{session.device}</TableCell>
                    <TableCell className="text-soft tabular-nums">{session.ip}</TableCell>
                    <TableCell className="text-soft">{session.location}</TableCell>
                    <TableCell className="text-soft whitespace-nowrap tabular-nums">{formatDateTimeNumeric(session.createdAt)}</TableCell>
                    <TableCell className="text-soft whitespace-nowrap tabular-nums">há {formatElapsed(session.lastSeenAt, now)}</TableCell>
                    <TableCell>
                      {!session.current && (
                        <span className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setTarget(session)} aria-label={`Terminar a sessão de ${session.userName} em ${session.device}`}>
                            Terminar sessão
                          </Button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AsyncState>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            revoke.reset();
          }
        }}
        title={target ? `Terminar a sessão de ${target.userName}?` : "Terminar sessão"}
        description={target ? `${target.device} · ${target.ip}. A pessoa tem de voltar a entrar nesse dispositivo.` : undefined}
        confirmLabel="Terminar sessão"
        tone="danger"
        requireReason
        reasonLabel="Motivo"
        pending={revoke.isPending}
        error={mutationError(revoke.error)}
        onConfirm={(reason) =>
          target
            ? revoke.mutateAsync({ id: target.id, reason }).then(
                () => setTarget(null),
                () => undefined,
              )
            : undefined
        }
      />
    </div>
  );
}
