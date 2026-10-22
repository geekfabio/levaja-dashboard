"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FormSection from "@/components/_common/form-section";
import { formatDateTimeShort, formatMoney } from "@/lib/format";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSalesStore } from "@/stores/sales-store";

export default function AssociateDialog() {
  const saleId = useSalesStore((state) => state.associateId);
  const sale = useSalesStore((state) => state.sales.find((item) => item.id === state.associateId));
  const setAssociateId = useSalesStore((state) => state.setAssociateId);
  const associate = useSalesStore((state) => state.associate);
  const companies = useCompaniesStore((state) => state.companies);
  const [companyId, setCompanyId] = useState("");
  const [saveIdentifier, setSaveIdentifier] = useState(true);
  const [error, setError] = useState<string>();

  return (
    <Dialog open={saleId !== null && sale !== undefined} onOpenChange={(open) => !open && setAssociateId(null)}>
      <DialogContent
        className="max-w-[480px]"
        onCloseAutoFocus={() => {
          setCompanyId("");
          setSaveIdentifier(true);
          setError(undefined);
        }}
      >
        <form
          noValidate
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sale) return;
            if (!companyId) {
              setError("Escolha o cliente.");
              document.getElementById("associate-company")?.focus();
              return;
            }
            associate(sale.id, companyId, saveIdentifier);
          }}
        >
          <DialogHeader>
            <DialogTitle>Associar compra a um cliente</DialogTitle>
            <DialogDescription>
              {sale
                ? `${sale.document} · ${formatDateTimeShort(sale.at)} · ${formatMoney(sale.total)} · ${sale.channel}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Cliente">
            <Field label="Cliente" htmlFor="associate-company" required error={error}>
              <Select
                value={companyId}
                onValueChange={(value) => {
                  setCompanyId(value);
                  setError(undefined);
                }}
              >
                <SelectTrigger id="associate-company" aria-invalid={error ? true : undefined}>
                  <SelectValue placeholder="Escolher cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {companies
                    .filter((company) => !company.archived)
                    .map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {sale?.identifier ? (
              <label className="lead-style text-soft flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={saveIdentifier}
                  onCheckedChange={(checked) => setSaveIdentifier(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  Guardar {sale.identifier.type.toLowerCase()} {sale.identifier.value} na ficha do cliente,
                  para as próximas compras serem associadas sozinhas.
                </span>
              </label>
            ) : (
              <p className="caption-style text-subtle">
                Esta compra chegou sem cartão, NIF nem telefone. Peça na caixa para identificar o
                cliente nas próximas vendas.
              </p>
            )}
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              Associar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
