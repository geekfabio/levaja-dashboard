"use client";

import { useRef, useState, type FormEvent } from "react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { Slider } from "@/components/_ui/slider";
import SegmentBar from "@/components/_common/segment-bar";
import FormSection from "@/components/_common/form-section";
import LogoUpload from "./logo-upload";
import {
  DEFAULT_TREND,
  EMPTY_PROFILE,
  INTERACTION_TYPES,
  OWNERS,
  SEGMENTS,
  STAGES,
  type Company,
  type Segment,
  type Stage,
  type Zone,
} from "@/data/companies";
import { TODAY, daysSince } from "@/lib/companies";
import { findByNif } from "@/lib/company-profile";
import { isValidNif, normalizeNif } from "@/lib/nif";
import { slugify } from "@/lib/utils";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type FormState = {
  logo: string | null;
  name: string;
  nif: string;
  segment: Segment;
  stage: Stage;
  owner: string;
  zone: Zone;
  pipelineValue: string;
  openDeals: string;
  winProbability: number;
  interactionDate: string;
  interactionType: string;
};

const EMPTY_FORM: FormState = {
  logo: null,
  name: "",
  nif: "",
  segment: SEGMENTS[0],
  stage: STAGES[0],
  owner: OWNERS[0].name,
  zone: "",
  pipelineValue: "",
  openDeals: "1",
  winProbability: 50,
  interactionDate: TODAY,
  interactionType: INTERACTION_TYPES[0],
};

