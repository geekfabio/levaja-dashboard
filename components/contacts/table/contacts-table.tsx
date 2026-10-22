"use client";

import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import {
  CONSENT_CHANNEL_LABELS,
  CONTACTABILITY_TONES,
  type Contact,
} from "@/data/contacts";
import { cn } from "@/lib/utils";
import { useContactsStore } from "@/stores/contacts-store";

type ContactsTableProps = {
  contacts: Contact[];
};

function ConsentDots({ contact }: { contact: Contact }) {
  return (
    <span className="flex items-center gap-1.5">
      {(Object.keys(CONSENT_CHANNEL_LABELS) as (keyof typeof CONSENT_CHANNEL_LABELS)[]).map(
        (channel) => (
          <span
            key={channel}
            title={`${CONSENT_CHANNEL_LABELS[channel]}: ${
              contact.consent[channel].granted ? "consentido" : "sem consentimento"
            }`}
            className={cn(
              "caption-style inline-flex h-[18px] items-center rounded-full border px-1.5",
              contact.consent[channel].granted
                ? "border-(--tag-green-border) bg-(--tag-green-bg) text-(--tag-green-text)"
                : "border-(--tag-neutral-border) bg-(--tag-neutral-bg) text-subtle",
            )}
          >
            {CONSENT_CHANNEL_LABELS[channel]}
          </span>
        ),
      )}
    </span>
  );
}

export default function ContactsTable({ contacts }: ContactsTableProps) {
  const openDetail = useContactsStore((state) => state.openDetail);

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Consentimento</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              onClick={() => openDetail(contact.id)}
              className="hover:bg-card/60 cursor-pointer"
            >
              <TableCell className="font-medium">{contact.name}</TableCell>
              <TableCell className="text-soft">{contact.role}</TableCell>
              <TableCell className="text-soft">{contact.companyName}</TableCell>
              <TableCell className="tabular-nums">{contact.phone}</TableCell>
              <TableCell>
                <ConsentDots contact={contact} />
              </TableCell>
              <TableCell>
                <Tag tone={CONTACTABILITY_TONES[contact.contactability]}>
                  {contact.contactability}
                </Tag>
              </TableCell>
            </TableRow>
          ))}
          {contacts.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="caption-style text-subtle h-[120px] text-center"
              >
                Nenhum contacto corresponde aos filtros atuais.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
