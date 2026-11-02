"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { CompanyBulkPatch, CompanyPatch } from "@/data/crm";
import { EMPTY_PROFILE, STAGES, type Company, type CompanyProfile } from "@/data/companies";
import type { FollowUp } from "@/data/follow-ups";
import { diffRecord } from "@/lib/audit";
import { formatDateShort, formatMoney, formatPercent } from "@/lib/format";
import { recordEvent } from "@/stores/audit-store";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useCompaniesStore } from "@/stores/companies-store";

const KEY = ["crm", "companies"] as const;

const COMPANY_LABELS: Partial<Record<keyof Company, string>> = {
  name: "Nome",
  owner: "Gestor de conta",
  zone: "Zona",
  tags: "Segmento e fase",
  pipelineValue: "Valor em carteira",
  openDeals: "Oportunidades abertas",
  winProbability: "Probabilidade de fecho",
};

const COMPANY_FORMATTERS = {
  tags: (tags: Company["tags"]) => tags.join(", "),
  pipelineValue: (value: number) => formatMoney(value),
  winProbability: (value: number) => formatPercent(value),
};

const PROFILE_LABELS: Record<Exclude<keyof CompanyProfile, "geo">, string> = {
  nif: "NIF",
  card: "Cartão de cliente",
  phone: "Telefone",
  billingEmail: "E-mail de faturação",
  address: "Morada",
  municipality: "Município",
  paymentTerms: "Condições de pagamento",
  creditLimit: "Limite de crédito",
  customerSince: "Cliente desde",
};

function ref(company: Pick<Company, "id" | "name">) {
  return { module: "Clientes" as const, id: company.id, label: company.name };
}

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

function stageOf(company: Pick<Company, "tags">) {
  return company.tags.find((tag) => (STAGES as readonly string[]).includes(tag));
}

export function useCompanies() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().companies.list() });
}

export function useCompany(id: string | null) {
  const query = useCompanies();
  return { ...query, data: id ? query.data?.find((item) => item.id === id) : undefined };
}

export async function scheduleCompanyFollowUp(id: string, followUp: FollowUp | null, previous: FollowUp | undefined, silent = false) {
  const company = await repositories().companies.scheduleFollowUp(id, followUp);
  recordEvent({
    action: followUp ? (previous ? "reagendou o próximo contacto de" : "agendou o próximo contacto de") : "concluiu o follow-up de",
    target: ref(company),
    companyId: company.id,
    notify: false,
    changes: [
      {
        field: "Próximo contacto",
        from: previous ? `${previous.type} · ${formatDateShort(previous.date)}` : undefined,
        to: followUp ? `${followUp.type} · ${formatDateShort(followUp.date)}` : "—",
      },
    ],
    toast: silent
      ? undefined
      : {
          title: followUp ? "Próximo contacto agendado" : "Follow-up concluído",
          description: followUp ? `${company.name} · ${followUp.type} a ${formatDateShort(followUp.date)}` : company.name,
          tone: "success",
          action: { label: "Anular", run: () => repositories().companies.scheduleFollowUp(company.id, previous ?? null) },
        },
  });
  return company;
}

export function registerCompanyContact(id: string, date: string, label: string) {
  void repositories().companies.registerContact(id, date, label);
}

export function useCreateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (company: Company) => repositories().companies.create(company),
    onSuccess: (company) => {
      useAutomationRunsStore.getState().emit("cliente-criado", company.id);
      invalidate(client);
      recordEvent({
        action: "criou o cliente",
        target: ref(company),
        companyId: company.id,
        sensitive: true,
        changes: [
          { field: "Gestor de conta", to: company.owner },
          { field: "Zona", to: company.zone },
        ],
        toast: {
          title: "Cliente criado",
          description: company.name,
          tone: "success",
          action: { label: "Abrir", run: () => useCompaniesStore.getState().openDetail(company.id) },
        },
      });
    },
  });
}

export function useUpdateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CompanyPatch; previous: Company }) => repositories().companies.update(id, patch),
    onSuccess: (company, { previous }) => {
      invalidate(client);
      const changes = diffRecord(previous, company, COMPANY_LABELS, COMPANY_FORMATTERS);
      if (changes.length === 0) return;
      if (stageOf(company) && stageOf(company) !== stageOf(previous)) {
        useAutomationRunsStore.getState().emit("cliente-muda-fase", company.id, { stage: stageOf(company) });
      }
      recordEvent({
        action: "atualizou o cliente",
        target: ref(company),
        companyId: company.id,
        sensitive: true,
        notify: false,
        changes,
        toast: {
          title: "Cliente atualizado",
          description: `${changes.length === 1 ? "1 campo alterado" : `${changes.length} campos alterados`} em ${company.name}.`,
          tone: "success",
          action: {
            label: "Anular",
            run: () =>
              repositories()
                .companies.restore([previous])
                .then(() => {
                  invalidate(client);
                  recordEvent({ action: "anulou a alteração do cliente", target: ref(previous), companyId: previous.id, notify: false });
                }),
          },
        },
      });
    },
  });
}

