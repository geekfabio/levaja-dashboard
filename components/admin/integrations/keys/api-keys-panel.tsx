"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClock } from "@/hooks/admin/use-clock";
import { useApiKeys, useRevokeApiKey } from "@/hooks/admin/use-trust";
import { formatDateNumeric, formatElapsed } from "@/lib/format";
import { API_SCOPES } from "@/lib/leva-ja/trust";
import type { ApiKey } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import CreateKeyDialog from "../dialogs/create-key-dialog";
import SecretDialog from "../dialogs/secret-dialog";

const SCOPE_LABELS = Object.fromEntries(API_SCOPES.map((scope) => [scope.key, scope.label]));

function keyState(key: ApiKey, now: number) {
  if (key.revokedAt) return { tone: "neutral", label: "Revogada" } as const;
  if (key.expiresAt && Date.parse(key.expiresAt) <= now) return { tone: "danger", label: "Expirada" } as const;
  if (key.expiresAt && Date.parse(key.expiresAt) - now < 14 * 86_400_000) return { tone: "warning", label: "Expira em breve" } as const;
  return { tone: "success", label: "Activa" } as const;
}

export default function ApiKeysPanel() {
  const now = useClock();
  const query = useApiKeys();
  const revoke = useRevokeApiKey();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [target, setTarget] = useState<ApiKey | null>(null);

  return (
    <section aria-labelledby="api-keys-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="api-keys-title" className="eyebrow-style text-faint font-normal">
            Chaves de API
          </h2>
          <p className="caption-style text-subtle max-w-[60em]">Só o início de cada chave fica guardado. Revogue de imediato qualquer chave que possa ter sido exposta.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon aria-hidden className="size-3" />
          Nova chave
        </Button>
      </div>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-48 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(items) => items.length === 0}
        empty={{
          title: "Sem chaves",
          description: "Ainda não foi criada nenhuma chave de API.",
        }}
      >
        {(keys) => (
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table aria-label="Chaves de API">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Nome</TableHead>
                  <TableHead scope="col">Chave</TableHead>
                  <TableHead scope="col">Permissões</TableHead>
                  <TableHead scope="col">Último uso</TableHead>
                  <TableHead scope="col">Validade</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Acções</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const state = keyState(key, now);
                  return (
                    <TableRow key={key.id}>
                      <TableCell>
                        <span className="font-medium">{key.name}</span>
                        <span className="caption-style text-subtle block pt-0.5">
                          {key.createdBy} · {formatDateNumeric(key.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-soft font-mono text-[12px] whitespace-nowrap">{key.prefix}…</TableCell>
                      <TableCell className="text-soft min-w-[200px]">{key.scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(", ")}</TableCell>
                      <TableCell className="text-soft whitespace-nowrap tabular-nums">{key.lastUsedAt ? `há ${formatElapsed(key.lastUsedAt, now)}` : "Nunca"}</TableCell>
                      <TableCell className="text-soft whitespace-nowrap tabular-nums">{key.expiresAt ? formatDateNumeric(key.expiresAt) : "Sem validade"}</TableCell>
                      <TableCell>
                        <ToneBadge tone={state.tone} label={state.label} />
                      </TableCell>
                      <TableCell>
                        {!key.revokedAt && (
                          <span className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setTarget(key)} aria-label={`Revogar a chave ${key.name}`}>
                              Revogar
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
      <CreateKeyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(value) => {
          setCreating(false);
          setSecret(value);
        }}
      />
      <SecretDialog title="Chave de API criada" label="Chave" secret={secret} onClose={() => setSecret(null)} />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            revoke.reset();
          }
        }}
        title={target ? `Revogar a chave ${target.name}?` : "Revogar chave"}
        description="Os pedidos feitos com esta chave passam a ser recusados de imediato. Não é possível reactivá-la."
        confirmLabel="Revogar"
        tone="danger"
        requireReason
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
    </section>
  );
}
