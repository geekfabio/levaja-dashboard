"use client";

import { usePathname } from "next/navigation";
import Asset from "@/components/_ui/asset";
import { ScrollArea } from "@/components/_ui/scroll-area";
import SidebarNavItem from "./sidebar-nav-item";
import SidebarSection from "./sidebar-section";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useUiStore } from "@/stores/ui-store";
import { useSalesStore } from "@/stores/sales-store";
import { useFollowUps } from "@/components/follow-up/use-follow-ups";
import { ALL_TEAMS, ANY_ZONE } from "@/lib/companies";
import { ZONE_DOTS } from "./zone-dots";
import { TEAM_ICON_COMPONENTS } from "./team-icons";
import SettingsIcon from "@/public/assets/images/_common/filter.svg";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import BarChartIcon from "@/public/assets/images/companies/sidebar/bar-chart.svg";
import ListIcon from "@/public/assets/images/companies/sidebar/list.svg";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";
import BarChartAltIcon from "@/public/assets/images/companies/sidebar/bar-chart-10.svg";
import AlertTriangleIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";
import UserPlusIcon from "@/public/assets/images/companies/sidebar/user-plus.svg";
import MessageQuestionIcon from "@/public/assets/images/companies/sidebar/message-question.svg";
import ClockIcon from "@/public/assets/images/companies/detail/clock.svg";
import WalletIcon from "@/public/assets/images/companies/sidebar/wallet.svg";
import TargetIcon from "@/public/assets/images/companies/sidebar/target-05.svg";
import ChatIcon from "@/public/assets/images/companies/detail/phone-call.svg";
import { useConversationsStore } from "@/stores/conversations-store";

const NAV_ITEMS = [
  { href: "/", icon: BuildingIcon, label: "Clientes", withCount: true },
  { href: "/follow-up", icon: ClockIcon, label: "Follow-up", withFollowUps: true },
  { href: "/oportunidades", icon: ClipboardIcon, label: "Oportunidades" },
  { href: "/previsao", icon: BarChartIcon, label: "Previsão" },
  { href: "/relatorios", icon: BarChartAltIcon, label: "Relatórios" },
  { href: "/atividades", icon: ListIcon, label: "Atividades" },
  { href: "/contactos", icon: BookClosedIcon, label: "Contactos" },
  { href: "/conversas", icon: ChatIcon, label: "Conversas", withUnread: true },
  { href: "/vendas", icon: WalletIcon, label: "Vendas", withUnmatched: true },
  { href: "/cotacoes", icon: TargetIcon, label: "Cotações" },
  { href: "/campanhas", icon: MailIcon, label: "Campanhas" },
  { href: "/automacoes", icon: ClockIcon, label: "Automações" },
  { href: "/tickets", icon: MessageQuestionIcon, label: "Tickets" },
] as const;


const REPORTING_ITEMS = [
  { icon: BarChartAltIcon, label: "Previsão do Trimestre", href: "/previsao", overdue: false },
  { icon: AlertTriangleIcon, label: "Oportunidades Atrasadas", href: "/oportunidades", overdue: true },
] as const;


export default function SidebarContent() {
  const pathname = usePathname();
  const clientCount = useCompaniesStore(
    (state) => state.companies.filter((company) => !company.archived).length,
  );
  const teamFilter = useCompaniesStore((state) => state.team);
  const zoneFilter = useCompaniesStore((state) => state.zone);
  const overdueFilter = useOpportunitiesStore((state) => state.overdue);
  const applyView = useCompaniesStore((state) => state.applyView);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const { items: followUps } = useFollowUps();
  const dueFollowUps = followUps.filter((item) => item.bucket === "atrasado" || item.bucket === "hoje").length;
  const unmatchedSales = useSalesStore((state) => state.sales.filter((sale) => !sale.companyId).length);
  const unreadMessages = useConversationsStore((state) =>
    state.conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
  );
  const teams = useSettingsStore((state) => state.teams);
  const zones = useSettingsStore((state) => state.zones);
  const setSettingsTab = useSettingsStore((state) => state.setTab);
  const setInviteOpen = useSettingsStore((state) => state.setInviteOpen);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <Asset
          type="image"
          src="/assets/images/_common/brand/alimenta-angola-logo.png"
          alt="Alimenta Angola"
          width={96}
          height={64}
          fit="contain"
          className="size-8 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">
            Alimenta Angola CRM
          </span>
          <span className="caption-style text-subtle block truncate">
            Carteira de clientes
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Navegação principal">
          <SidebarSection className="border-sidebar-border border-b">
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={
                  pathname === item.href &&
                  !(item.href === "/" && (teamFilter !== ALL_TEAMS || zoneFilter !== ANY_ZONE)) &&
                  !(item.href === "/oportunidades" && overdueFilter)
                }
                onClick={
                  item.href === "/"
                    ? () => applyView({})
                    : item.href === "/oportunidades"
                      ? () => useOpportunitiesStore.getState().setOverdue(false)
                      : undefined
                }
                count={
                  "withCount" in item && item.withCount
                    ? clientCount
                    : "withUnmatched" in item && item.withUnmatched && unmatchedSales > 0
                      ? unmatchedSales
                      : "withFollowUps" in item && item.withFollowUps && dueFollowUps > 0
                        ? dueFollowUps
                        : "withUnread" in item && item.withUnread && unreadMessages > 0
                          ? unreadMessages
                          : undefined
                }
              />
            ))}
          </SidebarSection>

          <SidebarSection
            title="Equipas Comerciais"
            className="border-sidebar-border border-b"
          >
            {teams
              .filter((team) => team.showInSidebar)
              .map((team) => (
                <SidebarNavItem
                  key={team.id}
                  href="/"
                  icon={TEAM_ICON_COMPONENTS[team.icon]}
                  label={team.name}
                  active={pathname === "/" && teamFilter === team.id}
                  onClick={() => applyView({ team: team.id })}
                />
              ))}
          </SidebarSection>

          <SidebarSection
            title="Relatórios"
            className="border-sidebar-border border-b"
          >
            {REPORTING_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.label}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href && (!item.overdue || overdueFilter)}
                onClick={() => useOpportunitiesStore.getState().setOverdue(item.overdue)}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="Zonas">
            {zones
              .filter((zone) => zone.showInSidebar)
              .map((zone) => (
                <SidebarNavItem
                  key={zone.name}
                  href="/"
                  icon={ZONE_DOTS[zone.color]}
                  label={zone.name}
                  active={pathname === "/" && zoneFilter === zone.name}
                  onClick={() => applyView({ zone: zone.name })}
                />
              ))}
          </SidebarSection>
        </nav>
      </ScrollArea>

      <SidebarSection className="border-sidebar-border shrink-0 border-t">
        <SidebarNavItem
          href="/auditoria"
          icon={ListIcon}
          label="Auditoria"
          tone="quiet"
          active={pathname === "/auditoria"}
        />
        <SidebarNavItem
          href="/definicoes"
          icon={SettingsIcon}
          label="Definições"
          tone="quiet"
          active={pathname === "/definicoes"}
        />
        <SidebarNavItem
          href="/definicoes"
          icon={UserPlusIcon}
          label="Convidar Equipa"
          tone="quiet"
          onClick={() => {
            setSettingsTab("acessos");
            setInviteOpen(true);
          }}
        />
        <SidebarNavItem
          icon={MessageQuestionIcon}
          label="Ajuda"
          tone="quiet"
          onClick={() => setHelpOpen(true)}
        />
      </SidebarSection>
    </div>
  );
}
