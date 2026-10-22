"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { formatPercent } from "@/lib/format";
import { priceListDiscount } from "@/lib/quotes";
import { useCompaniesStore } from "@/stores/companies-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useQuotesStore } from "@/stores/quotes-store";

const NONE = "nenhuma";

export default function NewQuoteDialog() {
  const open = useQuotesStore((state) => state.newQuoteOpen);
  const setOpen = useQuotesStore((state) => state.setNewQuoteOpen);
  const createQuote = useQuotesStore((state) => state.createQuote);
  const discounts = useQuotesStore((state) => state.discounts);
  const companies = useCompaniesStore((state) => state.companies);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const [companyId, setCompanyId] = useState("");
  const [opportunityId, setOpportunityId] = useState(NONE);
  const [error, setError] = useState<string>();

  const active = companies.filter((company) => !company.archived).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const company = companies.find((item) => item.id === companyId);
  const openOpportunities = opportunities.filter((item) => item.companyId === companyId && !item.stage.startsWith("Fechada"));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onCloseAutoFocus={() => {
          setCompanyId("");
          setOpportunityId(NONE);
          setError(undefined);
        }}
      >
        <DialogHeader>
          <DialogTitle>Nova cotação</DialogTitle>
          <DialogDescription>Os preços seguem a tabela do segmento do cliente. Pode ajustar por linha.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-5">
          <Field label="Cliente" htmlFor="quote-company" required error={error}>
            <Select
              value={companyId}
              onValueChange={(value) => {
                setCompanyId(value);
                setOpportunityId(NONE);
                setError(undefined);
              }}
            >
              <SelectTrigger id="quote-company">
                <SelectValue placeholder="Escolher cliente…" />
              </SelectTrigger>
              <SelectContent>
                {active.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {company && (
            <span className="caption-style text-subtle">
              Tabela de preços: −{formatPercent(priceListDiscount(company, discounts))} sobre o preço base.
            </span>
          )}
          {openOpportunities.length > 0 && (
            <Field label="Oportunidade" htmlFor="quote-opportunity" hint="Ao aceitar a cotação pode marcá-la como ganha.">
              <Select value={opportunityId} onValueChange={setOpportunityId}>
                <SelectTrigger id="quote-opportunity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem oportunidade</SelectItem>
                  {openOpportunities.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.stage} · {item.products.join(", ") || item.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="subtle" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (!companyId) {
                setError("Escolha o cliente.");
                return;
              }
              createQuote(companyId, opportunityId === NONE ? undefined : opportunityId);
            }}
          >
            Criar cotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
