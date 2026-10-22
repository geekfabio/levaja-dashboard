"use client";

import { useCompaniesStore } from "@/stores/companies-store";
import { useRef, useState, type FormEvent } from "react";
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
import FormSection from "@/components/_common/form-section";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { Slider } from "@/components/_ui/slider";
import Tag from "@/components/_ui/tag";
import SegmentBar from "@/components/_common/segment-bar";
import { COMPANIES, OWNERS } from "@/data/companies";
import {
  OPPORTUNITY_STAGES,
  PRODUCT_CATEGORIES,
  type Opportunity,
  type OpportunityStage,
} from "@/data/opportunities";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type FormState = {
  companyId: string;
  contactName: string;
  value: string;
  stage: OpportunityStage;
  probability: number;
  expectedCloseDate: string;
  owner: string;
  products: string[];
};

const EMPTY_FORM: FormState = {
  companyId: COMPANIES[0].id,
  contactName: "",
  value: "",
  stage: OPPORTUNITY_STAGES[0],
  probability: 30,
  expectedCloseDate: today(),
  owner: OWNERS[0].name,
  products: [],
};

export default function NewOpportunityDialog() {
  const companies = useCompaniesStore((state) => state.companies);
  const open = useOpportunitiesStore((state) => state.newOpportunityOpen);
  const setOpen = useOpportunitiesStore((state) => state.setNewOpportunityOpen);
  const addOpportunity = useOpportunitiesStore((state) => state.addOpportunity);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [contactError, setContactError] = useState<string | null>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleProduct(product: string) {
    setForm((current) => ({
      ...current,
      products: current.products.includes(product)
        ? current.products.filter((item) => item !== product)
        : [...current.products, product],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contactName = form.contactName.trim();
    if (!contactName) {
      setContactError("Indique o nome do contacto.");
      contactRef.current?.focus();
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    if (!company) return;

    const opportunity: Opportunity = {
      id: `op-${Date.now()}`,
      companyId: company.id,
      companyName: company.name,
      contactName,
      value: Math.max(0, Math.round(Number(form.value) || 0)),
      stage: form.stage,
      probability: form.probability,
      expectedCloseDate: form.expectedCloseDate || today(),
      owner: form.owner,
      products: form.products,
      stageHistory: [
        { stage: form.stage, date: today(), author: form.owner },
      ],
    };

    addOpportunity(opportunity);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setContactError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova Oportunidade</DialogTitle>
            <DialogDescription>
              Adicione uma oportunidade ao funil. Aparece no quadro e na
              tabela de imediato.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Cliente e contacto">
            <Field label="Cliente" htmlFor="opportunity-company">
              <Select
                value={form.companyId}
                onValueChange={(value) => update("companyId", value)}
              >
                <SelectTrigger id="opportunity-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter((company) => !company.archived).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Nome do contacto"
              htmlFor="opportunity-contact"
              required
              error={contactError ?? undefined}
            >
              <Input
                ref={contactRef}
                id="opportunity-contact"
                value={form.contactName}
                onChange={(event) => {
                  update("contactName", event.target.value);
                  if (contactError) setContactError(null);
                }}
                placeholder="Nome do contacto"
                autoComplete="off"
                aria-invalid={contactError ? true : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <Field label="Produtos" htmlFor="opportunity-products">
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_CATEGORIES.map((product) => {
                  const active = form.products.includes(product);
                  return (
                    <button
                      key={product}
                      type="button"
                      onClick={() => toggleProduct(product)}
                      aria-pressed={active}
                    >
                      <Tag
                        tone={active ? "blue" : "neutral"}
                        className="cursor-pointer"
                      >
                        {product}
                      </Tag>
                    </button>
                  );
                })}
              </div>
            </Field>
          </FormSection>

          <FormSection title="Negócio">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor" htmlFor="opportunity-value">
                <div className="relative">
                  <span
                    aria-hidden
                    className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] leading-none"
                  >
                    Kz
                  </span>
                  <Input
                    id="opportunity-value"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={form.value}
                    onChange={(event) => update("value", event.target.value)}
                    placeholder="5000000"
                    className="pr-9 tabular-nums"
                  />
                </div>
              </Field>
              <Field label="Fase" htmlFor="opportunity-stage">
                <Select
                  value={form.stage}
                  onValueChange={(value) =>
                    update("stage", value as OpportunityStage)
                  }
                >
                  <SelectTrigger id="opportunity-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label="Probabilidade de fecho"
              htmlFor="opportunity-probability"
              trailing={
                <span className="caption-style text-foreground tabular-nums">
                  {form.probability}%
                </span>
              }
            >
              <div className="flex flex-col gap-3">
                <Slider
                  id="opportunity-probability"
                  aria-label="Probabilidade de fecho"
                  min={0}
                  max={100}
                  step={1}
                  value={[form.probability]}
                  onValueChange={([value]) => update("probability", value)}
                />
                <SegmentBar
                  percent={form.probability}
                  segments={40}
                  className="h-3 w-full border border-white/4 px-px"
                  segmentClassName="h-2"
                  trackClassName="bg-white/8"
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Data prevista de fecho"
                htmlFor="opportunity-close-date"
              >
                <Input
                  id="opportunity-close-date"
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(event) =>
                    update("expectedCloseDate", event.target.value)
                  }
                  className="tabular-nums"
                />
              </Field>
              <Field label="Gestor de conta" htmlFor="opportunity-owner">
                <Select
                  value={form.owner}
                  onValueChange={(value) => update("owner", value)}
                >
                  <SelectTrigger id="opportunity-owner">
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

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <PlusIcon aria-hidden className="size-3" />
              Criar Oportunidade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
