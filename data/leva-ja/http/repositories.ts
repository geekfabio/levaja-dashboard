import { dispatchStartsAt } from "@/lib/leva-ja/scheduling";
import { isDisputeOverdue } from "@/lib/leva-ja/refunds";
import type { AdminSession, ServiceRequest, SosAlert, Transaction } from "@/types/leva-ja";
import type { DisputeCase } from "../repositories/disputes";
import type { Repositories } from "../repositories";
import type { Page } from "../repositories/common";
import type { RequestRefunds } from "../repositories/refunds";
import type { ScheduledReport } from "../repositories/operations";
import type { ReassignCandidate } from "../repositories/requests";
import type { AttentionItems } from "../repositories/metrics";
import type { HttpClient, HttpClientOptions } from "./client";
import { createHttpClient, polling } from "./client";
import { createOsrmRouting } from "./routing";
import {
  mapPage,
  toClientAccount,
  toDisputeCase,
  toDisputedRequest,
  toProviderAccount,
  toProviderPosition,
  toRefund,
  toReviewItem,
  toServiceRequest,
  toSession,
  toSos,
  toZone,
  type Dto,
} from "./mappers";

export type HttpRepositoriesOptions = Omit<HttpClientOptions, "getCsrfToken" | "onUnauthorized"> & {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  pollMs?: number;
  routingUrl?: string;
};

export const HTTP_SESSION_KEY = "levaja.admin.session.v1";

const id = encodeURIComponent;

function toWireContract(contract: { startsAt: string; endsAt: string; discountRate: number; paymentTermsDays: number; creditLimit: number }) {
  return {
    startsAt: contract.startsAt,
    endsAt: contract.endsAt,
    discountRate: contract.discountRate,
    paymentTermsDays: contract.paymentTermsDays,
    creditLimitKz: contract.creditLimit,
  };
}

function sessionStore(storage: HttpRepositoriesOptions["storage"]) {
  return {
    read(): AdminSession | null {
      try {
        const raw = storage?.getItem(HTTP_SESSION_KEY);
        return raw ? (JSON.parse(raw) as AdminSession) : null;
      } catch {
        return null;
      }
    },
    write(session: AdminSession | null) {
      try {
        if (session) storage?.setItem(HTTP_SESSION_KEY, JSON.stringify(session));
        else storage?.removeItem(HTTP_SESSION_KEY);
      } catch {}
    },
  };
}

type Listed<T> = Page<T>;

