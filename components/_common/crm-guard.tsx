"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Skeleton from "@/components/_ui/skeleton";
import { ADMIN_LOGIN } from "@/lib/leva-ja/navigation";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { toast } from "@/stores/toast-store";

function ShellSkeleton() {
  return (
    <div aria-busy="true" className="flex h-dvh w-full">
      <span className="sr-only">A verificar a sessão…</span>
      <div className="border-sidebar-border bg-sidebar hidden w-(--sidebar-width) shrink-0 flex-col gap-3 border-r p-3 lg:flex">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function CrmGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAdminSessionStore((state) => state.status);
  const expired = useAdminSessionStore((state) => state.expired);
  const load = useAdminSessionStore((state) => state.load);

  useEffect(() => {
    if (status === "loading") load();
  }, [status, load]);

  useEffect(() => {
    if (status !== "anonymous") return;
    if (expired) toast({ title: "Sessão expirada", description: "Inicie sessão novamente para continuar.", tone: "danger" });
    router.replace(`${ADMIN_LOGIN}?next=${encodeURIComponent(pathname)}`);
  }, [status, expired, pathname, router]);

  if (status !== "authenticated") return <ShellSkeleton />;
  return <>{children}</>;
}