export default function NewCompanyDialog() {
  const open = useCompaniesStore((state) => state.newCompanyOpen);
  const setOpen = useCompaniesStore((state) => state.setNewCompanyOpen);
  const addCompany = useCompaniesStore((state) => state.addCompany);
  const companies = useCompaniesStore((state) => state.companies);
  const openDetail = useCompaniesStore((state) => state.openDetail);
  const [nifError, setNifError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const zones = useSettingsStore((state) => state.zones);
  const zone = form.zone || zones[0]?.name || "";
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const duplicate = isValidNif(form.nif) ? findByNif(companies, form.nif) : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError("Indique o nome do cliente.");
      nameRef.current?.focus();
      return;
    }
    if (form.nif.trim() && !isValidNif(form.nif)) {
      setNifError("NIF inválido: 10 dígitos (empresa) ou 9 dígitos, 2 letras e 3 dígitos (pessoa singular).");
      document.getElementById("company-nif")?.focus();
      return;
    }
    if (duplicate) {
      setNifError(`Este NIF já pertence a ${duplicate.name}.`);
      document.getElementById("company-nif")?.focus();
      return;
    }

    const company: Company = {
      id: `${slugify(name)}-${Date.now()}`,
      name,
      logo: form.logo ?? undefined,
      tags: [form.segment, form.stage],
      owner: form.owner,
      zone,
      openDeals: Math.max(0, Math.round(Number(form.openDeals) || 0)),
      pipelineValue: Math.max(0, Math.round(Number(form.pipelineValue) || 0)),
      winProbability: form.winProbability,
      trend: DEFAULT_TREND,
      lastInteraction: {
        date: form.interactionDate || TODAY,
        label: form.interactionType,
      },
      activityDays: daysSince(form.interactionDate || TODAY),
      profile: { ...EMPTY_PROFILE, nif: normalizeNif(form.nif), customerSince: TODAY },
    };

    addCompany(company);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setNameError(null);
          setNifError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Adicione um cliente à carteira. Aparece na lista de imediato.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Cliente">
            <LogoUpload
              value={form.logo}
              companyName={form.name}
              onChange={(logo) => update("logo", logo)}
            />

            <Field
              label="Nome do cliente"
              htmlFor="company-name"
              required
              error={nameError ?? undefined}
            >
              <Input
                ref={nameRef}
                id="company-name"
                value={form.name}
                onChange={(event) => {
                  update("name", event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Mercearia Exemplo"
                autoComplete="off"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "company-name-error" : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <Field
              label="NIF"
              htmlFor="company-nif"
              error={nifError ?? undefined}
              hint="Opcional. Usado para reconhecer o cliente nas compras e evitar duplicados."
            >
              <Input
                id="company-nif"
                value={form.nif}
                onChange={(event) => {
                  update("nif", event.target.value);
                  if (nifError) setNifError(null);
                }}
                placeholder="5000000000"
                autoComplete="off"
                inputMode="text"
                aria-invalid={nifError ? true : undefined}
                className="aria-invalid:border-danger tabular-nums"
              />
            </Field>
            {duplicate && (
              <div role="status" className="caption-style flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-2 text-(--tag-amber-text)">
                Já existe um cliente com este NIF: {duplicate.name}.
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    openDetail(duplicate.id);
                  }}
                >
                  Abrir ficha
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Segmento" htmlFor="company-segment">
                <Select
                  value={form.segment}
                  onValueChange={(value) => update("segment", value as Segment)}
                >
                  <SelectTrigger id="company-segment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((segment) => (
                      <SelectItem key={segment} value={segment}>
                        {segment}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fase" htmlFor="company-stage">
                <Select
                  value={form.stage}
                  onValueChange={(value) => update("stage", value as Stage)}
                >
                  <SelectTrigger id="company-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Responsável e oportunidade">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Gestor de conta" htmlFor="company-owner">
                <Select
                  value={form.owner}
                  onValueChange={(value) => update("owner", value)}
                >
                  <SelectTrigger id="company-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERS.map((owner) => (
                      <SelectItem key={owner.name} value={owner.name}>
                        <span className="flex items-center gap-2">
                          <Avatar src={owner.avatar} alt="" />
                          {owner.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Zona" htmlFor="company-zone">
                <Select
                  value={zone}
                  onValueChange={(value) => update("zone", value as Zone)}
                >
                  <SelectTrigger id="company-zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor em carteira" htmlFor="company-pipeline">
                <div className="relative">
                  <span
                    aria-hidden
                    className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] leading-none"
                  >
                    Kz
                  </span>
                  <Input
                    id="company-pipeline"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={form.pipelineValue}
                    onChange={(event) =>
                      update("pipelineValue", event.target.value)
                    }
                    placeholder="25000000"
                    className="pr-9 tabular-nums"
                  />
                </div>
              </Field>
              <Field label="Oportunidades abertas" htmlFor="company-deals">
                <Input
                  id="company-deals"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.openDeals}
                  onChange={(event) => update("openDeals", event.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>

            <Field
              label="Probabilidade de fecho"
              htmlFor="company-win"
              trailing={
                <span className="caption-style text-foreground tabular-nums">
                  {form.winProbability}%
                </span>
              }
            >
              <div className="flex flex-col gap-3">
                <Slider
                  id="company-win"
                  aria-label="Probabilidade de fecho"
                  min={0}
                  max={100}
                  step={1}
                  value={[form.winProbability]}
                  onValueChange={([value]) => update("winProbability", value)}
                />
                <SegmentBar
                  percent={form.winProbability}
                  segments={40}
                  className="h-3 w-full border border-white/4 px-px"
                  segmentClassName="h-2"
                  trackClassName="bg-white/8"
                />
              </div>
            </Field>
          </FormSection>

          <FormSection title="Último contacto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data" htmlFor="company-interaction-date">
                <Input
                  id="company-interaction-date"
                  type="date"
                  max={TODAY}
                  value={form.interactionDate}
                  onChange={(event) =>
                    update("interactionDate", event.target.value)
                  }
                  className="tabular-nums"
                />
              </Field>
              <Field label="Tipo" htmlFor="company-interaction-type">
                <Select
                  value={form.interactionType}
                  onValueChange={(value) => update("interactionType", value)}
                >
                  <SelectTrigger id="company-interaction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <PlusIcon aria-hidden className="size-3" />
              Criar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
