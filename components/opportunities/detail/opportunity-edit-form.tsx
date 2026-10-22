"use client";

import { useState, type FormEvent } from "react";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FormSection from "@/components/_common/form-section";
import { OWNERS } from "@/data/companies";
import type { Opportunity } from "@/data/opportunities";
import type { OpportunityPatch } from "@/stores/opportunities-store";

export type OpportunityDraft = {
  contactName: string;
  value: string;
  probability: string;
  expectedCloseDate: string;
  owner: string;
};

export const OPPORTUNITY_FORM_ID = "opportunity-edit-form";

export function opportunityToDraft(opportunity: Opportunity): OpportunityDraft {
  return {
    contactName: opportunity.contactName,
    value: String(opportunity.value),
    probability: String(opportunity.probability),
    expectedCloseDate: opportunity.expectedCloseDate,
    owner: opportunity.owner,
  };
}

export function opportunityDraftToPatch(draft: OpportunityDraft): OpportunityPatch {
  return {
    contactName: draft.contactName.trim(),
    value: Math.max(0, Math.round(Number(draft.value) || 0)),
    probability: Math.min(100, Math.max(0, Math.round(Number(draft.probability) || 0))),
    expectedCloseDate: draft.expectedCloseDate,
    owner: draft.owner,
  };
}

type OpportunityEditFormProps = {
  draft: OpportunityDraft;
  onChange: <K extends keyof OpportunityDraft>(key: K, value: OpportunityDraft[K]) => void;
  onSubmit: () => void;
};

export default function OpportunityEditForm({ draft, onChange, onSubmit }: OpportunityEditFormProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof OpportunityDraft, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.contactName.trim()) next.contactName = "Indique o nome do contacto.";
    if (!(Number(draft.value) > 0)) next.value = "O valor tem de ser maior do que zero.";
    if (!draft.expectedCloseDate) next.expectedCloseDate = "Indique a data prevista.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`opportunity-edit-${first}`)?.focus();
      return;
    }
    onSubmit();
  }

  function field<K extends keyof OpportunityDraft>(key: K, value: OpportunityDraft[K]) {
    setErrors((current) => ({ ...current, [key]: undefined }));
    onChange(key, value);
  }

  return (
    <form id={OPPORTUNITY_FORM_ID} onSubmit={handleSubmit} noValidate>
      <FormSection title="Editar oportunidade">
        <Field label="Contacto" htmlFor="opportunity-edit-contactName" required error={errors.contactName}>
          <Input
            id="opportunity-edit-contactName"
            value={draft.contactName}
            autoFocus
            aria-invalid={errors.contactName ? true : undefined}
            className="aria-invalid:border-danger"
            onChange={(event) => field("contactName", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (Kz)" htmlFor="opportunity-edit-value" required error={errors.value}>
            <Input
              id="opportunity-edit-value"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={draft.value}
              aria-invalid={errors.value ? true : undefined}
              className="aria-invalid:border-danger tabular-nums"
              onChange={(event) => field("value", event.target.value)}
            />
          </Field>
          <Field label="Probabilidade (%)" htmlFor="opportunity-edit-probability">
            <Input
              id="opportunity-edit-probability"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={draft.probability}
              className="tabular-nums"
              onChange={(event) => field("probability", event.target.value)}
            />
          </Field>
          <Field
            label="Data prevista de fecho"
            htmlFor="opportunity-edit-expectedCloseDate"
            required
            error={errors.expectedCloseDate}
          >
            <Input
              id="opportunity-edit-expectedCloseDate"
              type="date"
              value={draft.expectedCloseDate}
              aria-invalid={errors.expectedCloseDate ? true : undefined}
              className="aria-invalid:border-danger tabular-nums"
              onChange={(event) => field("expectedCloseDate", event.target.value)}
            />
          </Field>
          <Field label="Gestor" htmlFor="opportunity-edit-owner">
            <Select value={draft.owner} onValueChange={(value) => field("owner", value)}>
              <SelectTrigger id="opportunity-edit-owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNERS.map((owner) => (
                  <SelectItem key={owner.name} value={owner.name}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>
    </form>
  );
}
