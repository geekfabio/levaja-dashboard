"use client";

import AsyncState from "@/components/_common/async-state";
import Stars from "@/components/admin/shared/stars";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { errorMessage } from "@/data/leva-ja";
import { useSatisfaction } from "@/hooks/admin/use-support";
import { formatDateTimeNumeric, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

function percent(value: number | null) {
  return value === null ? "—" : formatPercent(value * 100);
}

export default function SatisfactionPanel() {
  const query = useSatisfaction();

  return (
    <AsyncState query={query} skeleton={<SummaryTiles tiles={null} />} errorDescription={errorMessage}>
      {(data) => (
        <div className="flex flex-col gap-4">
          <SummaryTiles
            tiles={[
              {
                label: "Respostas ao inquérito",
                value: data.responses,
                display: formatNumber(data.responses),
              },
              {
                label: "Nota média",
                value: data.average ?? 0,
                display: data.average === null ? "—" : `${formatDecimal(data.average, 1)} / 5`,
              },
              {
                label: "Utilizadores satisfeitos (4 ou 5)",
                value: Math.round((data.satisfiedRate ?? 0) * 100),
                display: percent(data.satisfiedRate),
              },
              {
                label: "Taxa de resposta",
                value: Math.round((data.responseRate ?? 0) * 100),
                display: percent(data.responseRate),
              },
            ]}
          />
          <section aria-label="Respostas recentes" className="border-border bg-card flex flex-col rounded-xl border">
            <h3 className="eyebrow-style text-faint px-4 pt-4 font-normal">Respostas recentes</h3>
            {data.recent.length === 0 ? (
              <p className="caption-style text-subtle p-4">Ainda não há respostas ao inquérito de satisfação.</p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {data.recent.map((item) => (
                  <li key={item.ticketId} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="lead-style font-medium">
                        {item.ticketCode} · {item.requesterName}
                      </span>
                      {item.comment ? <span className="caption-style text-soft max-w-[48em]">«{item.comment}»</span> : null}
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Stars rating={item.score} />
                      <span className="caption-style text-subtle tabular-nums">{formatDateTimeNumeric(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AsyncState>
  );
}
