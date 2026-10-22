"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import { Kbd } from "@/components/_ui/command";
import Notifications from "@/components/_common/notifications/notifications";
import ThemeToggle from "@/components/_common/theme-toggle";
import { useModifierKey } from "@/hooks/use-modifier-key";
import { useUiStore } from "@/stores/ui-store";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type HeaderActionsProps = {
  children?: ReactNode;
};

export default function HeaderActions({ children }: HeaderActionsProps) {
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const modifier = useModifierKey();

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-label="Pesquisar e navegar"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setPaletteOpen(true)}
        className="h-[30px] w-[30px] p-0 md:w-auto md:justify-start md:gap-2 md:pr-1.5 md:pl-2.5"
      >
        <SearchIcon aria-hidden className="size-3.5" />
        <span aria-hidden className="text-subtle hidden font-normal md:inline">
          Pesquisar…
        </span>
        <Kbd aria-hidden className="hidden md:inline-flex">
          {modifier} K
        </Kbd>
      </Button>
      <ThemeToggle />
      <Notifications />
      {children}
    </div>
  );
}
