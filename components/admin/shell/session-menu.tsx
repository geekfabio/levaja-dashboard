"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { ADMIN_LOGIN, SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { toast } from "@/stores/toast-store";

export default function SessionMenu() {
  const router = useRouter();
  const session = useAdminSessionStore((state) => state.session);
  const logout = useAdminSessionStore((state) => state.logout);
  if (!session) return null;
  const { user } = session;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-[30px] gap-2 pr-2.5 pl-1" aria-label={`Sessão de ${user.name}`}>
          <span aria-hidden className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-[11px] font-semibold">
            {user.initials}
          </span>
          <span className="hidden max-w-[12em] truncate md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>
          <span className="flex flex-col gap-1">
            <span className="lead-style text-foreground">{user.name}</span>
            <span className="caption-style text-subtle">
              {user.email} · {ROLE_LABELS[user.role]}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(SECTION_ROUTES.settings)}>Definições</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            toast({ title: "Sessão terminada", tone: "success" });
            router.replace(ADMIN_LOGIN);
          }}
        >
          Terminar sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
