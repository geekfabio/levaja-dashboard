"use client";

import { useMemo, useState } from "react";
import Button from "@/components/_ui/button";
import FilterMenu from "@/components/_common/filter-menu";
import AtRiskList from "@/components/_common/at-risk-list";
import { ACTIVITY_WINDOWS, type Company } from "@/data/companies";
import { atRiskClients, atRiskCsvRows } from "@/lib/reports";
import { downloadCsv } from "@/lib/csv";
import { TODAY } from "@/lib/companies";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

type AtRiskPanelProps = {
  companies: Company[];
};

const WINDOW_OPTIONS = ACTIVITY_WINDOWS.map((days) => ({
  value: String(days),
  label: `Mais de ${days} dias`,
}));

export default function AtRiskPanel({ companies }: AtRiskPanelProps) {
  const [window_, setWindow] = useState(String(ACTIVITY_WINDOWS[1]));

  const clients = useMemo(
    () => atRiskClients(companies, Number(window_)),
    [companies, window_],
  );

  function exportCsv() {
    downloadCsv(`clientes-em-risco-${TODAY}.csv`, atRiskCsvRows(clients));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterMenu
          label="Sem atividade"
          value={window_}
          options={WINDOW_OPTIONS}
          onChange={setWindow}
        />
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <ShareIcon aria-hidden className="size-3" />
          Exportar
        </Button>
      </div>

      <AtRiskList clients={clients} />
    </div>
  );
}
