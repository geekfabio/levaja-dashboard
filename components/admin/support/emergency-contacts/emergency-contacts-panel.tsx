"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useEmergencyContacts, useRemoveEmergencyContact } from "@/hooks/admin/use-support";
import type { EmergencyContact } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import EmergencyContactDialog from "./emergency-contact-dialog";

export default function EmergencyContactsPanel({ canEdit }: { canEdit: boolean }) {
  const contacts = useEmergencyContacts();
  const remove = useRemoveEmergencyContact();
  const [editing, setEditing] = useState<EmergencyContact | "new" | null>(null);
  const [removing, setRemoving] = useState<EmergencyContact | null>(null);

  return (
    <SettingsPanel
      title="Contactos de emergência"
      description="Mostrados na app móvel (botão de SOS e ajuda) a clientes e prestadores. Confirma os números junto de fontes oficiais antes de os publicar."
      className="bg-card"
      actions={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <PlusIcon aria-hidden className="size-3" />
            Novo contacto
          </Button>
        ) : undefined
      }
    >
      <AsyncState query={contacts} skeleton={<Skeleton className="h-40" />} errorDescription={errorMessage} isEmpty={(items) => items.length === 0} empty={{ title: "Sem contactos de emergência" }}>
        {(items) => (
          <div className="overflow-x-auto">
            <Table aria-label="Contactos de emergência">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Nome</TableHead>
                  <TableHead scope="col">Número</TableHead>
                  {canEdit && (
                    <TableHead scope="col">
                      <span className="sr-only">Acções</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.label}</TableCell>
                    <TableCell className="tabular-nums">{contact.phoneNumber}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <span className="flex justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => setEditing(contact)} aria-label={`Editar ${contact.label}`}>
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(contact)} aria-label={`Remover ${contact.label}`}>
                            Remover
                          </Button>
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AsyncState>

      {editing && <EmergencyContactDialog key={editing === "new" ? "new" : editing.id} contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            remove.reset();
          }
        }}
        title={removing ? `Remover ${removing.label}?` : "Remover contacto"}
        description="Deixa de aparecer na app móvel."
        confirmLabel="Remover contacto"
        tone="danger"
        requireReason
        pending={remove.isPending}
        error={mutationError(remove.error)}
        onConfirm={(reason) => (removing ? remove.mutateAsync({ id: removing.id, reason }).then(() => setRemoving(null), () => undefined) : undefined)}
      />
    </SettingsPanel>
  );
}
