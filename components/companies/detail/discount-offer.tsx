"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import { DISCOUNT_SCOPES, MAX_DISCOUNT_PERCENT, type DiscountScope } from "@/data/automations";
import { OFFER_STATUS_TONES } from "@/data/discount-offers";
import { useToday } from "@/hooks/use-today";
import { isOfferOpen, offerScopeLabel, offerStatus } from "@/lib/automation-engine";
import { formatDateShort, formatMoney, formatPercent } from "@/lib/format";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";

export default function DiscountOffer({ companyId }: { companyId: string }) {
  const offers = useAutomationRunsStore((state) => state.offers);
  const createOffer = useAutomationRunsStore((state) => state.createOffer);
  const setOfferStatus = useAutomationRunsStore((state) => state.setOfferStatus);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [percent, setPercent] = useState(5);
  const [validDays, setValidDays] = useState(14);
  const [scope, setScope] = useState<DiscountScope>("Categorias habituais");

  const latest = offers.find((offer) => offer.companyId === companyId && offer.status !== "Substituída");
  const open = latest && isOfferOpen(latest, today);
  const percentError = percent < 1 || percent > MAX_DISCOUNT_PERCENT ? `Entre 1 e ${MAX_DISCOUNT_PERCENT}.` : undefined;
  const validError = validDays < 1 ? "Mínimo 1 dia." : undefined;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (percentError || validError) return;
    createOffer({ companyId, percent, scope, validDays }, today);
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save} noValidate className="border-line-strong flex flex-col gap-3 rounded-lg border p-3">
        <span className="lead-style font-medium">Propor desconto</span>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Desconto (%)" htmlFor="offer-percent" error={percentError}>
            <Input
              id="offer-percent"
              type="number"
              min={1}
              max={MAX_DISCOUNT_PERCENT}
              inputMode="numeric"
              autoFocus
              value={percent}
              onChange={(event) => setPercent(Number(event.target.value) || 0)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Válido (dias)" htmlFor="offer-valid" error={validError}>
            <Input
              id="offer-valid"
              type="number"
              min={1}
              inputMode="numeric"
              value={validDays}
              onChange={(event) => setValidDays(Number(event.target.value) || 0)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Aplica-se a" htmlFor="offer-scope">
            <Select value={scope} onValueChange={(value) => setScope(value as DiscountScope)}>
              <SelectTrigger id="offer-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_SCOPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="subtle" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Criar proposta
          </Button>
        </div>
      </form>
    );
  }

  if (!latest) {
    return (
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setEditing(true)}>
        Propor desconto
      </Button>
    );
  }

  const status = offerStatus(latest, today);

  return (
    <div className="border-line-strong flex flex-col gap-2 rounded-lg border p-3">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone={OFFER_STATUS_TONES[status]} size="sm">
          {status}
        </Tag>
        <span className="lead-style font-medium">
          Desconto de {formatPercent(latest.percent)} {offerScopeLabel(latest)}
        </span>
      </span>
      <span className="caption-style text-subtle">
        {latest.origin} · válido até {formatDateShort(latest.validUntil)}
        {status === "Aproveitada" &&
          ` · ${latest.saleDocument}, ${formatMoney(latest.discountValue ?? 0)} de desconto em ${formatMoney(latest.saleTotal ?? 0)}`}
      </span>
      <div className="flex flex-wrap gap-1">
        {open && latest.status === "Por apresentar" && (
          <Button variant="secondary" size="sm" onClick={() => setOfferStatus(latest.id, "Apresentada")}>
            Apresentada ao cliente
          </Button>
        )}
        {open && (
          <Button variant="ghost" size="sm" onClick={() => setOfferStatus(latest.id, "Recusada")}>
            Cliente recusou
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {open ? "Substituir proposta" : "Nova proposta"}
        </Button>
      </div>
    </div>
  );
}
