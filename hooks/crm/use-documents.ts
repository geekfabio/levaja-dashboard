"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { DocumentUpload } from "@/data/crm";
import { useCompaniesStore } from "@/stores/companies-store";
import { recordEvent } from "@/stores/audit-store";

const KEY = ["crm", "documents"] as const;

function companyName(companyId: string) {
  return useCompaniesStore.getState().companies.find((company) => company.id === companyId)?.name ?? companyId;
}

export function useDocuments() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().documents.list() });
}

export function useUploadDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentUpload) => repositories().documents.upload(input),
    onSuccess: (document) => {
      client.invalidateQueries({ queryKey: KEY });
      recordEvent({
        action: `anexou «${document.name}» a`,
        target: { module: "Clientes", id: document.companyId, label: companyName(document.companyId) },
        companyId: document.companyId,
        notify: false,
        changes: [
          { field: "Categoria", to: document.category },
          ...(document.expiresAt ? [{ field: "Validade", to: document.expiresAt.split("-").reverse().join("/") }] : []),
        ],
        toast: { title: "Documento anexado", description: document.name, tone: "success" },
      });
    },
  });
}

export function useRemoveDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().documents.remove(id),
    onSuccess: (document) => {
      client.invalidateQueries({ queryKey: KEY });
      recordEvent({
        action: `removeu «${document.name}» de`,
        target: { module: "Clientes", id: document.companyId, label: companyName(document.companyId) },
        companyId: document.companyId,
        sensitive: true,
        notify: false,
        toast: {
          title: "Documento removido",
          description: document.name,
          action: {
            label: "Anular",
            run: () => repositories().documents.restore(document).then(() => client.invalidateQueries({ queryKey: KEY })),
          },
        },
      });
    },
  });
}
