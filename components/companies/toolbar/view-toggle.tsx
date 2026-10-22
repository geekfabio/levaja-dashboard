"use client";

import { useEffect } from "react";
import Button from "@/components/_ui/button";
import { readStoredView, useCompaniesStore, type CompaniesView } from "@/stores/companies-store";
import ListIcon from "@/public/assets/images/companies/sidebar/list.svg";

const VIEWS: { key: CompaniesView; label: string }[] = [
  { key: "lista", label: "Lista" },
  { key: "grelha", label: "Grelha" },
];

function GridGlyph() {
  return (
    <span aria-hidden className="grid size-3 grid-cols-2 gap-[2px] p-px">
      {Array.from({ length: 4 }, (_, index) => (
        <span key={index} className="rounded-[1.5px] bg-current" />
      ))}
    </span>
  );
}

export default function ViewToggle() {
  const view = useCompaniesStore((state) => state.view);
  const setView = useCompaniesStore((state) => state.setView);

  useEffect(() => {
    const stored = readStoredView();
    if (stored) useCompaniesStore.setState({ view: stored });
  }, []);

  return (
    <div
      role="group"
      aria-label="Vista"
      className="bg-secondary mr-1 flex items-center gap-0.5 rounded-full p-0.5 shadow-[0px_0px_0px_1px_var(--edge-shadow),inset_0px_1px_0px_0px_rgba(255,255,255,0.1),inset_0px_0px_0px_1px_rgba(255,255,255,0.06)]"
    >
      {VIEWS.map((item) => {
        const active = view === item.key;
        return (
          <Button
            key={item.key}
            variant={active ? "muted" : "ghost"}
            size="sm"
            aria-pressed={active}
            title={`Vista em ${item.label.toLowerCase()}`}
            onClick={() => setView(item.key)}
            className="h-[26px] gap-1.5 px-2.5 py-0"
          >
            {item.key === "lista" ? (
              <ListIcon aria-hidden className="size-3" />
            ) : (
              <GridGlyph />
            )}
            <span className="hidden md:inline">{item.label}</span>
            <span className="sr-only md:hidden">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
