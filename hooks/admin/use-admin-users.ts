"use client";

import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { CreateAdminUserInput } from "@/data/leva-ja";
import type { AdminRole } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useAdminUsers(enabled = true) {
  return useQuery({ queryKey: ["admin", "users"], queryFn: () => repositories().auth.listUsers(), enabled });
}

export function useCreateAdminUser() {
  return useAdminMutation(({ input, reason }: { input: CreateAdminUserInput; reason: string }) => repositories().auth.createUser(input, reason), {
    success: (user) => `${user.name} adicionado`,
    description: "Pode entrar com o e-mail e o código enviado.",
  });
}

export function useChangeAdminRole() {
  return useAdminMutation(({ id, role, reason }: { id: string; role: AdminRole; reason: string }) => repositories().auth.changeRole(id, role, reason), {
    success: (user) => `Papel de ${user.name} alterado`,
  });
}

export function useSetAdminActive() {
  return useAdminMutation(({ id, active, reason }: { id: string; active: boolean; reason: string }) => repositories().auth.setActive(id, active, reason), {
    success: (user) => (user.active ? `${user.name} activado` : `${user.name} desactivado`),
  });
}
