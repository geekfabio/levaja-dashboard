import { create } from "zustand";
import { COMPANIES, EMPTY_PROFILE, type Company, type CompanyProfile, type SortKey } from "@/data/companies";
import { COMPANY_PROFILES } from "@/data/company-profiles";
import { FOLLOW_UPS } from "@/data/follow-ups";
import { DEFAULT_FILTERS, type CompanyFilters } from "@/lib/companies";

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

export function companyProfile(company: Company): CompanyProfile {
  return company.profile ?? EMPTY_PROFILE;
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
};

export const useCompaniesStore = create<CompaniesState>((set) => ({
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
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((selected) => selected !== id) : [...state.selectedIds, id],
    })),
  setSelected: (selectedIds) => set({ selectedIds }),
  openDetail: (detailId) => set({ detailId, detailOpen: true, profileOpen: false }),
  closeDetail: () => set({ detailOpen: false }),
  openProfile: (profileName) => set({ profileName, profileOpen: true, detailOpen: false }),
  closeProfile: () => set({ profileOpen: false }),
  setNewCompanyOpen: (newCompanyOpen) => set({ newCompanyOpen }),
}));
