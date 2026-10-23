"use client";

import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { PricingUpdate, ZoneInput } from "@/data/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function usePricing() {
  return useQuery({ queryKey: ["admin", "pricing"], queryFn: () => repositories().pricing.get() });
}

export function useUpdatePricing() {
  return useAdminMutation(({ update, reason }: { update: PricingUpdate; reason: string }) => repositories().pricing.update(update, reason), {
    success: "Tabela de preços actualizada",
    description: "As novas regras aplicam-se aos próximos pedidos.",
  });
}

export function useCreateZone() {
  return useAdminMutation(({ input, reason }: { input: ZoneInput; reason: string }) => repositories().zones.create(input, reason), {
    success: (zone) => `Zona ${zone.name} criada`,
  });
}

export function useUpdateZone() {
  return useAdminMutation(({ id, input, reason }: { id: string; input: ZoneInput; reason: string }) => repositories().zones.update(id, input, reason), {
    success: (zone) => `Zona ${zone.name} actualizada`,
  });
}

export function useRemoveZone() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string; name: string }) => repositories().zones.remove(id, reason), {
    success: "Zona removida",
  });
}
