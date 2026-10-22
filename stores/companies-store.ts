import { create } from "zustand";
import { COMPANIES, EMPTY_PROFILE, STAGES, type Company, type CompanyProfile, type SortKey } from "@/data/companies";
import { COMPANY_PROFILES } from "@/data/company-profiles";
import { FOLLOW_UPS, type FollowUp } from "@/data/follow-ups";
import { diffRecord } from "@/lib/audit";
import { DEFAULT_FILTERS, type CompanyFilters } from "@/lib/companies";
import { formatDateShort, formatMoney, formatPercent, nowLuandaLocal } from "@/lib/format";
import { recordEvent } from "./audit-store";
import { useSalesStore } from "./sales-store";
import { useAutomationRunsStore } from "./automation-runs-store";

export type CompanyPatch = Partial<
  Pick<Company, "name" | "owner" | "zone" | "tags" | "pipelineValue" | "openDeals" | "winProbability">
>;

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

export function companyProfile(company: Company): CompanyProfile {
  return company.profile ?? EMPTY_PROFILE;
}

function syncIdentifiers(entries: [string, CompanyProfile][]) {
  useSalesStore.setState((state) => {
    const identifiers = { ...state.identifiers };
    for (const [id, profile] of entries) {
      identifiers[id] = { card: profile.card, nif: profile.nif, phone: profile.phone };
    }
    return { identifiers };
  });
}

export type CompaniesView = "lista" | "grelha";

const VIEW_STORAGE_KEY = "clientes-vista";

export function readStoredView(): CompaniesView | null {
  try {
    const value = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return value === "lista" || value === "grelha" ? value : null;
  } catch {
    return null;
  }
}

type CompaniesState = CompanyFilters & {
  companies: Company[];
  view: CompaniesView;
  setView: (view: CompaniesView) => void;
  selectedIds: string[];
  detailId: string | null;
  detailOpen: boolean;
  profileName: string | null;
  profileOpen: boolean;
  newCompanyOpen: boolean;
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
  setSortBy: (sortBy: SortKey) => void;
  setOwner: (owner: string) => void;
  setStage: (stage: string) => void;
  setActivityWindow: (days: number) => void;
  setZone: (zone: string) => void;
  setTeam: (team: string) => void;
  applyView: (filters: Partial<CompanyFilters>) => void;
  resetFilters: () => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  openProfile: (name: string) => void;
  closeProfile: () => void;
  setNewCompanyOpen: (open: boolean) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, patch: CompanyPatch) => void;
  updateMany: (ids: string[], patch: Pick<CompanyPatch, "owner" | "zone">) => void;
  archiveCompanies: (ids: string[]) => void;
  scheduleFollowUp: (id: string, followUp: FollowUp | null, options?: { silent?: boolean }) => void;
  registerContact: (id: string, date: string, label: string) => void;
  updateProfile: (id: string, profile: CompanyProfile) => void;
  importCompanies: (created: Company[], updated: [string, CompanyProfile][]) => () => void;
};

