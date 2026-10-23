import { SERVICE_LABELS } from "./services";
import type {
  CashDebt,
  Invoice,
  InvoiceKind,
  PaymentMethodKind,
  PayoutBatchStatus,
  ServiceKind,
  SettlementMethod,
  SettlementStatus,
  Withdrawal,
} from "@/types/leva-ja";

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  invoice: "Factura-recibo",
  credit_note: "Nota de crédito",
};

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
  card: "Cartão (gateway)",
  bank_reference: "Referência Multicaixa",
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: "Por receber",
  matched: "Conciliado",
  mismatch: "Com diferença",
  resolved: "Diferença justificada",
};

export const SETTLEMENT_STATUS_TONES = { pending: "neutral", matched: "success", mismatch: "danger", resolved: "info" } as const;

export const BATCH_STATUS_LABELS: Record<PayoutBatchStatus, string> = {
  draft: "Em preparação",
  sent: "Enviado ao banco",
  paid: "Pago",
  cancelled: "Cancelado",
};

export const BATCH_STATUS_TONES = { draft: "warning", sent: "info", paid: "success", cancelled: "neutral" } as const;

export function vatSplit(total: number, rate: number) {
  const net = Math.round(total / (1 + rate));
  return { net, vat: total - net };
}

export function documentNumber(series: string, year: number, sequence: number) {
  return `${series.trim()} ${year}/${String(sequence).padStart(5, "0")}`;
}

type InvoiceSource = {
  id: string;
  code: string;
  kind: ServiceKind;
  paidAt: string;
  total: number;
  platformFee: number;
  paymentMethod: PaymentMethodKind;
  clientId: string;
  clientName: string;
  clientPhone: string;
  providerName?: string;
};

type CreditSource = { id: string; requestId: string; amount: number; paidAt: string; reason: string };

export function buildInvoices(
  requests: InvoiceSource[],
  refunds: CreditSource[],
  tax: { vatRate: number; invoiceSeries: string; creditNoteSeries: string },
): Invoice[] {
  const sequences = new Map<string, number>();
  const next = (series: string, iso: string) => {
    const year = Number(iso.slice(0, 4));
    const key = `${series}:${year}`;
    const value = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, value);
    return documentNumber(series, year, value);
  };
  const invoices = new Map<string, Invoice>();
  const result: Invoice[] = [];
  for (const request of [...requests].sort((a, b) => (a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : a.id < b.id ? -1 : 1))) {
    const { net, vat } = vatSplit(request.total, tax.vatRate);
    const invoice: Invoice = {
      id: `ft-${request.id}`,
      number: next(tax.invoiceSeries, request.paidAt),
      kind: "invoice",
      issuedAt: request.paidAt,
      requestId: request.id,
      requestCode: request.code,
      clientId: request.clientId,
      clientName: request.clientName,
      clientPhone: request.clientPhone,
      providerName: request.providerName,
      paymentMethod: request.paymentMethod,
      lines: [
        { description: `${SERVICE_LABELS[request.kind]} — pedido ${request.code}`, amount: request.total - request.platformFee },
        { description: "Taxa de serviço Leva Já", amount: request.platformFee },
      ],
      vatRate: tax.vatRate,
      net,
      vat,
      total: request.total,
    };
    invoices.set(request.id, invoice);
    result.push(invoice);
  }
  for (const refund of [...refunds].sort((a, b) => (a.paidAt < b.paidAt ? -1 : 1))) {
    const invoice = invoices.get(refund.requestId);
    if (!invoice) continue;
    const { net, vat } = vatSplit(refund.amount, tax.vatRate);
    result.push({
      ...invoice,
      id: `nc-${refund.id}`,
      number: next(tax.creditNoteSeries, refund.paidAt),
      kind: "credit_note",
      issuedAt: refund.paidAt,
      lines: [{ description: `Reembolso — ${refund.reason}`, amount: -refund.amount }],
      net: -net,
      vat: -vat,
      total: -refund.amount,
      refundId: refund.id,
      relatedNumber: invoice.number,
    });
  }
  return result;
}

export function settlementStatus(expected: number, received: number | null, resolved: boolean): SettlementStatus {
  if (received === null) return "pending";
  if (received === expected) return "matched";
  return resolved ? "resolved" : "mismatch";
}

export function cashPosition(
  charges: { at: string; amount: number }[],
  deposits: { at: string; amount: number }[],
  settlementDays: number,
  now: number,
): Pick<CashDebt, "owed" | "deposited" | "balance" | "oldestUnsettledAt" | "overdue" | "lastDepositAt"> {
  const owed = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const deposited = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  let covered = deposited;
  let oldestUnsettledAt: string | undefined;
  for (const charge of [...charges].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    if (covered >= charge.amount) {
      covered -= charge.amount;
      continue;
    }
    oldestUnsettledAt = charge.at;
    break;
  }
  const lastDepositAt = deposits.reduce<string | undefined>((latest, deposit) => (!latest || deposit.at > latest ? deposit.at : latest), undefined);
  return {
    owed,
    deposited,
    balance: owed - deposited,
    oldestUnsettledAt,
    overdue: oldestUnsettledAt ? now - new Date(oldestUnsettledAt).getTime() > settlementDays * 86_400_000 : false,
    lastDepositAt,
  };
}

export function batchIssues(withdrawals: Pick<Withdrawal, "id" | "status" | "batchId">[], openBatchIds: Set<string>) {
  if (withdrawals.length === 0) return "Escolha pelo menos um levantamento aprovado.";
  if (withdrawals.some((withdrawal) => withdrawal.status !== "approved")) return "Só levantamentos aprovados entram num lote.";
  if (withdrawals.some((withdrawal) => withdrawal.batchId && openBatchIds.has(withdrawal.batchId))) return "Há levantamentos que já estão noutro lote.";
  return null;
}

export function bankFileRows(withdrawals: Pick<Withdrawal, "providerName" | "iban" | "amount" | "id">[], batchCode: string): (string | number)[][] {
  return [
    ["Beneficiário", "IBAN", "Valor (Kz)", "Descritivo"],
    ...withdrawals.map((withdrawal, index) => [withdrawal.providerName, withdrawal.iban.replace(/\s/g, ""), withdrawal.amount, `${batchCode}-${index + 1} Leva Já`]),
  ];
}
