"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import Button from "@/components/_ui/button";
import { SECTION_DESCRIPTIONS, SECTION_LABELS, SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { canAccessSection } from "@/lib/leva-ja/permissions";
import type { AdminSection } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";

export default function Overview() {
  const user = useAdminSessionStore((state) => state.session?.user);
  if (!user) return null;
  const sections = (Object.keys(SECTION_ROUTES) as AdminSection[]).filter(
    (section) => section !== "overview" && canAccessSection(user.role, section),
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Visão geral" />
      <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <li key={section}>
            <Button variant="item" size="none" href={SECTION_ROUTES[section]} className="border-border bg-card flex-col gap-2 rounded-xl border p-5">
              <span className="lead-style font-medium">{SECTION_LABELS[section]}</span>
              <span className="caption-style text-subtle">{SECTION_DESCRIPTIONS[section]}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
