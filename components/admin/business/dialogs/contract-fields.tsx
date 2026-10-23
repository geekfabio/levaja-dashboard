"use client";

import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { PAYMENT_TERMS } from "@/lib/leva-ja/commerce";

export type ContractDraft = { discount: string; terms: string; limit: string; startsAt: string; endsAt: string };

export function ContractFields({ draft, onChange, issueFor }: { draft: ContractDraft; onChange: (draft: ContractDraft) => void; issueFor: (field: string) => string | undefined }) {
  const set = (patch: Partial<ContractDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Desconto (%)" htmlFor="contract-discount" error={issueFor("discountRate")}>
        <Input id="contract-discount" inputMode="decimal" value={draft.discount} onChange={(event) => set({ discount: event.target.value })} className="tabular-nums" />
      </Field>
      <Field label="Prazo de pagamento" htmlFor="contract-terms" error={issueFor("paymentTermsDays")}>
        <Select value={draft.terms} onValueChange={(terms) => set({ terms })}>
          <SelectTrigger id="contract-terms">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_TERMS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                {days} dias
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Limite de crédito (Kz)" htmlFor="contract-limit" error={issueFor("creditLimit")}>
        <Input id="contract-limit" inputMode="numeric" value={draft.limit} onChange={(event) => set({ limit: event.target.value })} className="tabular-nums" />
      </Field>
      <span />
      <Field label="Início" htmlFor="contract-start">
        <Input id="contract-start" type="date" value={draft.startsAt} onChange={(event) => set({ startsAt: event.target.value })} />
      </Field>
      <Field label="Fim" htmlFor="contract-end" error={issueFor("endsAt")}>
        <Input id="contract-end" type="date" value={draft.endsAt} onChange={(event) => set({ endsAt: event.target.value })} />
      </Field>
    </div>
  );
}

export function contractFromDraft(draft: ContractDraft) {
  return {
    discountRate: Number(draft.discount.replace(",", ".")) / 100,
    paymentTermsDays: Number(draft.terms),
    creditLimit: Number(draft.limit.replace(/\s/g, "")),
    startsAt: draft.startsAt ? `${draft.startsAt}T00:00:00.000Z` : "",
    endsAt: draft.endsAt ? `${draft.endsAt}T00:00:00.000Z` : "",
  };
}

export function draftFromContract(contract: { discountRate: number; paymentTermsDays: number; creditLimit: number; startsAt: string; endsAt: string }): ContractDraft {
  return {
    discount: String(Math.round(contract.discountRate * 1000) / 10),
    terms: String(contract.paymentTermsDays),
    limit: String(contract.creditLimit),
    startsAt: contract.startsAt.slice(0, 10),
    endsAt: contract.endsAt.slice(0, 10),
  };
}
