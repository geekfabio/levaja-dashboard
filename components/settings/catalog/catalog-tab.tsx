"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { CATALOG_CATEGORIES, VAT_RATE, type CatalogCategory, type Product } from "@/data/catalog";
import { SEGMENTS } from "@/data/companies";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuotesStore } from "@/stores/quotes-store";
import SettingsPanel from "../settings-panel";

const PREFIXES: Record<CatalogCategory, string> = {
  Mercearia: "MER",
  Bebidas: "BEB",
  "Óleos e gorduras": "OLE",
  "Arroz e massas": "ARR",
  Laticínios: "LAT",
  Congelados: "CON",
  "Higiene e limpeza": "HIG",
};

type Draft = { name: string; category: CatalogCategory; unit: string; price: string };

const EMPTY: Draft = { name: "", category: "Mercearia", unit: "", price: "" };

function PriceInput({ product }: { product: Product }) {
  const saveProduct = useQuotesStore((state) => state.saveProduct);
  const [value, setValue] = useState(String(product.price));
  const commit = () => {
    const price = Math.round(Number(value));
    if (!Number.isFinite(price) || price <= 0) {
      setValue(String(product.price));
      return;
    }
    if (price !== product.price) saveProduct({ ...product, price });
  };
  return (
    <Input
      type="number"
      min={1}
      inputMode="numeric"
      aria-label={`Preço de ${product.name} (Kz)`}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      className="h-[30px] w-[120px] tabular-nums"
    />
  );
}

export default function CatalogTab() {
  const catalog = useQuotesStore((state) => state.catalog);
  const discounts = useQuotesStore((state) => state.discounts);
  const saveProduct = useQuotesStore((state) => state.saveProduct);
  const setDiscount = useQuotesStore((state) => state.setDiscount);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const price = Math.round(Number(draft.price));
    const found = {
      name: draft.name.trim() ? undefined : "Indique o nome.",
      unit: draft.unit.trim() ? undefined : "Indique a unidade.",
      price: Number.isFinite(price) && price > 0 ? undefined : "Preço inválido.",
    };
    if (found.name || found.unit || found.price) {
      setErrors(found);
      return;
    }
    const prefix = PREFIXES[draft.category];
    const count = catalog.filter((product) => product.id.startsWith(prefix)).length;
    saveProduct({
      id: `${prefix}-${String(count + 1).padStart(3, "0")}`,
      name: draft.name.trim(),
      category: draft.category,
      unit: draft.unit.trim(),
      price,
      active: true,
    });
    setDraft(null);
    setErrors({});
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel
        title="Tabela de preços por segmento"
        description={`Desconto aplicado ao preço base nas cotações novas de cada segmento. Os preços do catálogo não incluem IVA (${VAT_RATE}%).`}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {SEGMENTS.map((segment) => (
            <Field key={segment} label={`${segment} (%)`} htmlFor={`discount-${segment}`}>
              <Input
                id={`discount-${segment}`}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={discounts[segment]}
                onChange={(event) => setDiscount(segment, Number(event.target.value) || 0)}
                className="tabular-nums"
              />
            </Field>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel
        title={`Catálogo · ${catalog.length} produtos`}
        description="Produtos disponíveis nas cotações. O stock e a faturação continuam no sistema de vendas."
        actions={
          !draft && (
            <Button variant="secondary" size="sm" onClick={() => setDraft(EMPTY)}>
              Novo produto
            </Button>
          )
        }
      >
        {draft && (
          <form onSubmit={add} noValidate className="border-line-strong flex flex-col gap-3 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Nome" htmlFor="product-name" required error={errors.name}>
                <Input id="product-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </Field>
              <Field label="Categoria" htmlFor="product-category">
                <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as CatalogCategory })}>
                  <SelectTrigger id="product-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOG_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unidade" htmlFor="product-unit" required error={errors.unit}>
                <Input id="product-unit" placeholder="saco, caixa…" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
              </Field>
              <Field label="Preço base (Kz)" htmlFor="product-price" required error={errors.price}>
                <Input id="product-price" type="number" min={1} inputMode="numeric" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="tabular-nums" />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="subtle" size="sm" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Adicionar ao catálogo
              </Button>
            </div>
          </form>
        )}
        <ul className="divide-border flex flex-col divide-y">
          {catalog.map((product) => (
            <li key={product.id} className={cn("flex flex-wrap items-center gap-3 py-2.5", !product.active && "opacity-60")}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="lead-style truncate">{product.name}</span>
                <span className="caption-style text-subtle tabular-nums">
                  {product.id} · {product.category} · por {product.unit} · {formatMoney(product.price)}
                </span>
              </div>
              <PriceInput key={product.price} product={product} />
              <label className="caption-style text-soft flex items-center gap-2">
                <Checkbox
                  checked={product.active}
                  onCheckedChange={(checked) => saveProduct({ ...product, active: checked === true })}
                  aria-label={`${product.name} disponível nas cotações`}
                />
                Disponível
              </label>
            </li>
          ))}
        </ul>
      </SettingsPanel>
    </div>
  );
}
