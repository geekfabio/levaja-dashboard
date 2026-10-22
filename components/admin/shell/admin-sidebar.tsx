"use client";

import type { ComponentType, SVGProps } from "react";
import { usePathname } from "next/navigation";
import Asset from "@/components/_ui/asset";
import { ScrollArea } from "@/components/_ui/scroll-area";
import SidebarNavItem from "@/components/_common/sidebar/sidebar-nav-item";
import SidebarSection from "@/components/_common/sidebar/sidebar-section";
import { NAV_FOOTER, NAV_GROUPS, SECTION_LABELS, SECTION_ROUTES, sectionForPath } from "@/lib/leva-ja/navigation";
import { canAccessSection } from "@/lib/leva-ja/permissions";
import type { AdminSection } from "@/lib/leva-ja/permissions";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import OverviewIcon from "@/public/assets/images/companies/sidebar/bar-chart-10.svg";
import RequestsIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import MapIcon from "@/public/assets/images/companies/sidebar/target-03.svg";
import ProvidersIcon from "@/public/assets/images/companies/sidebar/users.svg";
import DocumentsIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import ClientsIcon from "@/public/assets/images/companies/sidebar/building.svg";
import FinanceIcon from "@/public/assets/images/companies/sidebar/wallet.svg";
import PricingIcon from "@/public/assets/images/companies/sidebar/target-05.svg";
import SupportIcon from "@/public/assets/images/companies/sidebar/message-question.svg";
import UsersIcon from "@/public/assets/images/companies/sidebar/user-plus.svg";
import AuditIcon from "@/public/assets/images/companies/sidebar/list.svg";
import SettingsIcon from "@/public/assets/images/_common/filter.svg";

const SECTION_ICONS: Record<AdminSection, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: OverviewIcon,
  requests: RequestsIcon,
  map: MapIcon,
  providers: ProvidersIcon,
  documents: DocumentsIcon,
  clients: ClientsIcon,
  finance: FinanceIcon,
  pricing: PricingIcon,
  support: SupportIcon,
  users: UsersIcon,
  audit: AuditIcon,
  settings: SettingsIcon,
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const active = sectionForPath(pathname);
  const visible = (section: AdminSection) => (role ? canAccessSection(role, section) : false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <Asset
          type="image"
          src="/assets/images/_common/brand/leva-ja-mark.svg"
          alt="Leva Já"
          width={40}
          height={40}
          fit="contain"
          className="size-8 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">Leva Já</span>
          <span className="caption-style text-subtle block truncate">
            Painel de administração{role ? ` · ${ROLE_LABELS[role]}` : ""}
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Secções do painel">
          {NAV_GROUPS.map((group, index) => {
            const sections = group.sections.filter(visible);
            if (sections.length === 0) return null;
            return (
              <SidebarSection
                key={group.title ?? index}
                title={group.title}
                className="border-sidebar-border border-b last:border-b-0"
              >
                {sections.map((section) => (
                  <SidebarNavItem
                    key={section}
                    href={SECTION_ROUTES[section]}
                    icon={SECTION_ICONS[section]}
                    label={SECTION_LABELS[section]}
                    active={active === section}
                  />
                ))}
              </SidebarSection>
            );
          })}
        </nav>
      </ScrollArea>

      <SidebarSection className="border-sidebar-border shrink-0 border-t">
        {NAV_FOOTER.filter(visible).map((section) => (
          <SidebarNavItem
            key={section}
            href={SECTION_ROUTES[section]}
            icon={SECTION_ICONS[section]}
            label={SECTION_LABELS[section]}
            tone="quiet"
            active={active === section}
          />
        ))}
      </SidebarSection>
    </div>
  );
}
