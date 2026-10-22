"use client";

import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import Link from "next/link";
import ModuleHeader from "@/components/_common/module-header";
import { CURRENT_USER } from "@/data/companies";
import { useCompaniesStore } from "@/stores/companies-store";
import ActiveDot from "@/public/assets/images/companies/header/active-dot.svg";

const VIEWS = [
  { href: "/", label: "Clientes" },
  { href: "/oportunidades", label: "Oportunidades" },
  { href: "/previsao", label: "Previsão" },
];

export default function CompaniesHeader() {
  const openProfile = useCompaniesStore((state) => state.openProfile);

  return (
    <ModuleHeader
      title="Clientes"
      badge={
        <span className="caption-style bg-muted hidden shrink-0 items-center gap-0.5 rounded-full border border-(--tag-neutral-border) py-[3px] pr-[5px] pl-[3px] sm:inline-flex">
          <ActiveDot aria-hidden className="size-3" />
          Ativo
        </span>
      }
      actions={
        <Button
          variant="secondary"
          size="none"
          className="caption-style h-[30px] gap-1.5 py-[5px] pr-[7px] pl-[5px] font-normal"
          aria-label={`Abrir perfil de ${CURRENT_USER.name}`}
          onClick={() => openProfile(CURRENT_USER.name)}
        >
          <Avatar src={CURRENT_USER.avatar} alt="" />
          <span className="hidden sm:inline">{CURRENT_USER.name}</span>
        </Button>
      }
    >
      <nav aria-label="Vistas da carteira" className="border-border flex items-center gap-4 border-b px-4">
        {VIEWS.map((view) => {
          const current = view.href === "/";
          return (
            <Link
              key={view.href}
              href={view.href}
              aria-current={current ? "page" : undefined}
              className={
                current
                  ? "caption-style text-foreground border-foreground -mb-px border-b py-4 font-medium"
                  : "caption-style text-subtle hover:text-soft focus-visible:text-foreground ease-power3-out -mb-px border-b border-transparent py-4 transition-colors duration-150 outline-none"
              }
            >
              {view.label}
            </Link>
          );
        })}
      </nav>
    </ModuleHeader>
  );
}