async function attention(http: HttpClient): Promise<AttentionItems> {
  const STALLED_FALLBACK_MINUTES = 15;
  const LEAD_FALLBACK_MINUTES = 60;
  const settled = async <T>(request: Promise<T>, fallback: T) => {
    try {
      return await request;
    } catch {
      return fallback;
    }
  };
  const empty = <T>(): Listed<T> => ({ items: [], total: 0, page: 1, pageSize: 0 });
  const [searching, settings, sos, documents, withdrawals, disputes, overdue, refunds] = await Promise.all([
    settled(http.get<Listed<Dto>>("/admin/requests", { status: ["searching"], pageSize: 100 }).then((page) => mapPage(page, toServiceRequest)), empty<ServiceRequest>()),
    settled(http.get<{ dispatch: { stalledAfterMinutes: number; scheduleLeadMinutes: number } }>("/admin/settings"), null),
    settled(http.get<Dto[]>("/admin/support/sos", { status: ["open", "acknowledged"] }).then((list) => list.map(toSos)), [] as SosAlert[]),
    settled(http.get<Listed<Dto>>("/admin/documents", { state: ["pending", "needs_update"], pageSize: 5 }).then((page) => mapPage(page, toReviewItem)), empty<AttentionItems["pendingDocuments"][number]>()),
    settled(http.get<Listed<AttentionItems["pendingWithdrawals"][number]>>("/admin/finance/withdrawals", { status: ["pending"], pageSize: 5 }), empty<AttentionItems["pendingWithdrawals"][number]>()),
    settled(http.get<Listed<Dto>>("/admin/disputes", { state: "open", pageSize: 5 }).then((page) => mapPage(page, toDisputeCase)), empty<DisputeCase>()),
    settled(http.get<Listed<Dto>>("/admin/disputes", { state: "overdue", pageSize: 1 }).then((page) => mapPage(page, toDisputeCase)), empty<DisputeCase>()),
    settled(http.get<Listed<Dto>>("/admin/refunds", { status: ["pending"], pageSize: 5 }).then((page) => mapPage(page, toRefund)), empty<AttentionItems["pendingRefunds"][number]>()),
  ]);
  const stalledAfter = (settings?.dispatch.stalledAfterMinutes ?? STALLED_FALLBACK_MINUTES) * 60_000;
  const lead = settings?.dispatch.scheduleLeadMinutes ?? LEAD_FALLBACK_MINUTES;
  const threshold = Date.now() - stalledAfter;
  return {
    stalledSearching: searching.items.filter((request) => dispatchStartsAt(request, lead) <= threshold).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    openSos: sos,
    pendingDocuments: documents.items,
    pendingDocumentsTotal: documents.total,
    pendingWithdrawals: withdrawals.items,
    pendingWithdrawalsTotal: withdrawals.total,
    openDisputes: disputes.items.map((item) => item.request),
    openDisputesTotal: disputes.total,
    overdueDisputesTotal: overdue.total || disputes.items.filter((item) => item.request.dispute && isDisputeOverdue(item.request.dispute, Date.now())).length,
    pendingRefunds: refunds.items,
    pendingRefundsTotal: refunds.total,
  };
}

