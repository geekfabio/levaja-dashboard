"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { filterCompanies, type CompanyFilters } from "@/lib/companies";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";

export function useCompanyFilters(): CompanyFilters {
  return useCompaniesStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      owner: state.owner,
      stage: state.stage,
      activityWindow: state.activityWindow,
      zone: state.zone,
      team: state.team,
    })),
  );
}

export function useVisibleCompanies() {
  const companies = useCompaniesStore((state) => state.companies);
  const memberships = useSettingsStore((state) => state.memberships);
  const filters = useCompanyFilters();
  return useMemo(
    () => filterCompanies(companies, filters, memberships),
    [companies, filters, memberships],
  );
}
