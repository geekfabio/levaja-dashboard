"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import type { FieldIssue } from "@/data/leva-ja";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateEmergencyContact, useUpdateEmergencyContact } from "@/hooks/admin/use-support";
import type { EmergencyContact } from "@/types/leva-ja";

type Props = { contact: EmergencyContact | null; onClose: () => void };

export default function EmergencyContactDialog({ contact, onClose }: Props) {
  const create = useCreateEmergencyContact();
  const update = useUpdateEmergencyContact();
  const mutation = contact ? update : create;
  const [label, setLabel] = useState(contact?.label ?? "");
  const [phoneNumber, setPhoneNumber] = useState(contact?.phoneNumber ?? "");
  const issues: FieldIssue[] = isRepositoryError(mutation.error) ? mutation.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const generalError = issues.length ? null : mutationError(mutation.error);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={contact ? `Editar ${contact.label}` : "Novo contacto de emergência"}
      description="Mostrado na app móvel a clientes e prestadores em caso de emergência. Confirma sempre o número antes de guardar."
      confirmLabel={contact ? "Guardar contacto" : "Criar contacto"}
      requireReason
      reasonLabel="Motivo"
      pending={mutation.isPending}
      error={generalError}
      onConfirm={(reason) => {
        const input = { label, phoneNumber };
        const request = contact ? update.mutateAsync({ id: contact.id, input, reason }) : create.mutateAsync({ input, reason });
        return request.then(onClose, () => undefined);
      }}
    >
      <Field label="Nome" htmlFor="emergency-contact-label" required error={issueFor("label")}>
        <Input id="emergency-contact-label" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
      </Field>
      <Field label="Número" htmlFor="emergency-contact-phone" required error={issueFor("phone_number")}>
        <Input id="emergency-contact-phone" inputMode="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}
