"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreatePromotion } from "@/hooks/admin/use-commerce";
import { parseKz, shiftDay } from "@/lib/format";
import { PROMOTION_KIND_LABELS } from "@/lib/leva-ja/commerce";
import { SERVICE_KINDS, SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import type { PromotionKind, ServiceKind } from "@/types/leva-ja";

export default function PromotionDialog({ open, onOpenChange, today }: { open: boolean; onOpenChange: (open: boolean) => void; today: string }) {
  const create = useCreatePromotion();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PromotionKind>("percent");
  const [value, setValue] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [services, setServices] = useState<ServiceKind[]>([]);
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(shiftDay(today, 30));
  const [budget, setBudget] = useState("50000");
  const [perClient, setPerClient] = useState("1");
  const [firstOrder, setFirstOrder] = useState(false);
  const issues = isRepositoryError(create.error) ? create.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const toggle = (service: ServiceKind) => setServices((current) => (current.includes(service) ? current.filter((item) => item !== service) : [...current, service]));

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) create.reset();
      }}
      title="Nova promoção"
      description="O código é aplicado pelo cliente na app. O desconto sai da receita da plataforma."
      confirmLabel="Criar promoção"
      pending={create.isPending}
      error={issues.length ? null : mutationError(create.error)}
      onConfirm={() =>
        create
          .mutateAsync({
            code,
            name,
            kind,
            value: parseKz(value),
            maxDiscount: kind === "percent" && maxDiscount ? parseKz(maxDiscount) : undefined,
            minOrder: parseKz(minOrder),
            services,
            zoneIds: [],
            startsAt: startsAt ? `${startsAt}T00:00:00+01:00` : "",
            endsAt: endsAt ? `${endsAt}T23:59:00+01:00` : "",
            budget: parseKz(budget),
            perClientLimit: Number(perClient),
            firstOrderOnly: firstOrder,
          })
          .then(() => onOpenChange(false), () => undefined)
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código" htmlFor="promo-code" required error={issueFor("code")}>
          <Input id="promo-code" value={code} placeholder="LEVAJA10" onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Nome" htmlFor="promo-name" required error={issueFor("name")}>
          <Input id="promo-name" value={name} placeholder="10 % em qualquer serviço" onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Tipo de desconto" htmlFor="promo-kind">
          <Select value={kind} onValueChange={(next) => setKind(next as PromotionKind)}>
            <SelectTrigger id="promo-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROMOTION_KIND_LABELS) as PromotionKind[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PROMOTION_KIND_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={kind === "percent" ? "Desconto (%)" : "Desconto (Kz)"} htmlFor="promo-value" required error={issueFor("value")}>
          <Input id="promo-value" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} className="tabular-nums" />
        </Field>
        {kind === "percent" && (
          <Field label="Desconto máximo (Kz)" htmlFor="promo-max" hint="Opcional.">
            <Input id="promo-max" inputMode="numeric" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} className="tabular-nums" />
          </Field>
        )}
        <Field label="Pedido mínimo (Kz)" htmlFor="promo-min" error={issueFor("minOrder")}>
          <Input id="promo-min" inputMode="numeric" value={minOrder} onChange={(event) => setMinOrder(event.target.value)} className="tabular-nums" />
        </Field>
        <Field label="Início" htmlFor="promo-start">
          <Input id="promo-start" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </Field>
        <Field label="Fim" htmlFor="promo-end" error={issueFor("endsAt")}>
          <Input id="promo-end" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </Field>
        <Field label="Orçamento (Kz)" htmlFor="promo-budget" required error={issueFor("budget")}>
          <Input id="promo-budget" inputMode="numeric" value={budget} onChange={(event) => setBudget(event.target.value)} className="tabular-nums" />
        </Field>
        <Field label="Usos por cliente" htmlFor="promo-per-client" error={issueFor("perClientLimit")}>
          <Input id="promo-per-client" inputMode="numeric" value={perClient} onChange={(event) => setPerClient(event.target.value)} className="tabular-nums" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="caption-style text-soft pb-1">Serviços abrangidos (nenhum escolhido = todos)</legend>
        <div className="flex flex-wrap gap-3">
          {SERVICE_KINDS.map((service) => (
            <label key={service} className="caption-style text-soft flex cursor-pointer items-center gap-2">
              <Checkbox checked={services.includes(service)} onCheckedChange={() => toggle(service)} />
              {SERVICE_SHORT_LABELS[service]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
        <Checkbox checked={firstOrder} onCheckedChange={(next) => setFirstOrder(next === true)} />
        Só no primeiro pedido do cliente
      </label>
    </ConfirmDialog>
  );
}
