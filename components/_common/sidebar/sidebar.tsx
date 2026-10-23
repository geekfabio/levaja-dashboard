"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/_ui/sheet";
import type { ReactNode } from "react";
import SidebarResizer from "./sidebar-resizer";
import { useUiStore } from "@/stores/ui-store";

type SidebarProps = {
  children: ReactNode;
  description: string;
};

export default function Sidebar({ children, description }: SidebarProps) {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  return (
    <>
      <aside className="relative hidden w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        {children}
        <SidebarResizer />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[254px] max-w-[85vw] border-sidebar-border bg-sidebar"
        >
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
