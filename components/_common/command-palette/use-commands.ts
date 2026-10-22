"use client";

import type { ComponentType, SVGProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActivitiesStore } from "@/stores/activities-store";
import { useAutomationsStore } from "@/stores/automations-store";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTicketsStore } from "@/stores/tickets-store";
import { useQuotesStore } from "@/stores/quotes-store";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import BarChartIcon from "@/public/assets/images/companies/sidebar/bar-chart.svg";
import BarChartAltIcon from "@/public/assets/images/companies/sidebar/bar-chart-10.svg";
import ListIcon from "@/public/assets/images/companies/sidebar/list.svg";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";
import MessageQuestionIcon from "@/public/assets/images/companies/sidebar/message-question.svg";
import UserPlusIcon from "@/public/assets/images/companies/sidebar/user-plus.svg";
import ClockIcon from "@/public/assets/images/companies/detail/clock.svg";
import SettingsIcon from "@/public/assets/images/_common/filter.svg";
import WalletIcon from "@/public/assets/images/companies/sidebar/wallet.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import { switchTheme } from "@/components/_common/theme-toggle";
import TargetIcon from "@/public/assets/images/companies/sidebar/target-05.svg";
import ChatIcon from "@/public/assets/images/companies/detail/phone-call.svg";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type PageCommand = {
  href: string;
  label: string;
  icon: Icon;
  shortcut: string;
  keywords: string[];
};

export type CreateCommand = {
  id: string;
  label: string;
  icon: Icon;
  href: string;
  keywords: string[];
  open: () => void;
};

