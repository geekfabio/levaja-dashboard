"use client";

import { useMemo } from "react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import DetailSection from "@/components/_common/detail-section";
import { useToday } from "@/hooks/use-today";
import { followUpDueLabel } from "@/lib/follow-up";
import { formatTime } from "@/lib/format";
import { CHECK_IN_RADIUS_M, formatDistance, mapsDirectionsUrl } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useFieldStore } from "@/stores/field-store";

export default function PlannedVisits() {
  const companies = useCompaniesStore((state) => state.companies);
  const tasks = useActivitiesStore((state) => state.tasks);
  const activities = useActivitiesStore((state) => state.activities);
  const startActivity = useActivitiesStore((state) => state.startActivity);
  const checkIns = useFieldStore((state) => state.checkIns);
  const locating = useFieldStore((state) => state.locating);
  const checkIn = useFieldStore((state) => state.checkIn);
  const today = useToday();

  const stops = useMemo(() => {
    const fromFollowUps = companies
      .filter(
        (company) =>
          !company.archived &&
          company.nextFollowUp &&
          (company.nextFollowUp.type === "Visita" || company.nextFollowUp.type === "Reunião") &&
          company.nextFollowUp.date <= today,
      )
      .map((company) => ({ company, reason: company.nextFollowUp!.note || company.nextFollowUp!.type, due: company.nextFollowUp!.date }));
    const fromTasks = tasks
      .filter((task) => task.status !== "Feita" && task.dueDate === today && task.companyId)
      .map((task) => ({ company: companies.find((item) => item.id === task.companyId), reason: task.title, due: task.dueDate }))
      .filter((stop): stop is { company: NonNullable<typeof stop.company>; reason: string; due: string } => Boolean(stop.company));
    const seen = new Set<string>();
    return [...fromFollowUps, ...fromTasks]
      .filter((stop) => (seen.has(stop.company.id) ? false : (seen.add(stop.company.id), true)))
      .sort((a, b) => a.company.zone.localeCompare(b.company.zone) || (a.company.profile?.municipality ?? "").localeCompare(b.company.profile?.municipality ?? ""));
  }, [companies, tasks, today]);

  const visitedToday = new Set(
    activities.filter((activity) => activity.date === today && activity.type === "Visita").map((activity) => activity.companyId),
  );

  return (
    <DetailSection title={`Visitas planeadas · ${stops.length}`}>
      {stops.length === 0 ? (
        <p className="caption-style text-subtle">
          Sem visitas agendadas para hoje. Agende-as em Follow-up ou na ficha do cliente.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {stops.map(({ company, reason, due }, index) => {
            const check = checkIns[company.id]?.at.slice(0, 10) === today ? checkIns[company.id] : undefined;
            const far = check?.distance !== undefined && check.distance > CHECK_IN_RADIUS_M;
            const done = visitedToday.has(company.id);
            return (
              <li key={company.id} className="border-line-strong flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <span className="caption-style bg-muted text-soft flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="lead-style font-medium">{company.name}</span>
                      {done ? (
                        <Tag tone="green" size="sm">Visitado</Tag>
                      ) : due < today ? (
                        <Tag tone="red" size="sm">{followUpDueLabel(due, today)}</Tag>
                      ) : null}
                    </span>
                    <span className="caption-style text-subtle">
                      {[company.profile?.address, company.profile?.municipality, company.zone].filter(Boolean).join(", ")}
                    </span>
                    <span className="caption-style text-soft">{reason}</span>
                    {check && (
                      <span className={cn("caption-style", far ? "text-(--tag-amber-text)" : "text-(--tag-green-text)")}>
                        Check-in às {formatTime(check.at)}
                        {check.distance !== undefined && ` · a ${formatDistance(check.distance)} da morada`}
                        {` · precisão ${formatDistance(check.accuracy)}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pl-9">
                  {!check && (
                    <Button variant="secondary" size="sm" disabled={locating === company.id} onClick={() => checkIn(company.id)}>
                      {locating === company.id ? "A localizar…" : "Check-in"}
                    </Button>
                  )}
                  <Button
                    variant={check ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => startActivity({ companyId: company.id, type: "Visita", followUpNote: reason })}
                  >
                    Registar visita
                  </Button>
                  {company.profile?.geo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(mapsDirectionsUrl(company.profile!.geo!), "_blank", "noopener,noreferrer")}
                    >
                      Itinerário
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DetailSection>
  );
}