export function useUpdateManyCompanies() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: CompanyBulkPatch; snapshot: Company[] }) => repositories().companies.updateMany(ids, patch),
    onSuccess: (affected, { patch, snapshot }) => {
      invalidate(client);
      if (affected.length === 0) return;
      const field = patch.owner !== undefined ? "Gestor de conta" : "Zona";
      const value = patch.owner ?? patch.zone ?? "";
      const label = affected.length === 1 ? affected[0].name : `${affected.length} clientes`;
      recordEvent({
        action: patch.owner !== undefined ? "atribuiu um novo gestor a" : "mudou a zona de",
        target: { module: "Clientes", id: affected.length === 1 ? affected[0].id : undefined, label },
        sensitive: true,
        changes: [{ field, to: value }],
        toast: {
          title: `${label} atualizado${affected.length === 1 ? "" : "s"}`,
          description: `${field}: ${value}`,
          tone: "success",
          action: { label: "Anular", run: () => repositories().companies.restore(snapshot).then(() => invalidate(client)) },
        },
      });
    },
  });
}

export function useScheduleFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, followUp, previous, silent }: { id: string; followUp: FollowUp | null; previous?: FollowUp; silent?: boolean }) =>
      scheduleCompanyFollowUp(id, followUp, previous, silent),
    onSuccess: () => invalidate(client),
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, profile }: { id: string; profile: CompanyProfile; previous: Company }) => repositories().companies.updateProfile(id, profile),
    onSuccess: (company, { profile, previous }) => {
      invalidate(client);
      const before = previous.profile ?? EMPTY_PROFILE;
      const changes = (Object.keys(PROFILE_LABELS) as (keyof typeof PROFILE_LABELS)[])
        .filter((key) => before[key] !== profile[key])
        .map((key) => ({
          field: PROFILE_LABELS[key],
          from: key === "creditLimit" ? formatMoney(before.creditLimit) : String(before[key]) || undefined,
          to: key === "creditLimit" ? formatMoney(profile.creditLimit) : String(profile[key]) || "—",
        }));
      if (changes.length === 0) return;
      recordEvent({
        action: "atualizou os dados fiscais de",
        target: ref(company),
        companyId: company.id,
        sensitive: true,
        notify: false,
        changes,
        toast: {
          title: "Dados fiscais atualizados",
          description: `${changes.length === 1 ? "1 campo alterado" : `${changes.length} campos alterados`} em ${company.name}.`,
          tone: "success",
          action: { label: "Anular", run: () => repositories().companies.updateProfile(company.id, before).then(() => invalidate(client)) },
        },
      });
    },
  });
}

export function useArchiveCompanies() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { ids: string[]; snapshot: Company[] }) => repositories().companies.archive(ids),
    onSuccess: (_affected, { snapshot }) => {
      invalidate(client);
      if (snapshot.length === 0) return;
      const label = snapshot.length === 1 ? snapshot[0].name : `${snapshot.length} clientes`;
      recordEvent({
        action: "arquivou",
        target: { module: "Clientes", id: snapshot.length === 1 ? snapshot[0].id : undefined, label },
        sensitive: true,
        toast: {
          title: snapshot.length === 1 ? "Cliente arquivado" : "Clientes arquivados",
          description: `${label} ${snapshot.length === 1 ? "deixou" : "deixaram"} de aparecer na carteira.`,
          action: {
            label: "Anular",
            run: () =>
              repositories()
                .companies.restore(snapshot)
                .then(() => {
                  invalidate(client);
                  recordEvent({ action: "repôs", target: { module: "Clientes", label }, notify: false });
                }),
          },
        },
      });
    },
  });
}

export function useImportCompanies() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ created, updated }: { created: Company[]; updated: [string, CompanyProfile][]; snapshot: Company[] }) =>
      repositories().companies.importCompanies(created, updated),
    onSuccess: (_result, { created, snapshot }) => {
      invalidate(client);
      created.forEach((company) => useAutomationRunsStore.getState().emit("cliente-criado", company.id));
      void snapshot;
    },
  });
}
