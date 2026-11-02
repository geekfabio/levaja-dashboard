"use client";

import { useMemo } from "react";
import { useToday } from "@/hooks/use-today";
import { buildFollowUps } from "@/lib/follow-up";
import { useActivitiesStore } from "@/stores/activities-store";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useOpportunities } from "@/hooks/crm/use-opportunities";

export function useFollowUps() {
  const companies = useCompaniesStore((state) => state.companies);
  const tasks = useActivitiesStore((state) => state.tasks);
  const { data: opportunities = [] } = useOpportunities();
  const offers = useAutomationRunsStore((state) => state.offers);
  const today = useToday();

  const items = useMemo(
    () => buildFollowUps({ companies, tasks, opportunities, offers, today }),
    [companies, tasks, opportunities, offers, today],
  );

  return { items, today };
}
