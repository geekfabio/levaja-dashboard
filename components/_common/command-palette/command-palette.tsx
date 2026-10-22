"use client";

import { useRef, useState, type ComponentType, type SVGProps } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Kbd,
} from "@/components/_ui/command";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import type { EntityRef } from "@/data/audit";
import { formatMoney } from "@/lib/format";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useTicketsStore } from "@/stores/tickets-store";
import { useUiStore } from "@/stores/ui-store";
import { CREATE_COMMANDS, PAGES, PRIMARY_CREATE, useRunCommand } from "./use-commands";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";
import MessageQuestionIcon from "@/public/assets/images/companies/sidebar/message-question.svg";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchScore(value: string, search: string, keywords: string[] = []) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const [label = "", ...rest] = keywords.map(normalize);
  const haystack = [label, ...rest, normalize(value)].join(" ");
  if (!terms.every((term) => haystack.includes(term))) return 0;
  if (label.startsWith(terms[0])) return 1;
  if (terms.every((term) => label.includes(term))) return 0.8;
  return 0.5;
}

function IconBox({ icon: Icon }: { icon: Icon }) {
  return (
    <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md shadow-[0px_0px_0px_1px_var(--border)]">
      <Icon aria-hidden className="text-soft size-3" />
    </span>
  );
}

type RecordItem = {
  ref: EntityRef;
  detail: string;
  keywords: string[];
  icon: Icon;
};

function useRecords(): RecordItem[] {
  const companies = useCompaniesStore((state) => state.companies);
  const contacts = useContactsStore((state) => state.contacts);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const tickets = useTicketsStore((state) => state.tickets);
  const campaigns = useCampaignsStore((state) => state.campaigns);

  return [
    ...companies.map((company) => ({
      ref: { module: "Clientes" as const, id: company.id, label: company.name },
      detail: company.owner,
      keywords: [company.owner, company.zone, ...company.tags],
      icon: BuildingIcon,
    })),
    ...contacts.map((contact) => ({
      ref: { module: "Contactos" as const, id: contact.id, label: contact.name },
      detail: contact.email,
      keywords: [contact.email, contact.phone, contact.role],
      icon: BookClosedIcon,
    })),
    ...opportunities.map((opportunity) => ({
      ref: { module: "Oportunidades" as const, id: opportunity.id, label: opportunity.companyName },
      detail: `${opportunity.stage} · ${formatMoney(opportunity.value)}`,
      keywords: [opportunity.owner, opportunity.stage, opportunity.contactName],
      icon: ClipboardIcon,
    })),
    ...tickets.map((ticket) => ({
      ref: { module: "Tickets" as const, id: ticket.id, label: ticket.subject },
      detail: `${ticket.status} · ${ticket.companyName ?? "Sem cliente"}`,
      keywords: [ticket.companyName ?? "", ticket.assignee, ticket.priority],
      icon: MessageQuestionIcon,
    })),
    ...campaigns.map((campaign) => ({
      ref: { module: "Campanhas" as const, id: campaign.id, label: campaign.name },
      detail: campaign.status,
      keywords: [campaign.channel, campaign.status, campaign.subject],
      icon: MailIcon,
    })),
  ];
}

export default function CommandPalette() {
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const [query, setQuery] = useState("");
  const actionRan = useRef(false);
  const records = useRecords();
  const openTarget = useOpenTarget();
  const { pathname, go, create } = useRunCommand();

  const primaryId = PRIMARY_CREATE[pathname];
  const createCommands = [...CREATE_COMMANDS].sort(
    (a, b) => Number(b.id === primaryId) - Number(a.id === primaryId),
  );
  const searching = query.trim().length > 0;

  function run(action: () => void) {
    actionRan.current = true;
    setOpen(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Pesquisar e navegar"
      description="Procure clientes, contactos, oportunidades, tickets e campanhas, abra um módulo ou crie um registo."
      className="max-w-[620px]"
      onCloseAutoFocus={(event) => {
        if (actionRan.current) event.preventDefault();
        actionRan.current = false;
        setQuery("");
      }}
    >
      <Command filter={matchScore}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Pesquisar registos ou escrever um comando…"
          trailing={<Kbd>Esc</Kbd>}
        />
        <CommandList>
          <CommandEmpty>Sem resultados para “{query}”.</CommandEmpty>

          {searching && (
            <CommandGroup heading="Registos">
              {records.map((record) => (
                <CommandItem
                  key={`${record.ref.module}-${record.ref.id}`}
                  value={`${record.ref.module}-${record.ref.id}`}
                  keywords={[record.ref.label, record.ref.module, ...record.keywords]}
                  onSelect={() => run(() => openTarget(record.ref))}
                  className="h-12"
                >
                  <IconBox icon={record.icon} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{record.ref.label}</span>
                    <span className="caption-style text-subtle truncate">{record.detail}</span>
                  </span>
                  <span className="caption-style text-subtle shrink-0">{record.ref.module}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Criar">
            {createCommands.map((command) => (
              <CommandItem
                key={command.id}
                value={command.id}
                keywords={[command.label, ...command.keywords]}
                onSelect={() => run(() => create(command))}
              >
                <IconBox icon={command.icon} />
                <span className="flex-1 truncate">{command.label}</span>
                {command.id === primaryId && <Kbd aria-label="Atalho: N">N</Kbd>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ir para">
            {PAGES.map((page) => (
              <CommandItem
                key={page.href}
                value={`ir-${page.href}`}
                keywords={[page.label, ...page.keywords]}
                onSelect={() => run(() => go(page.href))}
              >
                <IconBox icon={page.icon} />
                <span className="flex-1 truncate">{page.label}</span>
                {page.href === pathname ? (
                  <span className="caption-style text-subtle">Página atual</span>
                ) : (
                  <span className="flex items-center gap-1" aria-label={`Atalho: G seguido de ${page.shortcut}`}>
                    <Kbd>G</Kbd>
                    <Kbd>{page.shortcut}</Kbd>
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <CommandFooter>
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            Navegar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            Abrir
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Kbd>/</Kbd>
            Pesquisar na página
          </span>
        </CommandFooter>
      </Command>
    </CommandDialog>
  );
}
