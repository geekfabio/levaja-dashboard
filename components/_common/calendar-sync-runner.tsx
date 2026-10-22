"use client";

import { useEffect } from "react";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";
import { useCompaniesStore } from "@/stores/companies-store";

export default function CalendarSyncRunner() {
  const companies = useCompaniesStore((state) => state.companies);
  const tasks = useActivitiesStore((state) => state.tasks);
  const connected = useCalendarSyncStore((state) => Object.keys(state.connections).length > 0);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setTimeout(() => useCalendarSyncStore.getState().syncAll(), 600);
    return () => window.clearTimeout(timer);
  }, [connected, companies, tasks]);

  return null;
}