export const PAGES: PageCommand[] = [
  { href: "/", label: "Clientes", icon: BuildingIcon, shortcut: "C", keywords: ["carteira", "empresas"] },
  { href: "/follow-up", label: "Follow-up", icon: ClockIcon, shortcut: "F", keywords: ["seguimento", "hoje", "agenda", "contactar", "lembretes"] },
  { href: "/oportunidades", label: "Oportunidades", icon: ClipboardIcon, shortcut: "O", keywords: ["negócios", "funil", "quadro"] },
  { href: "/previsao", label: "Previsão", icon: BarChartIcon, shortcut: "P", keywords: ["painel", "metas"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChartAltIcon, shortcut: "R", keywords: ["desempenho", "risco"] },
  { href: "/atividades", label: "Atividades", icon: ListIcon, shortcut: "A", keywords: ["visitas", "tarefas", "calendário", "rota"] },
  { href: "/contactos", label: "Contactos", icon: BookClosedIcon, shortcut: "N", keywords: ["pessoas", "consentimento"] },
  { href: "/conversas", label: "Conversas", icon: ChatIcon, shortcut: "W", keywords: ["whatsapp", "sms", "mensagens", "chat", "responder"] },
  { href: "/vendas", label: "Vendas", icon: WalletIcon, shortcut: "V", keywords: ["compras", "faturas", "pagamentos", "dívida"] },
  { href: "/cotacoes", label: "Cotações", icon: TargetIcon, shortcut: "Q", keywords: ["orçamentos", "propostas", "encomendas", "preços", "catálogo"] },
  { href: "/campanhas", label: "Campanhas", icon: MailIcon, shortcut: "M", keywords: ["e-mail", "sms", "mensagens"] },
  { href: "/automacoes", label: "Automações", icon: ClockIcon, shortcut: "U", keywords: ["regras", "sequências"] },
  { href: "/tickets", label: "Tickets", icon: MessageQuestionIcon, shortcut: "T", keywords: ["suporte", "sla", "reclamações"] },
  { href: "/auditoria", label: "Auditoria", icon: ListIcon, shortcut: "L", keywords: ["registo", "histórico", "alterações"] },
  { href: "/definicoes", label: "Definições", icon: SettingsIcon, shortcut: "D", keywords: ["empresa", "equipas", "zonas", "acessos", "modelos"] },
];

export const CREATE_COMMANDS: CreateCommand[] = [
  {
    id: "novo-cliente",
    label: "Novo cliente",
    icon: PlusIcon,
    href: "/",
    keywords: ["criar", "adicionar", "cliente"],
    open: () => useCompaniesStore.getState().setNewCompanyOpen(true),
  },
  {
    id: "nova-oportunidade",
    label: "Nova oportunidade",
    icon: PlusIcon,
    href: "/oportunidades",
    keywords: ["criar", "negócio", "proposta"],
    open: () => useOpportunitiesStore.getState().setNewOpportunityOpen(true),
  },
  {
    id: "nova-cotacao",
    label: "Nova cotação",
    icon: PlusIcon,
    href: "/cotacoes",
    keywords: ["criar", "orçamento", "proposta", "preços"],
    open: () => useQuotesStore.getState().setNewQuoteOpen(true),
  },
  {
    id: "novo-contacto",
    label: "Novo contacto",
    icon: PlusIcon,
    href: "/contactos",
    keywords: ["criar", "pessoa"],
    open: () => useContactsStore.getState().setNewContactOpen(true),
  },
  {
    id: "registar-atividade",
    label: "Registar atividade",
    icon: PlusIcon,
    href: "/atividades",
    keywords: ["visita", "chamada", "reunião", "entrega"],
    open: () => useActivitiesStore.getState().setNewActivityOpen(true),
  },
  {
    id: "nova-tarefa",
    label: "Nova tarefa",
    icon: PlusIcon,
    href: "/atividades",
    keywords: ["lembrete", "prazo"],
    open: () => useActivitiesStore.getState().setNewTaskOpen(true),
  },
  {
    id: "novo-ticket",
    label: "Novo ticket",
    icon: PlusIcon,
    href: "/tickets",
    keywords: ["suporte", "reclamação", "pedido"],
    open: () => useTicketsStore.getState().setNewTicketOpen(true),
  },
  {
    id: "ticket-email",
    label: "Ticket a partir de e-mail",
    icon: MailIcon,
    href: "/tickets",
    keywords: ["suporte", "e-mail"],
    open: () => useTicketsStore.getState().setFromEmailOpen(true),
  },
  {
    id: "nova-campanha",
    label: "Nova campanha",
    icon: PlusIcon,
    href: "/campanhas",
    keywords: ["e-mail", "sms", "modelo"],
    open: () => {
      const store = useCampaignsStore.getState();
      store.closeEditor();
      store.setLibraryOpen(true);
    },
  },
  {
    id: "nova-automacao",
    label: "Nova automação",
    icon: PlusIcon,
    href: "/automacoes",
    keywords: ["regra", "sequência"],
    open: () => useAutomationsStore.getState().createAutomation(),
  },
  {
    id: "mudar-tema",
    label: "Mudar tema (claro / escuro)",
    icon: SettingsIcon,
    href: "",
    keywords: ["tema", "claro", "escuro", "branco", "preto", "aparência", "modo"],
    open: () => {
      const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      switchTheme(current === "light" ? "dark" : "light");
    },
  },
  {
    id: "convidar",
    label: "Convidar pessoa",
    icon: UserPlusIcon,
    href: "/definicoes",
    keywords: ["equipa", "utilizador", "acesso"],
    open: () => {
      const store = useSettingsStore.getState();
      store.setTab("acessos");
      store.setInviteOpen(true);
    },
  },
];

export const PRIMARY_CREATE: Record<string, string> = {
  "/": "novo-cliente",
  "/oportunidades": "nova-oportunidade",
  "/contactos": "novo-contacto",
  "/atividades": "registar-atividade",
  "/tickets": "novo-ticket",
  "/cotacoes": "nova-cotacao",
  "/campanhas": "nova-campanha",
  "/automacoes": "nova-automacao",
  "/definicoes": "convidar",
};

export function useRunCommand() {
  const router = useRouter();
  const pathname = usePathname();

  return {
    pathname,
    go: (href: string) => {
      if (href !== pathname) router.push(href);
    },
    create: (command: CreateCommand) => {
      command.open();
      if (command.href && command.href !== pathname) router.push(command.href);
    },
  };
}
