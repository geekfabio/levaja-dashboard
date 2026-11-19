"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SettingsPanel from "@/components/settings/settings-panel";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import { errorMessage } from "@/data/leva-ja";
import { NAV_SECTIONS, SECTION_LABELS } from "@/lib/leva-ja/navigation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, canAccessSection, hasPermission } from "@/lib/leva-ja/permissions";
import type { AdminPermission, AdminRole, PlatformSettings } from "@/types/leva-ja";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import Skeleton from "@/components/_ui/skeleton";
import AsyncState from "@/components/_common/async-state";
import { usePlatformSettings } from "@/hooks/admin/use-settings";
import { SETTINGS_SECTION_LABELS, SETTINGS_SECTION_PERMISSION } from "@/lib/leva-ja/settings";
import { CancellationSection, DispatchSection, DocumentsSection, ServicesSection } from "./sections/operations-sections";
import { PayoutsSection, TaxSection } from "./sections/finance-sections";
import { AppSection, GeneralSection, NotificationsSection, SecuritySection, SupportSection } from "./sections/system-sections";
import RolesMatrix from "./roles-matrix";
import { useAdminSessionStore } from "@/stores/admin-session-store";

function AccountSection() {
  const session = useAdminSessionStore((state) => state.session);

  if (!session) return null;
  const { user } = session;
  const sections = NAV_SECTIONS.filter((section) => canAccessSection(user.role, section));

  return (
    <>
        <div className="flex w-full flex-col gap-6">
          <SettingsPanel title="A sua conta" className="bg-card" description={ROLE_DESCRIPTIONS[user.role]}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">Nome</dt>
                <dd className="lead-style">{user.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">E-mail</dt>
                <dd className="lead-style break-all">{user.email}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">Papel</dt>
                <dd>
                  <Tag tone="green" size="sm">
                    {ROLE_LABELS[user.role]}
                  </Tag>
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              <span className="caption-style text-subtle">Secções a que tem acesso</span>
              <ul className="flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <li key={section}>
                    <Tag tone="neutral" size="sm">
                      {SECTION_LABELS[section]}
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          </SettingsPanel>
        </div>
    </>
  );
}

type SectionComponent = (props: { settings: PlatformSettings; canEdit: boolean }) => React.ReactNode;

const PLATFORM_TABS: { value: keyof typeof SETTINGS_SECTION_LABELS; component: SectionComponent }[] = [
  { value: "general", component: GeneralSection },
  { value: "services", component: ServicesSection },
  { value: "dispatch", component: DispatchSection },
  { value: "cancellation", component: CancellationSection },
  { value: "payouts", component: PayoutsSection },
  { value: "tax", component: TaxSection },
  { value: "documents", component: DocumentsSection },
  { value: "notifications", component: NotificationsSection },
  { value: "support", component: SupportSection },
  { value: "security", component: SecuritySection },
  { value: "app", component: AppSection },
];

function canEdit(role: AdminRole, permission: AdminPermission) {
  return hasPermission(role, permission);
}

export default function AdminSettings() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  useAdminSessionStore((state) => state.session?.rolePermissions);
  const settings = usePlatformSettings();
  const [tab, setTab] = useState("account");
  if (!role) return null;
  const canRoles = hasPermission(role, "security.manage");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Definições" />
      <ScrollArea className="min-h-0 flex-1">
        <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="mx-auto w-full max-w-[1280px] gap-6 p-5 lg:flex-row lg:items-start">
          <TabsList
            aria-label="Secções das definições"
            className="border-border shrink-0 gap-0 overflow-x-auto border-b lg:sticky lg:top-0 lg:w-[220px] lg:flex-col lg:items-stretch lg:overflow-visible lg:border-r lg:border-b-0 lg:pr-3 *:whitespace-nowrap"
          >
            <TabsTrigger value="account" className="focus-visible:ring-ring/60 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-inset lg:border-b-0">
              Conta
            </TabsTrigger>
            {PLATFORM_TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="focus-visible:ring-ring/60 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-inset lg:border-b-0">
                {SETTINGS_SECTION_LABELS[item.value]}
              </TabsTrigger>
            ))}
            {canRoles && (
              <TabsTrigger value="roles" className="focus-visible:ring-ring/60 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-inset lg:border-b-0">
                Papéis e permissões
              </TabsTrigger>
            )}
          </TabsList>
          <div className="min-w-0 flex-1">
            <TabsContent value="account">
              <AccountSection />
            </TabsContent>
            {PLATFORM_TABS.map((item) => {
              const Section = item.component;
              return (
                <TabsContent key={item.value} value={item.value}>
                  <AsyncState query={settings} skeleton={<Skeleton className="h-[420px] rounded-xl" />} errorDescription={errorMessage}>
                    {(data) => <Section key={data.updatedAt} settings={data} canEdit={canEdit(role, SETTINGS_SECTION_PERMISSION[item.value])} />}
                  </AsyncState>
                </TabsContent>
              );
            })}
            {canRoles && (
              <TabsContent value="roles">
                <RolesMatrix />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </ScrollArea>
    </section>
  );
}