function build(http: HttpClient, session: ReturnType<typeof sessionStore>, pollMs: number): Omit<Repositories, "routing"> {
  const subscribe = polling(pollMs);
  return {
    source: "http",
    demo: null,

    auth: {
      requestCode: (email) => http.post("/admin/auth/request-code", { email }),
      login: async (email, code, otp) => {
        const created = await http.post<AdminSession>("/admin/auth/login", { email, code, otp });
        session.write(created);
        return created;
      },
      currentSession: async () => {
        if (!session.read()) return null;
        try {
          const current = await http.get<AdminSession | null>("/admin/auth/session");
          if (current) session.write({ ...current, csrfToken: session.read()?.csrfToken });
          else session.write(null);
          return current;
        } catch {
          session.write(null);
          return null;
        }
      },
      logout: async () => {
        try {
          await http.post("/admin/auth/logout");
        } finally {
          session.write(null);
        }
      },
      listUsers: () => http.get("/admin/users"),
      createUser: (input, reason) => http.post("/admin/users", { ...input, reason }),
      changeRole: (userId, role, reason) => http.patch(`/admin/users/${id(userId)}/role`, { role, reason }),
      setActive: (userId, active, reason) => http.patch(`/admin/users/${id(userId)}/active`, { active, reason }),
    },

    requests: {
      list: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/requests", filters), toServiceRequest),
      get: async (requestId) => toServiceRequest(await http.get<Dto>(`/admin/requests/${id(requestId)}`)),
      reassignCandidates: async (requestId) =>
        (await http.get<Dto[]>(`/admin/requests/${id(requestId)}/reassign-candidates`)).map((candidate) => ({ ...candidate, provider: toProviderAccount(candidate.provider) }) as ReassignCandidate),
      reassign: async (requestId, providerId, reason) => toServiceRequest(await http.post<Dto>(`/admin/requests/${id(requestId)}/reassign`, { providerId, reason })),
      cancel: async (requestId, reason) => toServiceRequest(await http.post<Dto>(`/admin/requests/${id(requestId)}/cancel`, { reason })),
      openDispute: async (requestId, reason, category) => toServiceRequest(await http.post<Dto>(`/admin/requests/${id(requestId)}/dispute`, { reason, category })),
      forceComplete: async (requestId, reason) => toServiceRequest(await http.post<Dto>(`/admin/requests/${id(requestId)}/force-complete`, { reason })),
      active: async () => (await http.get<Dto[]>("/admin/requests/active")).map(toServiceRequest),
      subscribe: (listener) => subscribe("requests", listener),
    },

    privacy: {
      list: (filters = {}) => http.get("/admin/privacy/requests", filters),
      summary: () => http.get("/admin/privacy/summary"),
      get: (requestId) => http.get(`/admin/privacy/requests/${id(requestId)}`),
      start: (requestId) => http.post(`/admin/privacy/requests/${id(requestId)}/start`),
      complete: (requestId, resolution) => http.post(`/admin/privacy/requests/${id(requestId)}/complete`, { resolution }),
      reject: (requestId, reason) => http.post(`/admin/privacy/requests/${id(requestId)}/reject`, { reason }),
      exportData: (requestId) => http.post(`/admin/privacy/requests/${id(requestId)}/export`),
    },

    security: {
      sessions: async () => (await http.get<Dto[]>("/admin/security/sessions")).map(toSession),
      revokeSession: async (sessionId, reason) => (await http.post<Dto[]>(`/admin/security/sessions/${id(sessionId)}/revoke`, { reason })).map(toSession),
      accessLog: (filters = {}) => http.get("/admin/security/access-log", filters),
      setTwoFactor: (userId, enabled, reason) => http.post(`/admin/security/users/${id(userId)}/two-factor`, { enabled, reason }),
    },

    integrations: {
      keys: () => http.get("/admin/integrations/keys"),
      createKey: (name, scopes, expiresInDays) => http.post("/admin/integrations/keys", { name, scopes, expiresInDays }),
      revokeKey: (keyId, reason) => http.post(`/admin/integrations/keys/${id(keyId)}/revoke`, { reason }),
      webhooks: () => http.get("/admin/integrations/webhooks"),
      createWebhook: (input) => http.post("/admin/integrations/webhooks", input),
      setWebhookActive: (webhookId, active) => http.post(`/admin/integrations/webhooks/${id(webhookId)}/active`, { active }),
      testWebhook: (webhookId) => http.post(`/admin/integrations/webhooks/${id(webhookId)}/test`),
    },

    business: {
      list: (filters = {}) => http.get("/admin/business-accounts", filters),
      get: (accountId) => http.get(`/admin/business-accounts/${id(accountId)}`),
      candidates: () => http.get("/admin/business-accounts/candidates"),
      create: (input) => http.post("/admin/business-accounts", { ...input, contract: toWireContract(input.contract) }),
      updateContract: (accountId, contract, reason) => http.put(`/admin/business-accounts/${id(accountId)}/contract`, { contract: toWireContract(contract), reason }),
      addMember: (accountId, clientId) => http.post(`/admin/business-accounts/${id(accountId)}/members`, { clientId }),
      removeMember: (accountId, clientId, reason) => http.post(`/admin/business-accounts/${id(accountId)}/members/${id(clientId)}/remove`, { reason }),
      markStatementPaid: (accountId, month, reference) => http.post(`/admin/business-accounts/${id(accountId)}/statements/${id(month)}/paid`, { reference }),
      setStatus: (accountId, status, reason) => http.post(`/admin/business-accounts/${id(accountId)}/${status === "suspended" ? "suspend" : "reactivate"}`, { reason }),
    },

    promotions: {
      list: (filters = {}) => http.get("/admin/promotions", filters),
      get: (promotionId) => http.get(`/admin/promotions/${id(promotionId)}`),
      create: (input) =>
        http.post("/admin/promotions", {
          code: input.code,
          name: input.name,
          kind: input.kind,
          value: input.value,
          maxDiscountKz: input.maxDiscount,
          minOrderKz: input.minOrder,
          services: input.services,
          zoneIds: input.zoneIds,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          budgetKz: input.budget,
          perClientLimit: input.perClientLimit,
          firstOrderOnly: input.firstOrderOnly,
        }),
      pause: (promotionId, reason) => http.post(`/admin/promotions/${id(promotionId)}/pause`, { reason }),
      resume: (promotionId) => http.post(`/admin/promotions/${id(promotionId)}/resume`),
      end: (promotionId, reason) => http.post(`/admin/promotions/${id(promotionId)}/end`, { reason }),
    },

    communications: {
      list: (filters = {}) => http.get("/admin/communications", filters),
      estimate: (audience) => http.post("/admin/communications/estimate", audience),
      create: (input) => http.post("/admin/communications", input),
      schedule: (broadcastId, at) => http.post(`/admin/communications/${id(broadcastId)}/schedule`, { at }),
      send: (broadcastId) => http.post(`/admin/communications/${id(broadcastId)}/send`),
      cancel: (broadcastId, reason) => http.post(`/admin/communications/${id(broadcastId)}/cancel`, { reason }),
    },

    reports: {
      run: (kind, range) => http.get(`/admin/reports/${id(kind)}`, range),
    },

    operations: {
      scheduled: async (filters = {}) => {
        const report = await http.get<{ items: Dto[]; totals: ScheduledReport["totals"] }>("/admin/operations/scheduled", filters);
        return { ...report, items: report.items.map(toServiceRequest) };
      },
      sla: (range) => http.get("/admin/operations/sla", range),
      heatmap: (query) => http.get("/admin/operations/heatmap", query),
    },

    claims: {
      list: (filters = {}) => http.get("/admin/claims", filters),
      summary: () => http.get("/admin/claims/summary"),
      get: (claimId) => http.get(`/admin/claims/${id(claimId)}`),
      forRequest: (requestId) => http.get(`/admin/requests/${id(requestId)}/claims`),
      report: (input) =>
        http.post("/admin/claims", {
          requestId: input.requestId,
          kind: input.kind,
          description: input.description,
          estimatedAmountKz: input.estimatedAmount,
          occurredAt: input.occurredAt,
        }),
      startReview: (claimId, insurer, policyNumber) => http.post(`/admin/claims/${id(claimId)}/start-review`, { insurer, policyNumber }),
      addNote: (claimId, text) => http.post(`/admin/claims/${id(claimId)}/notes`, { text }),
      approve: (claimId, amount, reason) => http.post(`/admin/claims/${id(claimId)}/approve`, { amountKz: amount, reason }),
      reject: (claimId, reason) => http.post(`/admin/claims/${id(claimId)}/reject`, { reason }),
      markPaid: (claimId, paymentReference) => http.post(`/admin/claims/${id(claimId)}/mark-paid`, { paymentReference }),
    },

    applications: {
      list: (filters = {}) => http.get("/admin/applications", filters),
      get: (applicationId) => http.get(`/admin/applications/${id(applicationId)}`),
      summary: () => http.get("/admin/applications/summary"),
      receiveDocument: (applicationId, icon) => http.post(`/admin/applications/${id(applicationId)}/documents`, { icon }),
      scheduleInterview: (applicationId, at) => http.post(`/admin/applications/${id(applicationId)}/interview`, { at }),
      recordInspection: (applicationId, passed, notes) => http.post(`/admin/applications/${id(applicationId)}/inspection`, { passed, notes }),
      advance: (applicationId, note) => http.post(`/admin/applications/${id(applicationId)}/advance`, { note }),
      approve: (applicationId, reason) => http.post(`/admin/applications/${id(applicationId)}/approve`, { reason }),
      reject: (applicationId, reason) => http.post(`/admin/applications/${id(applicationId)}/reject`, { reason }),
    },

    fleets: {
      list: (filters = {}) => http.get("/admin/fleets", filters),
      get: (fleetId) => http.get(`/admin/fleets/${id(fleetId)}`),
      create: (input) => http.post("/admin/fleets", input),
      addDriver: (fleetId, providerId) => http.post(`/admin/fleets/${id(fleetId)}/drivers`, { providerId }),
      removeDriver: (fleetId, providerId, reason) => http.post(`/admin/fleets/${id(fleetId)}/drivers/${id(providerId)}/remove`, { reason }),
      setStatus: (fleetId, status, reason) => http.post(`/admin/fleets/${id(fleetId)}/status`, { status, reason }),
    },

    quality: {
      scores: (filters = {}) => http.get("/admin/quality", filters),
      provider: (providerId) => http.get(`/admin/quality/${id(providerId)}`),
      penalties: (filters = {}) => http.get("/admin/penalties", filters),
      penalize: (providerId, input) => http.post(`/admin/providers/${id(providerId)}/penalties`, input),
      revoke: (penaltyId, reason) => http.post(`/admin/penalties/${id(penaltyId)}/revoke`, { reason }),
    },

    disputes: {
      list: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/disputes", filters), toDisputeCase),
      summary: () => http.get("/admin/disputes/summary"),
      addNote: async (requestId, text) => toDisputedRequest(await http.post<Dto>(`/admin/disputes/${id(requestId)}/notes`, { text })),
      setCategory: async (requestId, category) => toDisputedRequest(await http.patch<Dto>(`/admin/disputes/${id(requestId)}/category`, { category })),
      resolve: async (requestId, input) =>
        toDisputedRequest(
          await http.post<Dto>(`/admin/disputes/${id(requestId)}/resolve`, {
            outcome: input.outcome,
            amountKz: input.amount,
            chargeProvider: input.chargeProvider,
            resolution: input.resolution,
          }),
        ),
    },

    refunds: {
      list: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/refunds", filters), toRefund),
      summary: () => http.get("/admin/refunds/summary"),
      forRequest: async (requestId) => {
        const result = await http.get<Dto>(`/admin/requests/${id(requestId)}/refunds`);
        return { ...result, refunds: (result.refunds ?? []).map(toRefund) } as RequestRefunds;
      },
      create: async (input) =>
        toRefund(
          await http.post<Dto>("/admin/refunds", {
            requestId: input.requestId,
            amountKz: input.amount,
            reason: input.reason,
            chargeProvider: input.chargeProvider,
          }),
        ),
      approve: async (refundId, reason) => toRefund(await http.post<Dto>(`/admin/refunds/${id(refundId)}/approve`, { reason })),
      reject: async (refundId, reason) => toRefund(await http.post<Dto>(`/admin/refunds/${id(refundId)}/reject`, { reason })),
      markPaid: async (refundId, paymentReference) => toRefund(await http.post<Dto>(`/admin/refunds/${id(refundId)}/mark-paid`, { paymentReference })),
    },

    providers: {
      list: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/providers", filters), toProviderAccount),
      get: async (providerId) => toProviderAccount(await http.get<Dto>(`/admin/providers/${id(providerId)}`)),
      approve: async (providerId, reason) => toProviderAccount(await http.post<Dto>(`/admin/providers/${id(providerId)}/approve`, { reason })),
      suspend: async (providerId, reason) => toProviderAccount(await http.post<Dto>(`/admin/providers/${id(providerId)}/suspend`, { reason })),
      reactivate: async (providerId, reason) => toProviderAccount(await http.post<Dto>(`/admin/providers/${id(providerId)}/reactivate`, { reason })),
      transactions: async (providerId, query = {}) =>
        mapPage(await http.get<Page<Dto>>(`/admin/providers/${id(providerId)}/transactions`, query), (item) => ({ ...item, serviceKind: item.serviceType ?? undefined }) as Transaction),
      reviews: (providerId, query = {}) => http.get(`/admin/providers/${id(providerId)}/reviews`, query),
      requests: async (providerId, query = {}) => mapPage(await http.get<Page<Dto>>(`/admin/providers/${id(providerId)}/requests`, query), toServiceRequest),
      positions: async () => (await http.get<Dto[]>("/admin/providers/positions")).map(toProviderPosition),
      subscribe: (listener) => subscribe("providers", listener),
    },

    documents: {
      queue: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/documents", filters), toReviewItem),
      expiring: async (withinDays) => (await http.get<Dto[]>("/admin/documents/expiring", { withinDays })).map(toReviewItem),
      approve: async (documentId, validUntil) => toReviewItem(await http.post<Dto>(`/admin/documents/${id(documentId)}/approve`, { validUntil })),
      reject: async (documentId, reason) => toReviewItem(await http.post<Dto>(`/admin/documents/${id(documentId)}/reject`, { reason })),
    },

    clients: {
      list: async (filters = {}) => mapPage(await http.get<Page<Dto>>("/admin/clients", filters), toClientAccount),
      get: async (clientId) => toClientAccount(await http.get<Dto>(`/admin/clients/${id(clientId)}`)),
      requests: async (clientId, query = {}) => mapPage(await http.get<Page<Dto>>(`/admin/clients/${id(clientId)}/requests`, query), toServiceRequest),
      reviewsGiven: (clientId) => http.get(`/admin/clients/${id(clientId)}/reviews`),
      tickets: (clientId) => http.get(`/admin/clients/${id(clientId)}/tickets`),
      block: async (clientId, reason) => toClientAccount(await http.post<Dto>(`/admin/clients/${id(clientId)}/block`, { reason })),
      unblock: async (clientId, reason) => toClientAccount(await http.post<Dto>(`/admin/clients/${id(clientId)}/unblock`, { reason })),
    },

    finance: {
      revenue: (range) => http.get("/admin/finance/revenue", range),
      withdrawals: (filters = {}) => http.get("/admin/finance/withdrawals", filters),
      requestWithdrawal: (providerId, amount) => http.post("/admin/finance/withdrawals", { providerId, amountKz: amount }),
      approveWithdrawal: (withdrawalId) => http.post(`/admin/finance/withdrawals/${id(withdrawalId)}/approve`),
      rejectWithdrawal: (withdrawalId, reason) => http.post(`/admin/finance/withdrawals/${id(withdrawalId)}/reject`, { reason }),
      markWithdrawalPaid: (withdrawalId, paymentReference) => http.post(`/admin/finance/withdrawals/${id(withdrawalId)}/mark-paid`, { paymentReference }),
      transactions: (filters = {}) => http.get("/admin/finance/transactions", filters),
      exportTransactions: (filters = {}) => http.get("/admin/finance/transactions/export", filters),
      batches: (filters = {}) => http.get("/admin/finance/batches", filters),
      batch: (batchId) => http.get(`/admin/finance/batches/${id(batchId)}`),
      createBatch: (withdrawalIds) => http.post("/admin/finance/batches", { withdrawalIds }),
      sendBatch: (batchId) => http.post(`/admin/finance/batches/${id(batchId)}/send`),
      markBatchPaid: (batchId, bankReference) => http.post(`/admin/finance/batches/${id(batchId)}/mark-paid`, { bankReference }),
      cancelBatch: (batchId, reason) => http.post(`/admin/finance/batches/${id(batchId)}/cancel`, { reason }),
    },

    billing: {
      invoices: (filters = {}) => http.get("/admin/billing/invoices", filters),
      exportInvoices: (filters = {}) => http.get("/admin/billing/invoices/export", filters),
      invoice: (invoiceId) => http.get(`/admin/billing/invoices/${id(invoiceId)}`),
      settlements: (filters) => http.get("/admin/billing/settlements", filters),
      registerSettlement: (settlementId, amount, reference) => http.post(`/admin/billing/settlements/${id(settlementId)}/register`, { amountKz: amount, reference }),
      resolveSettlement: (settlementId, resolution) => http.post(`/admin/billing/settlements/${id(settlementId)}/resolve`, { resolution }),
      cashDebts: (filters = {}) => http.get("/admin/billing/cash-debts", filters),
      cashDeposits: (providerId) => http.get("/admin/billing/cash-deposits", { providerId }),
      registerCashDeposit: (providerId, amount, reference) => http.post("/admin/billing/cash-deposits", { providerId, amountKz: amount, reference }),
    },

    pricing: {
      get: () => http.get("/admin/pricing"),
      update: (update, reason) => {
        const { driverBonus, referralInviteeDiscount, referralInviterDiscount, ...rest } = update;
        return http.put("/admin/pricing", { ...rest, driverBonusKz: driverBonus, referralInviteeDiscountKz: referralInviteeDiscount, referralInviterDiscountKz: referralInviterDiscount, reason });
      },
    },

    zones: {
      list: async () => (await http.get<Dto[]>("/admin/zones")).map(toZone),
      create: async (input, reason) => toZone(await http.post<Dto>("/admin/zones", { ...input, reason })),
      update: async (zoneId, input, reason) => toZone(await http.patch<Dto>(`/admin/zones/${id(zoneId)}`, { ...input, reason })),
      remove: (zoneId, reason) => http.del(`/admin/zones/${id(zoneId)}`, { reason }),
    },

    support: {
      assignees: () => http.get("/admin/support/assignees"),
      tickets: (filters = {}) => http.get("/admin/support/tickets", filters),
      ticket: (ticketId) => http.get(`/admin/support/tickets/${id(ticketId)}`),
      assignTicket: (ticketId, adminId) => http.post(`/admin/support/tickets/${id(ticketId)}/assign`, { assigneeId: adminId }),
      replyTicket: (ticketId, body) => http.post(`/admin/support/tickets/${id(ticketId)}/reply`, { body }),
      resolveTicket: (ticketId, resolution) => http.post(`/admin/support/tickets/${id(ticketId)}/resolve`, { resolution }),
      sosAlerts: async (status) => (await http.get<Dto[]>("/admin/support/sos", { status })).map(toSos),
      acknowledgeSos: async (sosId) => toSos(await http.post<Dto>(`/admin/support/sos/${id(sosId)}/acknowledge`)),
      resolveSos: async (sosId, resolution) => toSos(await http.post<Dto>(`/admin/support/sos/${id(sosId)}/resolve`, { resolution })),
      lowRatings: (query = {}) => http.get("/admin/support/low-ratings", query),
      responseSummary: () => http.get("/admin/support/response-summary"),
      satisfaction: () => http.get("/admin/support/satisfaction"),
      markReviewHandled: (reviewId, note) => http.post(`/admin/support/low-ratings/${id(reviewId)}/handle`, { note }),
      emergencyContacts: () => http.get("/admin/support/emergency-contacts"),
      createEmergencyContact: (input, reason) => http.post("/admin/support/emergency-contacts", { ...input, reason }),
      updateEmergencyContact: (contactId, input, reason) => http.patch(`/admin/support/emergency-contacts/${id(contactId)}`, { ...input, reason }),
      removeEmergencyContact: (contactId, reason) => http.del(`/admin/support/emergency-contacts/${id(contactId)}`, { reason }),
      subscribe: (listener) => subscribe("support", listener),
    },

    metrics: {
      overview: (range) => http.get("/admin/metrics", range),
      attention: () => attention(http),
    },

    audit: {
      list: (filters = {}) => http.get("/admin/audit", filters),
    },

    settings: {
      get: () => http.get("/admin/settings"),
      update: (section, value, reason) => http.put(`/admin/settings/${id(section)}`, { value, reason }),
      rolePermissions: () => http.get("/admin/settings/roles"),
      updateRolePermissions: (matrix, reason) => http.put("/admin/settings/roles", { matrix, reason }),
    },
  };
}

export function readAdminCsrfToken(storage: HttpRepositoriesOptions["storage"]): string | null {
  return sessionStore(storage).read()?.csrfToken ?? null;
}

export function createHttpRepositories(options: HttpRepositoriesOptions): Repositories {
  const session = sessionStore(options.storage ?? null);
  const http = createHttpClient({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    getCsrfToken: () => session.read()?.csrfToken ?? null,
    onUnauthorized: () => session.write(null),
  });
  return { ...build(http, session, options.pollMs ?? 15_000), routing: createOsrmRouting({ baseUrl: options.routingUrl, fetch: options.fetch }) };
}
