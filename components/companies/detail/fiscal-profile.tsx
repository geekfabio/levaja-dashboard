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
import { PAYMENT_TERMS, type Company, type CompanyProfile, type PaymentTerm } from "@/data/companies";
import { cleanProfile, profileErrors, type ProfileErrors } from "@/lib/company-profile";
import { formatDateLong, formatMoney } from "@/lib/format";
import { companyProfile, useCompaniesStore } from "@/stores/companies-store";
import CallButton from "@/components/_common/call-button";

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="caption-style text-subtle">{label}</dt>
      <dd className="lead-style truncate">{value || "—"}</dd>
    </div>
  );
}

export default function FiscalProfile({ company }: { company: Company }) {
  const companies = useCompaniesStore((state) => state.companies);
  const updateProfile = useCompaniesStore((state) => state.updateProfile);
  const profile = companyProfile(company);
  const [draft, setDraft] = useState<CompanyProfile | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});

  function update<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const found = profileErrors(draft, companies, company.id);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    updateProfile(company.id, cleanProfile(draft));
    setDraft(null);
  }

  if (!draft) {
    return (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Item label="NIF" value={profile.nif} />
          <Item label="Cartão de cliente" value={profile.card} />
          <Item label="Telefone" value={profile.phone} />
          <Item label="Morada" value={[profile.address, profile.municipality].filter(Boolean).join(", ")} />
          <Item label="E-mail de faturação" value={profile.billingEmail} />
          <Item label="Cliente desde" value={profile.customerSince ? formatDateLong(profile.customerSince) : ""} />
          <Item label="Condições" value={profile.paymentTerms} />
          <Item label="Limite de crédito" value={profile.creditLimit ? formatMoney(profile.creditLimit) : "Sem crédito"} />
        </dl>
        <span className="caption-style text-subtle">
          NIF, cartão e telefone identificam o cliente nas compras que chegam do sistema de vendas.
        </span>
        <div className="flex flex-wrap gap-1">
          <Button variant="secondary" size="sm" onClick={() => setDraft(profile)}>
            Editar dados fiscais
          </Button>
          {profile.phone && <CallButton phone={profile.phone} companyId={company.id} label="Ligar ao cliente" />}
        </div>
      </div>
    );
  }

  const field = (key: keyof CompanyProfile) => `fiscal-${company.id}-${key}`;

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="NIF" htmlFor={field("nif")} error={errors.nif}>
          <Input id={field("nif")} value={draft.nif} autoFocus onChange={(event) => update("nif", event.target.value)} className="tabular-nums" />
        </Field>
        <Field label="Cartão de cliente" htmlFor={field("card")}>
          <Input id={field("card")} value={draft.card} placeholder="AA-000000" onChange={(event) => update("card", event.target.value)} />
        </Field>
        <Field label="Telefone" htmlFor={field("phone")} error={errors.phone}>
          <Input id={field("phone")} type="tel" value={draft.phone} placeholder="+244 9XX XXX XXX" onChange={(event) => update("phone", event.target.value)} />
        </Field>
        <Field label="E-mail de faturação" htmlFor={field("billingEmail")} error={errors.billingEmail}>
          <Input id={field("billingEmail")} type="email" value={draft.billingEmail} onChange={(event) => update("billingEmail", event.target.value)} />
        </Field>
        <Field label="Morada" htmlFor={field("address")}>
          <Input id={field("address")} value={draft.address} onChange={(event) => update("address", event.target.value)} />
        </Field>
        <Field label="Município" htmlFor={field("municipality")}>
          <Input id={field("municipality")} value={draft.municipality} onChange={(event) => update("municipality", event.target.value)} />
        </Field>
        <Field label="Condições de pagamento" htmlFor={field("paymentTerms")}>
          <Select value={draft.paymentTerms} onValueChange={(value) => update("paymentTerms", value as PaymentTerm)}>
            <SelectTrigger id={field("paymentTerms")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((term) => (
                <SelectItem key={term} value={term}>
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Limite de crédito (Kz)"
          htmlFor={field("creditLimit")}
          error={errors.creditLimit}
          hint={draft.paymentTerms === "Pronto pagamento" && draft.creditLimit > 0 ? "Com pronto pagamento o limite não é usado." : undefined}
        >
          <Input
            id={field("creditLimit")}
            type="number"
            min={0}
            step={100000}
            inputMode="numeric"
            value={draft.creditLimit}
            onChange={(event) => update("creditLimit", Number(event.target.value) || 0)}
            className="tabular-nums"
          />
        </Field>
        <Field label="Cliente desde" htmlFor={field("customerSince")}>
          <Input id={field("customerSince")} type="date" value={draft.customerSince} onChange={(event) => update("customerSince", event.target.value)} className="tabular-nums" />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="subtle" size="sm" onClick={() => setDraft(null)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Guardar dados fiscais
        </Button>
      </div>
    </form>
  );
}
