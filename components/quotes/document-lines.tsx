"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { VAT_RATE } from "@/data/catalog";
import type { DocumentLine } from "@/data/quotes";
import { formatMoney, formatPercent } from "@/lib/format";
import { documentTotals, lineNet } from "@/lib/quotes";
import { useQuotesStore } from "@/stores/quotes-store";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

type DocumentLinesProps = {
  lines: DocumentLine[];
  listDiscount: number;
  editable?: boolean;
  onAdd?: (productId: string) => void;
  onChange?: (lineId: string, patch: Partial<Pick<DocumentLine, "quantity" | "discount">>) => void;
  onRemove?: (lineId: string) => void;
};

export function DocumentTotalsBlock({ lines, listDiscount }: { lines: DocumentLine[]; listDiscount: number }) {
  const totals = documentTotals(lines, listDiscount);
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "lead-style font-medium" : "caption-style text-soft"}>{label}</dt>
      <dd className={strong ? "lead-style font-medium tabular-nums" : "caption-style tabular-nums"}>{value}</dd>
    </div>
  );
  return (
    <dl className="ml-auto flex w-full max-w-[320px] flex-col gap-1.5">
      {row("Valor bruto", formatMoney(totals.gross))}
      {totals.discount > 0 && row(`Descontos (tabela ${formatPercent(listDiscount)} e linhas)`, `−${formatMoney(totals.discount)}`)}
      {row("Valor líquido", formatMoney(totals.net))}
      {row(`IVA ${VAT_RATE}%`, formatMoney(totals.vat))}
      {row("Total", formatMoney(totals.total), true)}
    </dl>
  );
}

export default function DocumentLines({ lines, listDiscount, editable = false, onAdd, onChange, onRemove }: DocumentLinesProps) {
  const catalog = useQuotesStore((state) => state.catalog);
  const available = catalog.filter((product) => product.active);

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="caption-style text-subtle rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
          Sem produtos. Adicione o primeiro a partir do catálogo.
        </p>
      ) : (
        <ul className="divide-border flex flex-col divide-y rounded-lg border border-line-strong">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="lead-style truncate">{line.name}</span>
                <span className="caption-style text-subtle tabular-nums">
                  {line.productId} · {formatMoney(line.unitPrice)} / {line.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {editable ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label={`Quantidade de ${line.name}`}
                      value={line.quantity}
                      onChange={(event) => onChange?.(line.id, { quantity: Number(event.target.value) || 1 })}
                      className="h-[30px] w-[72px] tabular-nums"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      inputMode="numeric"
                      aria-label={`Desconto em ${line.name} (%)`}
                      title="Desconto da linha (%)"
                      value={line.discount}
                      onChange={(event) => onChange?.(line.id, { discount: Number(event.target.value) || 0 })}
                      className="h-[30px] w-[60px] tabular-nums"
                    />
                    <span className="caption-style text-subtle">%</span>
                  </>
                ) : (
                  <span className="caption-style text-soft tabular-nums">
                    {line.quantity} {line.unit}
                    {line.discount > 0 && ` · −${formatPercent(line.discount)}`}
                  </span>
                )}
                <span className="lead-style w-[120px] text-right font-medium tabular-nums">
                  {formatMoney(lineNet(line, listDiscount))}
                </span>
                {editable && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remover ${line.name}`} onClick={() => onRemove?.(line.id)}>
                    <XIcon aria-hidden className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <Select value="" onValueChange={(value) => onAdd?.(value)}>
          <SelectTrigger aria-label="Adicionar produto" className="sm:max-w-[360px]">
            <SelectValue placeholder="Adicionar produto do catálogo…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name} · {formatMoney(product.price)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DocumentTotalsBlock lines={lines} listDiscount={listDiscount} />
    </div>
  );
}
