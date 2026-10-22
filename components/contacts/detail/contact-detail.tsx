"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import EditFooter from "@/components/_common/editable/edit-footer";
import { useEditable } from "@/components/_common/editable/use-editable";
import ContactEditForm, {
  CONTACT_FORM_ID,
  contactToDraft,
  type ContactDraft,
} from "./contact-edit-form";
import { Checkbox } from "@/components/_ui/checkbox";
import DetailSection from "@/components/_common/detail-section";
import Tag from "@/components/_ui/tag";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  CONSENT_CHANNEL_LABELS,
  CONTACTABILITY_STATUSES,
  type ConsentChannel,
  type ContactabilityStatus,
} from "@/data/contacts";
import { formatDateLong } from "@/lib/format";
import { useContactsStore } from "@/stores/contacts-store";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import MailIcon from "@/public/assets/images/companies/detail/mail-04.svg";
import PhoneIcon from "@/public/assets/images/companies/detail/phone.svg";
import CallButton from "@/components/_common/call-button";
import PersonalData from "./personal-data";
import { useConversationsStore } from "@/stores/conversations-store";
import { useRouter } from "next/navigation";

const CHANNELS = Object.keys(CONSENT_CHANNEL_LABELS) as ConsentChannel[];

export default function ContactDetail() {
  const detailId = useContactsStore((state) => state.detailId);
  const detailOpen = useContactsStore((state) => state.detailOpen);
  const contacts = useContactsStore((state) => state.contacts);
  const closeDetail = useContactsStore((state) => state.closeDetail);
  const router = useRouter();
  const updateContactability = useContactsStore(
    (state) => state.updateContactability,
  );
  const toggleConsent = useContactsStore((state) => state.toggleConsent);

  const updateContact = useContactsStore((state) => state.updateContact);
  const editable = useEditable<ContactDraft>();
  const [editingFor, setEditingFor] = useState<string | null>(null);

  const contact = contacts.find((item) => item.id === detailId);
  const editing = editable.editing && editingFor === contact?.id;

  function requestClose() {
    if (!editing) {
      editable.reset();
      closeDetail();
      return;
    }
    editable.requestClose(closeDetail);
  }

  return (
    <Sheet
      open={detailOpen && contact !== undefined}
      onOpenChange={(open) => !open && requestClose()}
    >
      <SheetContent side="right" className="sm:w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <BookClosedIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Detalhe do Contacto</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Dados, cliente associado e consentimento por canal
          </SheetDescription>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label="Fechar detalhe"
            onClick={requestClose}
          >
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetHeader>

        {contact && editing && editable.draft && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ContactEditForm
              draft={editable.draft}
              onChange={editable.update}
              onSubmit={(patch) => {
                updateContact(contact.id, patch);
                editable.reset();
              }}
            />
          </div>
        )}

        {contact && !editing && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <h2 className="truncate">{contact.name}</h2>
              <span className="caption-style text-subtle">
                {contact.role} · {contact.companyName}
              </span>
              <div className="lead-style flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-1">
                  <MailIcon aria-hidden className="text-soft size-3" />
                  {contact.email}
                </span>
                <span className="flex items-center gap-1">
                  <PhoneIcon aria-hidden className="text-soft size-3" />
                  {contact.phone}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <CallButton phone={contact.phone} companyId={contact.companyId} label="Ligar" variant="secondary" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    useConversationsStore
                      .getState()
                      .start(contact.id, contact.consent.whatsapp.granted ? "WhatsApp" : "SMS");
                    closeDetail();
                    router.push("/conversas");
                  }}
                >
                  {contact.consent.whatsapp.granted ? "Conversa WhatsApp" : "Conversa SMS"}
                </Button>
              </div>
            </div>

            <DetailSection title="Estado de contactabilidade">
              <Select
                value={contact.contactability}
                onValueChange={(value) =>
                  updateContactability(
                    contact.id,
                    value as ContactabilityStatus,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACTABILITY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailSection>

            <DetailSection title="Consentimento por canal">
              <div className="flex flex-col gap-4">
                {CHANNELS.map((channel) => {
                  const state = contact.consent[channel];
                  return (
                    <label
                      key={channel}
                      className="flex cursor-pointer items-start justify-between gap-3"
                    >
                      <span className="flex flex-col gap-1">
                        <span className="lead-style flex items-center gap-2">
                          {CONSENT_CHANNEL_LABELS[channel]}
                          <Tag
                            tone={state.granted ? "green" : "neutral"}
                            size="sm"
                          >
                            {state.granted ? "Consentido" : "Sem consentimento"}
                          </Tag>
                        </span>
                        <span className="caption-style text-subtle">
                          {formatDateLong(state.date)} · {state.origin}
                        </span>
                      </span>
                      <Checkbox
                        checked={state.granted}
                        onCheckedChange={() => toggleConsent(contact.id, channel)}
                      />
                    </label>
                  );
                })}
              </div>
            </DetailSection>

            <DetailSection title="Dados pessoais" className="shadow-none">
              <PersonalData contact={contact} />
            </DetailSection>
          </div>
        )}

        <SheetFooter>
          <EditFooter
            editing={editing}
            dirty={editable.dirty}
            confirmingClose={editable.confirmingClose}
            saveForm={CONTACT_FORM_ID}
            onEdit={() => {
              if (!contact) return;
              setEditingFor(contact.id);
              editable.start(contactToDraft(contact));
            }}
            onCancel={editable.reset}
            onDiscard={() => {
              editable.reset();
              closeDetail();
            }}
            onClose={requestClose}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
