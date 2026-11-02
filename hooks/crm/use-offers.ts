"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { ManualOffer } from "@/data/crm";
import type { DiscountOffer } from "@/data/discount-offers";
import { offerScopeLabel } from "@/lib/automation-engine";
import { formatDateShort, formatPercent } from "@/lib/format";
import { recordEvent } from "@/stores/audit-store";
import { useCompaniesStore } from "@/stores/companies-store";

const KEY = ["crm", "offers"] as const;

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

function companyName(companyId: string) {
  return useCompaniesStore.getState().companies.find((item) => item.id === companyId)?.name ?? companyId;
}

export function useOffers() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().offers.list() });
}

export function useCreateOffer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, today }: { input: ManualOffer; today: string }) => repositories().offers.create(input, today),
    onSuccess: (offer) => {
      invalidate(client);
      const name = companyName(offer.companyId);
      recordEvent({
        action: `propôs ${formatPercent(offer.percent)} de desconto a`,
        target: { module: "Clientes", id: offer.companyId, label: name },
        companyId: offer.companyId,
        notify: false,
        changes: [
          { field: "Desconto", to: `${formatPercent(offer.percent)} ${offerScopeLabel(offer)}` },
          { field: "Válida até", to: formatDateShort(offer.validUntil) },
        ],
        toast: {
          title: "Proposta de desconto criada",
          description: `${name} · ${formatPercent(offer.percent)} até ${formatDateShort(offer.validUntil)}`,
          tone: "success",
        },
      });
    },
  });
}

export function useSetOfferStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Apresentada" | "Recusada"; previousStatus: DiscountOffer["status"] }) =>
      repositories().offers.setStatus(id, status),
    onSuccess: (offer, { previousStatus }) => {
      invalidate(client);
      if (previousStatus === offer.status) return;
      const name = companyName(offer.companyId);
      recordEvent({
        action: offer.status === "Apresentada" ? "apresentou a proposta de desconto a" : "registou que recusou o desconto:",
        target: { module: "Clientes", id: offer.companyId, label: name },
        companyId: offer.companyId,
        notify: false,
        changes: [{ field: "Proposta", from: previousStatus, to: offer.status }],
        toast: {
          title: offer.status === "Apresentada" ? "Proposta apresentada" : "Proposta recusada",
          description: name,
          tone: "success",
        },
      });
    },
  });
}

export type { DiscountOffer };
