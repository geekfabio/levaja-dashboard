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
import {
  OWNERS,
  SEGMENTS,
  STAGES,
  type Company,
  type Segment,
  type Stage,
} from "@/data/companies";
import { useSettingsStore } from "@/stores/settings-store";

export type CompanyDraft = {
  name: string;
  segment: Segment;
  stage: Stage;
  owner: string;
  zone: string;
  pipelineValue: string;
  openDeals: string;
  winProbability: string;
};

export const COMPANY_FORM_ID = "company-edit-form";

export function companyToDraft(company: Company): CompanyDraft {
  return {
    name: company.name,
    segment: (company.tags.find((tag) => (SEGMENTS as readonly string[]).includes(tag)) as Segment) ?? SEGMENTS[0],
    stage: (company.tags.find((tag) => (STAGES as readonly string[]).includes(tag)) as Stage) ?? STAGES[0],
    owner: company.owner,
    zone: company.zone,
    pipelineValue: String(company.pipelineValue),
    openDeals: String(company.openDeals),
    winProbability: String(company.winProbability),
  };
}

export function draftToPatch(company: Company, draft: CompanyDraft) {
  let segmentPlaced = false;
  let stagePlaced = false;
  const tags: Company["tags"] = company.tags.map((tag) => {
    if (!segmentPlaced && (SEGMENTS as readonly string[]).includes(tag)) {
      segmentPlaced = true;
      return draft.segment;
    }
    if (!stagePlaced && (STAGES as readonly string[]).includes(tag)) {
      stagePlaced = true;
      return draft.stage;
    }
    return tag;
  });
  if (!segmentPlaced) tags.unshift(draft.segment);
  if (!stagePlaced) tags.push(draft.stage);

  return {
    name: draft.name.trim(),
    tags: tags.filter((tag, index) => tags.indexOf(tag) === index),
    owner: draft.owner,
    zone: draft.zone,
    pipelineValue: Math.max(0, Math.round(Number(draft.pipelineValue) || 0)),
    openDeals: Math.max(0, Math.round(Number(draft.openDeals) || 0)),
    winProbability: Math.min(100, Math.max(0, Math.round(Number(draft.winProbability) || 0))),
  };
}

type CompanyEditFormProps = {
  draft: CompanyDraft;
  onChange: <K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) => void;
  onSubmit: () => void;
};

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function CompanyEditForm({ draft, onChange, onSubmit }: CompanyEditFormProps) {
  const zones = useSettingsStore((state) => state.zones);
  const [nameError, setNameError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setNameError("Indique o nome do cliente.");
      document.getElementById("company-edit-name")?.focus();
      return;
    }
    onSubmit();
  }

  const zoneOptions = zones.some((zone) => zone.name === draft.zone)
    ? zones.map((zone) => zone.name)
    : [draft.zone, ...zones.map((zone) => zone.name)];

  return (
    <form id={COMPANY_FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col">
      <FormSection title="Cliente">
        <Field label="Nome do cliente" htmlFor="company-edit-name" required error={nameError}>
          <Input
            id="company-edit-name"
            value={draft.name}
            autoFocus
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "company-edit-name-error" : undefined}
            className="aria-invalid:border-danger"
            onChange={(event) => {
              setNameError(undefined);
              onChange("name", event.target.value);
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="company-edit-segment" label="Segmento" value={draft.segment} options={SEGMENTS} onChange={(value) => onChange("segment", value)} />
          <SelectField id="company-edit-stage" label="Fase" value={draft.stage} options={STAGES} onChange={(value) => onChange("stage", value)} />
          <SelectField
            id="company-edit-owner"
            label="Gestor de conta"
            value={draft.owner}
            options={OWNERS.map((owner) => owner.name)}
            onChange={(value) => onChange("owner", value)}
          />
          <SelectField id="company-edit-zone" label="Zona" value={draft.zone} options={zoneOptions} onChange={(value) => onChange("zone", value)} />
        </div>
      </FormSection>

      <FormSection title="Carteira">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Valor em carteira (Kz)" htmlFor="company-edit-value">
            <Input
              id="company-edit-value"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={draft.pipelineValue}
              onChange={(event) => onChange("pipelineValue", event.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Oportunidades abertas" htmlFor="company-edit-deals">
            <Input
              id="company-edit-deals"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.openDeals}
              onChange={(event) => onChange("openDeals", event.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Probabilidade (%)" htmlFor="company-edit-probability">
            <Input
              id="company-edit-probability"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={draft.winProbability}
              onChange={(event) => onChange("winProbability", event.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
      </FormSection>
    </form>
  );
}
