"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { VAT_RATE } from "@/data/catalog";
import { formatDateLong, formatMoney, formatPercent } from "@/lib/format";
import { documentTotals, lineNet } from "@/lib/quotes";
import { companyProfile, useCompaniesStore } from "@/stores/companies-store";
import { useQuotesStore } from "@/stores/quotes-store";
import { useSettingsStore } from "@/stores/settings-store";

export default function DocumentPrint() {
  const printId = useQuotesStore((state) => state.printId);
  const setPrintId = useQuotesStore((state) => state.setPrintId);
  const quote = useQuotesStore((state) => state.quotes.find((item) => item.id === printId));
  const order = useQuotesStore((state) => state.orders.find((item) => item.id === printId));
  const seller = useSettingsStore((state) => state.company);
  const document = quote ?? order;
  const company = useCompaniesStore((state) => state.companies.find((item) => item.id === document?.companyId));

  useEffect(() => {
    if (!printId) return;
    const done = () => setPrintId(null);
    window.addEventListener("afterprint", done, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printId, setPrintId]);

  if (!document || typeof window === "undefined") return null;
  const profile = company ? companyProfile(company) : undefined;
  const totals = documentTotals(document.lines, document.priceListDiscount);
  const title = quote ? "Cotação" : "Guia de encomenda";

  return createPortal(
    <div data-print-root className="bg-brand-paper text-brand-ink p-2 text-[12px] leading-[1.45]">
      <div className="flex items-start justify-between gap-6 border-b-2 border-brand pb-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-brand text-[18px] font-semibold">{seller.tradeName}</span>
          <span>{seller.legalName} · NIF {seller.nif}</span>
          <span>{seller.address}, {seller.city}</span>
          <span>{seller.phone} · {seller.email}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[16px] font-semibold">{title}</span>
          <span className="font-medium">{document.number}</span>
          <span>Data: {formatDateLong(document.createdAt)}</span>
          {quote && <span>Válida até: {formatDateLong(quote.validUntil)}</span>}
          {order && <span>{order.fulfilment}: {formatDateLong(order.deliveryDate)}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 py-4">
        <span className="text-[10px] tracking-[0.08em] uppercase">Cliente</span>
        <span className="text-[14px] font-semibold">{company?.name ?? document.companyId}</span>
        {profile?.nif && <span>NIF {profile.nif}</span>}
        {(profile?.address || profile?.municipality) && (
          <span>{[profile.address, profile.municipality].filter(Boolean).join(", ")}</span>
        )}
        {profile && <span>Condições de pagamento: {profile.paymentTerms}</span>}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-brand-ink text-left">
            <th className="py-1.5 pr-2 font-semibold">Código</th>
            <th className="py-1.5 pr-2 font-semibold">Produto</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Qtd.</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Preço</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Desc.</th>
            <th className="py-1.5 text-right font-semibold">Líquido</th>
          </tr>
        </thead>
        <tbody>
          {document.lines.map((line) => (
            <tr key={line.id} className="border-b border-brand-ink/20">
              <td className="py-1.5 pr-2 tabular-nums">{line.productId}</td>
              <td className="py-1.5 pr-2">{line.name}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{line.quantity} {line.unit}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {line.discount > 0 ? formatPercent(line.discount) : "—"}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(lineNet(line, document.priceListDiscount))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 flex w-[280px] flex-col gap-1">
        <div className="flex justify-between"><span>Valor bruto</span><span className="tabular-nums">{formatMoney(totals.gross)}</span></div>
        <div className="flex justify-between">
          <span>Descontos (tabela {formatPercent(document.priceListDiscount)})</span>
          <span className="tabular-nums">−{formatMoney(totals.discount)}</span>
        </div>
        <div className="flex justify-between"><span>Valor líquido</span><span className="tabular-nums">{formatMoney(totals.net)}</span></div>
        <div className="flex justify-between"><span>IVA {VAT_RATE}%</span><span className="tabular-nums">{formatMoney(totals.vat)}</span></div>
        <div className="flex justify-between border-t border-brand-ink pt-1 text-[14px] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totals.total)}</span>
        </div>
      </div>

      {document.notes && <p className="mt-6">Observações: {document.notes}</p>}
      <p className="mt-6 text-[10px]">
        Documento sem valor fiscal. A fatura é emitida pelo sistema de vendas certificado.
      </p>
    </div>,
    window.document.body,
  );
}
