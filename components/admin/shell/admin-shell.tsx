"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/_common/sidebar/sidebar";
import AdminProviders from "./admin-providers";
import AdminGuard, { AccessDenied } from "./admin-guard";
import AdminSidebar from "./admin-sidebar";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      {(allowed) => (
        <AdminProviders>
          <div className="flex h-dvh max-w-full overflow-hidden">
            <a
              href="#conteudo"
              className="bg-primary text-primary-foreground sr-only z-[70] rounded-full px-4 py-2.5 text-[14px] leading-none font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              Saltar para o conteúdo
            </a>
            <Sidebar description="Secções do painel de administração do AngoLeva">
              <AdminSidebar />
            </Sidebar>
            <main id="conteudo" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 outline-none">
              {allowed ? children : <AccessDenied />}
            </main>
          </div>
        </AdminProviders>
      )}
    </AdminGuard>
  );
}
