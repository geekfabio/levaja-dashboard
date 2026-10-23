"use client";

import type { ReactNode } from "react";
import ModuleHeader from "@/components/_common/module-header";
import SessionMenu from "./session-menu";

type AdminHeaderProps = {
  title: string;
  count?: number;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function AdminHeader({ title, count, badge, actions, children }: AdminHeaderProps) {
  return (
    <ModuleHeader
      title={title}
      count={count}
      badge={badge}
      trailing={
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          <SessionMenu />
        </div>
      }
    >
      {children}
    </ModuleHeader>
  );
}