export const useCompaniesStore = create<CompaniesState>((set, get) => {
  function restore(snapshot: Company[]) {
    set((state) => ({
      companies: state.companies.map(
        (company) => snapshot.find((item) => item.id === company.id) ?? company,
      ),
    }));
  }

  return {
    companies: COMPANIES.map((company) => ({
      ...company,
      nextFollowUp: FOLLOW_UPS[company.id],
      profile: COMPANY_PROFILES[company.id],
    })),
    view: "lista",
    setView: (view) => {
      set({ view });
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {}
    },
    ...DEFAULT_FILTERS,
    selectedIds: [],
    detailId: null,
    detailOpen: false,
    profileName: null,
    profileOpen: false,
    newCompanyOpen: false,
    importOpen: false,
    setImportOpen: (importOpen) => set({ importOpen }),
    setSortBy: (sortBy) => set({ sortBy }),
    setOwner: (owner) => set({ owner }),
    setStage: (stage) => set({ stage }),
    setActivityWindow: (activityWindow) => set({ activityWindow }),
    setZone: (zone) => set({ zone }),
    setTeam: (team) => set({ team }),
    applyView: (filters) => set({ ...DEFAULT_FILTERS, ...filters, selectedIds: [] }),
    resetFilters: () => set({ ...DEFAULT_FILTERS }),
    toggleSelected: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selected) => selected !== id)
          : [...state.selectedIds, id],
      })),
    setSelected: (selectedIds) => set({ selectedIds }),
    openDetail: (detailId) =>
      set({ detailId, detailOpen: true, profileOpen: false }),
    closeDetail: () => set({ detailOpen: false }),
    openProfile: (profileName) =>
      set({ profileName, profileOpen: true, detailOpen: false }),
    closeProfile: () => set({ profileOpen: false }),
    setNewCompanyOpen: (newCompanyOpen) => set({ newCompanyOpen }),

    addCompany: (company) => {
      useAutomationRunsStore.getState().emit("cliente-criado", company.id);
      set((state) => ({
        companies: [company, ...state.companies],
        newCompanyOpen: false,
      }));
      recordEvent({
        action: "criou o cliente",
        target: { module: "Clientes", id: company.id, label: company.name },
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
          action: { label: "Abrir", run: () => get().openDetail(company.id) },
        },
      });
    },

    updateCompany: (id, patch) => {
      const previous = get().companies.find((company) => company.id === id);
      if (!previous) return;
      const next = { ...previous, ...patch };
      const changes = diffRecord(previous, next, COMPANY_LABELS, COMPANY_FORMATTERS);
      if (changes.length === 0) return;
      set((state) => ({
        companies: state.companies.map((company) => (company.id === id ? next : company)),
      }));
      const stageOf = (company: Company) => company.tags.find((tag) => (STAGES as readonly string[]).includes(tag));
      if (stageOf(next) && stageOf(next) !== stageOf(previous)) {
        useAutomationRunsStore.getState().emit("cliente-muda-fase", id, { stage: stageOf(next) });
      }
      recordEvent({
        action: "atualizou o cliente",
        target: { module: "Clientes", id, label: next.name },
        companyId: id,
        sensitive: true,
        notify: false,
        changes,
        toast: {
          title: "Cliente atualizado",
          description: `${changes.length === 1 ? "1 campo alterado" : `${changes.length} campos alterados`} em ${next.name}.`,
          tone: "success",
          action: {
            label: "Anular",
            run: () => {
              restore([previous]);
              recordEvent({
                action: "anulou a alteração do cliente",
                target: { module: "Clientes", id, label: previous.name },
                companyId: id,
                notify: false,
              });
            },
          },
        },
      });
    },

    updateMany: (ids, patch) => {
      const snapshot = get().companies.filter((company) => ids.includes(company.id));
      const affected = snapshot.filter((company) =>
        (Object.keys(patch) as (keyof typeof patch)[]).some((key) => company[key] !== patch[key]),
      );
      if (affected.length === 0) return;
      set((state) => ({
        companies: state.companies.map((company) =>
          ids.includes(company.id) ? { ...company, ...patch } : company,
        ),
      }));
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
          action: { label: "Anular", run: () => restore(snapshot) },
        },
      });
    },

    scheduleFollowUp: (id, followUp, options = {}) => {
      const company = get().companies.find((item) => item.id === id);
      if (!company) return;
      const previous = company.nextFollowUp;
      set((state) => ({
        companies: state.companies.map((item) => (item.id === id ? { ...item, nextFollowUp: followUp ?? undefined } : item)),
      }));
      recordEvent({
        action: followUp ? (previous ? "reagendou o próximo contacto de" : "agendou o próximo contacto de") : "concluiu o follow-up de",
        target: { module: "Clientes", id, label: company.name },
        companyId: id,
        notify: false,
        changes: [
          {
            field: "Próximo contacto",
            from: previous ? `${previous.type} · ${formatDateShort(previous.date)}` : undefined,
            to: followUp ? `${followUp.type} · ${formatDateShort(followUp.date)}` : "—",
          },
        ],
        toast: options.silent
          ? undefined
          : {
              title: followUp ? "Próximo contacto agendado" : "Follow-up concluído",
              description: followUp ? `${company.name} · ${followUp.type} a ${formatDateShort(followUp.date)}` : company.name,
              tone: "success",
              action: {
                label: "Anular",
                run: () =>
                  set((state) => ({
                    companies: state.companies.map((item) => (item.id === id ? { ...item, nextFollowUp: previous } : item)),
                  })),
              },
            },
      });
    },

    updateProfile: (id, profile) => {
      const company = get().companies.find((item) => item.id === id);
      if (!company) return;
      const previous = companyProfile(company);
      const changes = (Object.keys(PROFILE_LABELS) as (keyof typeof PROFILE_LABELS)[])
        .filter((key) => previous[key] !== profile[key])
        .map((key) => ({
          field: PROFILE_LABELS[key],
          from: key === "creditLimit" ? formatMoney(previous.creditLimit) : String(previous[key]) || undefined,
          to: key === "creditLimit" ? formatMoney(profile.creditLimit) : String(profile[key]) || "—",
        }));
      if (changes.length === 0) return;
      const apply = (next: CompanyProfile) => {
        set((state) => ({
          companies: state.companies.map((item) => (item.id === id ? { ...item, profile: next } : item)),
        }));
        syncIdentifiers([[id, next]]);
      };
      apply(profile);
      recordEvent({
        action: "atualizou os dados fiscais de",
        target: { module: "Clientes", id, label: company.name },
        companyId: id,
        sensitive: true,
        notify: false,
        changes,
        toast: {
          title: "Dados fiscais atualizados",
          description: `${changes.length === 1 ? "1 campo alterado" : `${changes.length} campos alterados`} em ${company.name}.`,
          tone: "success",
          action: { label: "Anular", run: () => apply(previous) },
        },
      });
    },

    importCompanies: (created, updated) => {
      const before = get().companies;
      created.forEach((company) => useAutomationRunsStore.getState().emit("cliente-criado", company.id));
      const updates = new Map(updated);
      set((state) => ({
        companies: [
          ...created,
          ...state.companies.map((company) => {
            const profile = updates.get(company.id);
            return profile ? { ...company, profile } : company;
          }),
        ],
      }));
      syncIdentifiers([
        ...created.filter((company) => company.profile).map((company) => [company.id, company.profile!] as [string, CompanyProfile]),
        ...updated,
      ]);
      return () => {
        set({ companies: before });
        syncIdentifiers(before.filter((company) => company.profile).map((company) => [company.id, company.profile!]));
      };
    },

    registerContact: (id, date, label) =>
      set((state) => ({
        companies: state.companies.map((company) => {
          if (company.id !== id || date < company.lastInteraction.date) return company;
          const today = nowLuandaLocal().slice(0, 10);
          const days = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000));
          return { ...company, lastInteraction: { date, label }, activityDays: days };
        }),
      })),

    archiveCompanies: (ids) => {
      const snapshot = get().companies.filter((company) => ids.includes(company.id) && !company.archived);
      if (snapshot.length === 0) return;
      set((state) => ({
        companies: state.companies.map((company) =>
          ids.includes(company.id) ? { ...company, archived: true } : company,
        ),
        selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
        detailOpen: ids.includes(state.detailId ?? "") ? false : state.detailOpen,
      }));
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
            run: () => {
              restore(snapshot);
              recordEvent({
                action: "repôs",
                target: { module: "Clientes", label },
                notify: false,
              });
            },
          },
        },
      });
    },
  };
});
