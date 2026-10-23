import type { AdminSession } from "@/types/leva-ja";
import type { Repositories } from "../repositories";
import type { HttpClient, HttpClientOptions } from "./client";
import { createHttpClient, polling } from "./client";
import { createOsrmRouting } from "./routing";

export type HttpRepositoriesOptions = Omit<HttpClientOptions, "getToken" | "onUnauthorized"> & {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  pollMs?: number;
  routingUrl?: string;
};

export const HTTP_SESSION_KEY = "levaja.admin.session.v1";

const id = encodeURIComponent;

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

function build(http: HttpClient, session: ReturnType<typeof sessionStore>, pollMs: number): Omit<Repositories, "routing"> {
  const subscribe = polling(pollMs);
  return {
    source: "http",
    demo: null,

    auth: {
      requestCode: (email) => http.post("/auth/request-code", { email }),
      login: async (email, code) => {
        const created = await http.post<AdminSession>("/auth/login", { email, code });
        session.write(created);
        return created;
      },
      currentSession: async () => {
        if (!session.read()) return null;
        try {
          const current = await http.get<AdminSession>("/auth/session");
          session.write(current);
          return current;
        } catch {
          session.write(null);
          return null;
        }
      },
      logout: async () => {
        try {
          await http.post("/auth/logout");
        } finally {
          session.write(null);
        }
      },
      listUsers: () => http.get("/admin/users"),
      createUser: (input, reason) => http.post("/admin/users", { ...input, reason }),
      changeRole: (userId, role, reason) => http.post(`/admin/users/${id(userId)}/role`, { role, reason }),
      setActive: (userId, active, reason) => http.post(`/admin/users/${id(userId)}/${active ? "activate" : "deactivate"}`, { reason }),
    },

    requests: {
      list: (filters = {}) => http.get("/admin/requests", filters),
      get: (requestId) => http.get(`/admin/requests/${id(requestId)}`),
      reassignCandidates: (requestId) => http.get(`/admin/requests/${id(requestId)}/candidates`),
      reassign: (requestId, providerId, reason) => http.post(`/admin/requests/${id(requestId)}/reassign`, { providerId, reason }),
      cancel: (requestId, reason) => http.post(`/admin/requests/${id(requestId)}/cancel`, { reason }),
      openDispute: (requestId, reason, category) => http.post(`/admin/requests/${id(requestId)}/dispute`, { reason, category }),
      forceComplete: (requestId, reason) => http.post(`/admin/requests/${id(requestId)}/force-complete`, { reason }),
      active: () => http.get("/admin/requests/active"),
      subscribe: (listener) => subscribe("requests", listener),
    },

    operations: {
      scheduled: (filters = {}) => http.get("/admin/requests/scheduled", filters),
      sla: (range) => http.get("/admin/metrics/sla", range),
      heatmap: (query) => http.get("/admin/metrics/heatmap", query),
    },

    claims: {
      list: (filters = {}) => http.get("/admin/claims", filters),
      summary: () => http.get("/admin/claims/summary"),
      get: (claimId) => http.get(`/admin/claims/${id(claimId)}`),
      forRequest: (requestId) => http.get(`/admin/requests/${id(requestId)}/claims`),
      report: (input) => http.post("/admin/claims", input),
      startReview: (claimId, insurer, policyNumber) => http.post(`/admin/claims/${id(claimId)}/review`, { insurer, policyNumber }),
      addNote: (claimId, text) => http.post(`/admin/claims/${id(claimId)}/notes`, { text }),
      approve: (claimId, amount, reason) => http.post(`/admin/claims/${id(claimId)}/approve`, { amount, reason }),
      reject: (claimId, reason) => http.post(`/admin/claims/${id(claimId)}/reject`, { reason }),
      markPaid: (claimId, paymentReference) => http.post(`/admin/claims/${id(claimId)}/paid`, { paymentReference }),
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
      setStatus: (fleetId, status, reason) => http.post(`/admin/fleets/${id(fleetId)}/${status === "suspended" ? "suspend" : "reactivate"}`, { reason }),
    },

    quality: {
      scores: (filters = {}) => http.get("/admin/quality", filters),
      provider: (providerId) => http.get(`/admin/quality/${id(providerId)}`),
      penalties: (filters = {}) => http.get("/admin/penalties", filters),
      penalize: (providerId, input) => http.post(`/admin/providers/${id(providerId)}/penalties`, input),
      revoke: (penaltyId, reason) => http.post(`/admin/penalties/${id(penaltyId)}/revoke`, { reason }),
    },

    disputes: {
      list: (filters = {}) => http.get("/admin/disputes", filters),
      summary: () => http.get("/admin/disputes/summary"),
      addNote: (requestId, text) => http.post(`/admin/disputes/${id(requestId)}/notes`, { text }),
      setCategory: (requestId, category) => http.put(`/admin/disputes/${id(requestId)}/category`, { category }),
      resolve: (requestId, input) => http.post(`/admin/disputes/${id(requestId)}/resolve`, input),
    },

    refunds: {
      list: (filters = {}) => http.get("/admin/refunds", filters),
      summary: () => http.get("/admin/refunds/summary"),
      forRequest: (requestId) => http.get(`/admin/requests/${id(requestId)}/refunds`),
      create: (input) => http.post("/admin/refunds", input),
      approve: (refundId, reason) => http.post(`/admin/refunds/${id(refundId)}/approve`, { reason }),
      reject: (refundId, reason) => http.post(`/admin/refunds/${id(refundId)}/reject`, { reason }),
      markPaid: (refundId, paymentReference) => http.post(`/admin/refunds/${id(refundId)}/paid`, { paymentReference }),
    },

    providers: {
      list: (filters = {}) => http.get("/admin/providers", filters),
      get: (providerId) => http.get(`/providers/${id(providerId)}`),
      approve: (providerId, reason) => http.post(`/admin/providers/${id(providerId)}/approve`, { reason }),
      suspend: (providerId, reason) => http.post(`/admin/providers/${id(providerId)}/suspend`, { reason }),
      reactivate: (providerId, reason) => http.post(`/admin/providers/${id(providerId)}/reactivate`, { reason }),
      transactions: (providerId, query = {}) => http.get(`/providers/${id(providerId)}/earnings`, query),
      reviews: (providerId, query = {}) => http.get(`/providers/${id(providerId)}/reviews`, query),
      requests: (providerId, query = {}) => http.get(`/admin/providers/${id(providerId)}/requests`, query),
      positions: () => http.get("/admin/providers/positions"),
      subscribe: (listener) => subscribe("providers", listener),
    },

    documents: {
      queue: (filters = {}) => http.get("/admin/documents", filters),
      expiring: (withinDays) => http.get("/admin/documents/expiring", { withinDays }),
      approve: (documentId, validUntil) => http.post(`/admin/documents/${id(documentId)}/approve`, { validUntil }),
      reject: (documentId, reason) => http.post(`/admin/documents/${id(documentId)}/reject`, { reason }),
    },

    clients: {
      list: (filters = {}) => http.get("/admin/clients", filters),
      get: (clientId) => http.get(`/clients/${id(clientId)}`),
      requests: (clientId, query = {}) => http.get(`/admin/clients/${id(clientId)}/requests`, query),
      reviewsGiven: (clientId) => http.get(`/admin/clients/${id(clientId)}/reviews`),
      tickets: (clientId) => http.get(`/admin/clients/${id(clientId)}/tickets`),
      block: (clientId, reason) => http.post(`/admin/clients/${id(clientId)}/block`, { reason }),
      unblock: (clientId, reason) => http.post(`/admin/clients/${id(clientId)}/unblock`, { reason }),
    },

    finance: {
      revenue: (range) => http.get("/admin/revenue", range),
      withdrawals: (filters = {}) => http.get("/admin/withdrawals", filters),
      requestWithdrawal: (providerId, amount) => http.post("/admin/withdrawals", { providerId, amount }),
      approveWithdrawal: (withdrawalId) => http.post(`/admin/withdrawals/${id(withdrawalId)}/approve`),
      rejectWithdrawal: (withdrawalId, reason) => http.post(`/admin/withdrawals/${id(withdrawalId)}/reject`, { reason }),
      markWithdrawalPaid: (withdrawalId, paymentReference) => http.post(`/admin/withdrawals/${id(withdrawalId)}/paid`, { paymentReference }),
      transactions: (filters = {}) => http.get("/admin/transactions", filters),
      exportTransactions: (filters = {}) => http.get("/admin/transactions/export", filters),
      batches: (filters = {}) => http.get("/admin/payout-batches", filters),
      batch: (batchId) => http.get(`/admin/payout-batches/${id(batchId)}`),
      createBatch: (withdrawalIds) => http.post("/admin/payout-batches", { withdrawalIds }),
      sendBatch: (batchId) => http.post(`/admin/payout-batches/${id(batchId)}/send`),
      markBatchPaid: (batchId, bankReference) => http.post(`/admin/payout-batches/${id(batchId)}/paid`, { bankReference }),
      cancelBatch: (batchId, reason) => http.post(`/admin/payout-batches/${id(batchId)}/cancel`, { reason }),
    },

    billing: {
      invoices: (filters = {}) => http.get("/admin/invoices", filters),
      exportInvoices: (filters = {}) => http.get("/admin/invoices/export", filters),
      invoice: (invoiceId) => http.get(`/admin/invoices/${id(invoiceId)}`),
      settlements: (filters) => http.get("/admin/settlements", filters),
      registerSettlement: (settlementId, amount, reference) => http.post(`/admin/settlements/${id(settlementId)}/received`, { amount, reference }),
      resolveSettlement: (settlementId, resolution) => http.post(`/admin/settlements/${id(settlementId)}/resolve`, { resolution }),
      cashDebts: (filters = {}) => http.get("/admin/cash-debts", filters),
      cashDeposits: (providerId) => http.get(`/admin/cash-debts/${id(providerId)}/deposits`),
      registerCashDeposit: (providerId, amount, reference) => http.post(`/admin/cash-debts/${id(providerId)}/deposits`, { amount, reference }),
    },

    pricing: {
      get: () => http.get("/admin/pricing"),
      update: (update, reason) => http.put("/admin/pricing", { ...update, reason }),
    },

    zones: {
      list: () => http.get("/admin/zones"),
      create: (input, reason) => http.post("/admin/zones", { ...input, reason }),
      update: (zoneId, input, reason) => http.put(`/admin/zones/${id(zoneId)}`, { ...input, reason }),
      remove: (zoneId, reason) => http.del(`/admin/zones/${id(zoneId)}`, { reason }),
    },

    support: {
      assignees: () => http.get("/admin/tickets/assignees"),
      tickets: (filters = {}) => http.get("/admin/tickets", filters),
      ticket: (ticketId) => http.get(`/admin/tickets/${id(ticketId)}`),
      assignTicket: (ticketId, adminId) => http.post(`/admin/tickets/${id(ticketId)}/assign`, { adminId }),
      replyTicket: (ticketId, body) => http.post(`/admin/tickets/${id(ticketId)}/reply`, { body }),
      resolveTicket: (ticketId, resolution) => http.post(`/admin/tickets/${id(ticketId)}/resolve`, { resolution }),
      sosAlerts: (status) => http.get("/admin/sos", { status }),
      acknowledgeSos: (sosId) => http.post(`/admin/sos/${id(sosId)}/acknowledge`),
      resolveSos: (sosId, resolution) => http.post(`/admin/sos/${id(sosId)}/resolve`, { resolution }),
      lowRatings: (query = {}) => http.get("/admin/reviews/low", query),
      markReviewHandled: (reviewId, note) => http.post(`/admin/reviews/${id(reviewId)}/handled`, { note }),
      subscribe: (listener) => subscribe("support", listener),
    },

    metrics: {
      overview: (range) => http.get("/admin/metrics", range),
      attention: () => http.get("/admin/metrics/attention"),
    },

    audit: {
      list: (filters = {}) => http.get("/admin/audit", filters),
    },

    settings: {
      get: () => http.get("/admin/settings"),
      update: (section, value, reason) => http.put(`/admin/settings/${id(section)}`, { value, reason }),
      rolePermissions: () => http.get("/admin/roles"),
      updateRolePermissions: (matrix, reason) => http.put("/admin/roles", { matrix, reason }),
    },
  };
}

export function createHttpRepositories(options: HttpRepositoriesOptions): Repositories {
  const session = sessionStore(options.storage ?? null);
  const http = createHttpClient({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    getToken: () => session.read()?.token ?? null,
    onUnauthorized: () => session.write(null),
  });
  return { ...build(http, session, options.pollMs ?? 15_000), routing: createOsrmRouting({ baseUrl: options.routingUrl, fetch: options.fetch }) };
}
