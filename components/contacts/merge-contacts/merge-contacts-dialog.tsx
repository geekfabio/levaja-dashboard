"use client";

import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import Tag from "@/components/_ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import type { MergeFieldKey } from "@/stores/contacts-store";
import { useContactsStore } from "@/stores/contacts-store";

const FIELD_LABELS: Record<MergeFieldKey, string> = {
  role: "Cargo",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

const FIELDS = Object.keys(FIELD_LABELS) as MergeFieldKey[];

export default function MergeContactsDialog() {
  const contacts = useContactsStore((state) => state.contacts);
  const mergeOpen = useContactsStore((state) => state.mergeOpen);
  const mergePrimaryId = useContactsStore((state) => state.mergePrimaryId);
  const mergeSecondaryId = useContactsStore((state) => state.mergeSecondaryId);
  const mergeChoices = useContactsStore((state) => state.mergeChoices);
  const setMergeOpen = useContactsStore((state) => state.setMergeOpen);
  const setMergePrimaryId = useContactsStore((state) => state.setMergePrimaryId);
  const setMergeSecondaryId = useContactsStore(
    (state) => state.setMergeSecondaryId,
  );
  const setMergeChoice = useContactsStore((state) => state.setMergeChoice);
  const confirmMerge = useContactsStore((state) => state.confirmMerge);

  const primary = contacts.find((item) => item.id === mergePrimaryId);
  const secondary = contacts.find((item) => item.id === mergeSecondaryId);
  const canMerge = Boolean(primary && secondary && primary.id !== secondary.id);

  return (
    <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Fundir Duplicados</DialogTitle>
          <DialogDescription>
            Escolha os dois contactos e, para cada campo, qual valor fica. O
            segundo contacto desaparece da lista.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contacto principal" htmlFor="merge-primary">
              <Select
                value={mergePrimaryId ?? undefined}
                onValueChange={setMergePrimaryId}
              >
                <SelectTrigger id="merge-primary">
                  <SelectValue placeholder="Escolher contacto" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} · {contact.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contacto a fundir" htmlFor="merge-secondary">
              <Select
                value={mergeSecondaryId ?? undefined}
                onValueChange={setMergeSecondaryId}
              >
                <SelectTrigger id="merge-secondary">
                  <SelectValue placeholder="Escolher contacto" />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    .filter((contact) => contact.id !== mergePrimaryId)
                    .map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} · {contact.companyName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {primary && secondary && (
            <div className="flex flex-col gap-3">
              {FIELDS.map((field) => {
                const winner = mergeChoices[field];
                return (
                  <div key={field} className="flex flex-col gap-1.5">
                    <span className="caption-style text-subtle">
                      {FIELD_LABELS[field]}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMergeChoice(field, "primary")}
                        className="text-left"
                      >
                        <Tag
                          tone={winner === "primary" ? "blue" : "neutral"}
                          className="w-full cursor-pointer justify-start px-2 py-4 whitespace-normal"
                        >
                          {primary[field] || "—"}
                        </Tag>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergeChoice(field, "secondary")}
                        className="text-left"
                      >
                        <Tag
                          tone={winner === "secondary" ? "blue" : "neutral"}
                          className="w-full cursor-pointer justify-start px-2 py-4 whitespace-normal"
                        >
                          {secondary[field] || "—"}
                        </Tag>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="subtle" size="sm" onClick={() => setMergeOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canMerge}
            onClick={confirmMerge}
          >
            Fundir Contactos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
