import { formatDateNumeric, luandaDay } from "@/lib/format";
import { businessAmounts } from "@/lib/leva-ja/commerce";
import { COMPLETED_STATUSES } from "@/lib/leva-ja/status";
import type { Report, ReportsRepository } from "../repositories/reports";
import type { MockDatabase } from "./database";
import { businessSummary } from "./business";
import { commissionOf, eventAt, isSettled } from "./domain";
import { daysBetween } from "./finance";
import { inRange } from "./helpers";
import type { MockState } from "./state";

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

function build(state: MockState, kind: Report["kind"], from: string, to: string, now: Date): Report {
  const inPeriod = state.requests.filter((request) => inRange(request.createdAt, { from, to }));
  const settledInPeriod = state.requests.filter((request) => isSettled(request) && inRange(eventAt(request, "paid") ?? request.createdAt, { from, to }));
  if (kind === "operations") {
    const rows = daysBetween(from, to).map((date) => {
      const day = inPeriod.filter((request) => luandaDay(request.createdAt) === date);
      const cancelled = day.filter((request) => request.status === "cancelled").length;
      return [
        formatDateNumeric(date),
        day.length,
        day.filter((request) => COMPLETED_STATUSES.includes(request.status)).length,
        cancelled,
        day.length ? Math.round((cancelled / day.length) * 1000) / 10 : 0,
        day.filter((request) => request.scheduledFor).length,
      ];
    });
    const cancelled = inPeriod.filter((request) => request.status === "cancelled").length;
    return {
      kind,
      from,
      to,
      columns: [
        { key: "date", label: "Dia", format: "text" },
        { key: "requests", label: "Pedidos", format: "number" },
        { key: "completed", label: "Concluídos", format: "number" },
        { key: "cancelled", label: "Cancelados", format: "number" },
        { key: "cancelRate", label: "Taxa de cancelamento (%)", format: "percent" },
        { key: "scheduled", label: "Agendados", format: "number" },
      ],
      rows,
      summary: [
        { label: "Pedidos", value: inPeriod.length, format: "number" },
        { label: "Concluídos", value: inPeriod.filter((request) => COMPLETED_STATUSES.includes(request.status)).length, format: "number" },
        { label: "Taxa de cancelamento", value: inPeriod.length ? Math.round((cancelled / inPeriod.length) * 1000) / 10 : 0, format: "percent" },
      ],
    };
  }
  if (kind === "finance") {
    const refunds = state.refunds.filter((refund) => refund.status === "paid" && !refund.chargeProvider && refund.paidAt && inRange(refund.paidAt, { from, to }));
    const rows = daysBetween(from, to).map((date) => {
      const day = settledInPeriod.filter((request) => luandaDay(eventAt(request, "paid") ?? request.createdAt) === date);
      const fees = day.reduce((sum, request) => sum + request.price.platformFee, 0);
      const commissions = day.reduce((sum, request) => sum + commissionOf(request), 0);
      const refunded = refunds.filter((refund) => luandaDay(refund.paidAt ?? "") === date).reduce((sum, refund) => sum + refund.amount, 0);
      return [formatDateNumeric(date), day.reduce((sum, request) => sum + request.price.total, 0), fees, commissions, refunded, fees + commissions - refunded];
    });
    const total = (index: number) => rows.reduce((sum, row) => sum + Number(row[index]), 0);
    return {
      kind,
      from,
      to,
      columns: [
        { key: "date", label: "Dia", format: "text" },
        { key: "volume", label: "Volume (Kz)", format: "kz" },
        { key: "fees", label: "Taxas (Kz)", format: "kz" },
        { key: "commissions", label: "Comissões (Kz)", format: "kz" },
        { key: "refunds", label: "Reembolsos (Kz)", format: "kz" },
        { key: "revenue", label: "Receita líquida (Kz)", format: "kz" },
      ],
      rows,
      summary: [
        { label: "Volume", value: total(1), format: "kz" },
        { label: "Receita líquida", value: total(5), format: "kz" },
        { label: "Reembolsos suportados", value: total(4), format: "kz" },
      ],
    };
  }
  if (kind === "providers") {
    const rows = state.providers
      .filter((provider) => provider.accountStatus !== "pending_approval")
      .map((provider) => {
        const own = inPeriod.filter((request) => request.providerId === provider.id);
        const completed = own.filter((request) => COMPLETED_STATUSES.includes(request.status));
        return [
          provider.name,
          completed.length,
          own.filter((request) => request.status === "cancelled").length,
          completed.reduce((sum, request) => sum + request.providerEarning, 0),
          average(own.flatMap((request) => (request.rating === undefined ? [] : [request.rating]))),
          state.fleets.find((fleet) => fleet.id === provider.fleetId)?.name ?? "Independente",
        ];
      })
      .sort((a, b) => Number(b[3]) - Number(a[3]));
    return {
      kind,
      from,
      to,
      columns: [
        { key: "provider", label: "Prestador", format: "text" },
        { key: "completed", label: "Serviços", format: "number" },
        { key: "cancelled", label: "Cancelados", format: "number" },
        { key: "earnings", label: "Ganhos (Kz)", format: "kz" },
        { key: "rating", label: "Avaliação", format: "decimal" },
        { key: "fleet", label: "Frota", format: "text" },
      ],
      rows,
      summary: [
        { label: "Prestadores com serviços", value: rows.filter((row) => Number(row[1]) > 0).length, format: "number" },
        { label: "Ganhos pagos aos prestadores", value: rows.reduce((sum, row) => sum + Number(row[3]), 0), format: "kz" },
      ],
    };
  }
  if (kind === "zones") {
    const rows = state.zones
      .map((zone) => {
        const own = inPeriod.filter((request) => request.zoneId === zone.id);
        const settled = own.filter(isSettled);
        const volume = settled.reduce((sum, request) => sum + request.price.total, 0);
        return [
          zone.name,
          own.length,
          settled.length,
          volume,
          settled.length ? Math.round(volume / settled.length) : 0,
          state.providers.filter((provider) => provider.accountStatus === "active" && provider.zoneIds.includes(zone.id)).length,
        ];
      })
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    return {
      kind,
      from,
      to,
      columns: [
        { key: "zone", label: "Zona", format: "text" },
        { key: "requests", label: "Pedidos", format: "number" },
        { key: "settled", label: "Pagos", format: "number" },
        { key: "volume", label: "Volume (Kz)", format: "kz" },
        { key: "ticket", label: "Valor médio (Kz)", format: "kz" },
        { key: "providers", label: "Prestadores activos", format: "number" },
      ],
      rows,
      summary: [
        { label: "Zonas", value: rows.length, format: "number" },
        { label: "Volume", value: rows.reduce((sum, row) => sum + Number(row[3]), 0), format: "kz" },
      ],
    };
  }
  const rows = state.businessAccounts.map((account) => {
    const members = new Set(account.clientIds);
    const own = settledInPeriod.filter((request) => members.has(request.clientId));
    const amounts = businessAmounts(own.map((request) => request.price.total), account.contract.discountRate);
    return [account.name, account.clientIds.length, amounts.count, amounts.gross, amounts.discount, amounts.net, businessSummary(state, account, now).outstanding];
  });
  return {
    kind,
    from,
    to,
    columns: [
      { key: "business", label: "Empresa", format: "text" },
      { key: "members", label: "Utilizadores", format: "number" },
      { key: "requests", label: "Pedidos pagos", format: "number" },
      { key: "gross", label: "Bruto (Kz)", format: "kz" },
      { key: "discount", label: "Desconto (Kz)", format: "kz" },
      { key: "net", label: "A facturar (Kz)", format: "kz" },
      { key: "outstanding", label: "Em dívida (Kz)", format: "kz" },
    ],
    rows,
    summary: [
      { label: "A facturar no período", value: rows.reduce((sum, row) => sum + Number(row[5]), 0), format: "kz" },
      { label: "Em dívida hoje", value: rows.reduce((sum, row) => sum + Number(row[6]), 0), format: "kz" },
    ],
  };
}

export function createMockReports(db: MockDatabase): ReportsRepository {
  return {
    run: (kind, range) => db.run({ permission: "reports.view" }, ({ state, now }) => build(state, kind, range.from.slice(0, 10), range.to.slice(0, 10), now)),
  };
}
