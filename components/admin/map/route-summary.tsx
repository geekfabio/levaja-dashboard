"use client";

import Skeleton from "@/components/_ui/skeleton";
import type { RouteResult } from "@/data/leva-ja";
import { formatKm, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RouteSummaryLeg = {
  id: string;
  label: string;
  dashed?: boolean;
  route: RouteResult | undefined;
  loading: boolean;
  stops?: string[];
};

function LegLine({ dashed }: { dashed?: boolean }) {
  return <span aria-hidden className={cn("mt-1.5 w-4 shrink-0 border-t-[3px]", dashed ? "border-brand border-dotted" : "border-info")} />;
}

function Figures({ route }: { route: RouteResult }) {
  return (
    <span className="tabular-nums">
      {formatKm(route.distanceKm)} · {formatMinutes(route.durationMin)}
    </span>
  );
}

export default function RouteSummary({ legs, className }: { legs: RouteSummaryLeg[]; className?: string }) {
  const ready = legs.filter((leg) => leg.route);
  const loading = legs.some((leg) => leg.loading && !leg.route);
  const estimated = ready.some((leg) => leg.route?.source === "estimate");
  const totalKm = ready.reduce((sum, leg) => sum + (leg.route?.distanceKm ?? 0), 0);
  const totalMin = ready.reduce((sum, leg) => sum + (leg.route?.durationMin ?? 0), 0);

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-live="polite" aria-busy={loading}>
      <ul className="flex flex-col gap-2">
        {legs.map((leg) => (
          <li key={leg.id} className="flex flex-col gap-1">
            <span className="caption-style flex items-start gap-2">
              <LegLine dashed={leg.dashed} />
              <span className="text-soft min-w-0 flex-1">{leg.label}</span>
              {leg.route ? <Figures route={leg.route} /> : <Skeleton className="h-3.5 w-24" />}
            </span>
            {leg.route && leg.stops && leg.route.legs.length > 1 && (
              <ol className="caption-style text-subtle flex flex-col gap-0.5 pl-6">
                {leg.route.legs.map((part, index) => (
                  <li key={index} className="flex justify-between gap-2 tabular-nums">
                    <span className="min-w-0 truncate">
                      {leg.stops?.[index]} → {leg.stops?.[index + 1]}
                    </span>
                    <span>
                      {formatKm(part.distanceKm)} · {formatMinutes(part.durationMin)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
      {legs.length > 1 && ready.length === legs.length && (
        <p className="caption-style flex justify-between gap-2 font-medium tabular-nums">
          <span>Total</span>
          <span>
            {formatKm(totalKm)} · {formatMinutes(totalMin)}
          </span>
        </p>
      )}
      {ready.length > 0 && (
        <p className="caption-style text-subtle">
          {estimated
            ? "Estimativa: o serviço de rotas não respondeu, por isso a distância foi calculada em linha recta com margem para as estradas."
            : "Distância e duração pelas estradas do OpenStreetMap, ajustadas ao tipo de viatura."}
        </p>
      )}
    </div>
  );
}
