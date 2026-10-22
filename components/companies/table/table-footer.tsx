"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import type { Company } from "@/data/companies";
import { companyTotals } from "@/lib/companies";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

type TableFooterProps = {
  companies: Company[];
  selectedCount: number;
};

const EXTRA_CALCULATIONS = [
  { key: "weighted", label: "Carteira ponderada" },
  { key: "deals", label: "Oportunidades abertas" },
  { key: "inactive", label: "Sem contacto há +30 dias" },
] as const;

type ExtraKey = (typeof EXTRA_CALCULATIONS)[number]["key"];

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="outline-border flex min-w-0 items-center gap-2 p-3 outline-1">
      <span className="text-foreground truncate tabular-nums">{value}</span>
      <span className="text-muted-foreground truncate">{label}</span>
    </div>
  );
}

export default function TableFooter({ companies, selectedCount }: TableFooterProps) {
  const [extra, setExtra] = useState<ExtraKey>("weighted");
  const totals = companyTotals(companies);
  const scope = selectedCount > 0 ? "selecionados" : "visíveis";
  const extraValue = {
    weighted: formatMoney(totals.weighted),
    deals: formatNumber(totals.deals),
    inactive: formatNumber(totals.inactive),
  }[extra];
  const extraLabel = EXTRA_CALCULATIONS.find((item) => item.key === extra)!.label;

  return (
    <div
      aria-live="polite"
      className="caption-style border-border bg-background grid shrink-0 grid-cols-2 gap-px border-b p-px sm:grid-cols-4"
    >
      <Cell value={formatNumber(companies.length)} label={`Clientes ${scope}`} />
      <Cell value={formatMoney(totals.pipeline)} label="em carteira" />
      <Cell value={formatPercent(totals.probability)} label="probabilidade média" />
      <div className="outline-border flex min-w-0 items-center gap-2 p-1.5 pl-3 outline-1">
        <span className="text-foreground truncate tabular-nums">{extraValue}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="min-w-0 gap-1 font-normal">
              <span className="truncate">{extraLabel.toLowerCase()}</span>
              <ChevronIcon aria-hidden className="size-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Cálculo</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={extra} onValueChange={(value) => setExtra(value as ExtraKey)}>
              {EXTRA_CALCULATIONS.map((item) => (
                <DropdownMenuRadioItem key={item.key} value={item.key}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
