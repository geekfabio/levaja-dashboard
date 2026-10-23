"use client";

import AsyncState from "@/components/_common/async-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import DetailList from "@/components/admin/shared/detail-list";
import { errorMessage } from "@/data/leva-ja";
import { useInvoice } from "@/hooks/admin/use-billing";
import { usePlatformSettings } from "@/hooks/admin/use-settings";
import { formatDateTimeNumeric, formatDecimal, formatKz } from "@/lib/format";
import { INVOICE_KIND_LABELS } from "@/lib/leva-ja/billing";
import { PAYMENT_LABELS } from "@/lib/leva-ja/services";

export default function InvoiceDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const query = useInvoice(invoiceId);
  const settings = usePlatformSettings();
  const general = settings.data?.general;

  return (
    <Dialog open={invoiceId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader className="pr-12">
          <DialogTitle>{query.data ? `${INVOICE_KIND_LABELS[query.data.kind]} ${query.data.number}` : "Documento"}</DialogTitle>
          <DialogDescription>
            {general ? `${general.legalName} · NIF ${general.nif}` : "Documento emitido pela plataforma."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-6 pt-2 pb-6">
          <AsyncState query={query} skeleton={<Skeleton className="h-64" />} errorDescription={errorMessage}>
            {(invoice) => (
              <>
                <DetailList
                  items={[
                    { label: "Data de emissão", value: formatDateTimeNumeric(invoice.issuedAt) },
                    { label: "Pedido", value: invoice.requestCode },
                    { label: "Cliente", value: invoice.clientName },
                    { label: "Telefone", value: <span className="tabular-nums">{invoice.clientPhone || "—"}</span> },
                    { label: "Pagamento", value: PAYMENT_LABELS[invoice.paymentMethod] },
                    { label: "Prestador", value: invoice.providerName ?? "—" },
                    ...(invoice.relatedNumber ? [{ label: "Rectifica", value: invoice.relatedNumber, wide: true }] : []),
                  ]}
                />
                <div className="border-border overflow-hidden rounded-xl border">
                  <Table aria-label="Linhas do documento">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Descrição</TableHead>
                        <TableHead scope="col" className="text-right">
                          Valor com IVA
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lines.map((line) => (
                        <TableRow key={line.description}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatKz(line.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <dl className="caption-style ml-auto grid w-full max-w-[18em] grid-cols-2 gap-y-1.5 tabular-nums">
                  <dt className="text-subtle">Base tributável</dt>
                  <dd className="text-right">{formatKz(invoice.net)}</dd>
                  <dt className="text-subtle">IVA ({formatDecimal(invoice.vatRate * 100, 0)} %)</dt>
                  <dd className="text-right">{formatKz(invoice.vat)}</dd>
                  <dt className="lead-style font-medium">Total</dt>
                  <dd className="lead-style text-right font-medium">{formatKz(invoice.total)}</dd>
                </dl>
                <p className="caption-style text-subtle">Documento de demonstração gerado a partir dos dados fictícios do painel; não tem validade fiscal.</p>
              </>
            )}
          </AsyncState>
        </div>
      </DialogContent>
    </Dialog>
  );
}
