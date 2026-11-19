import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import type { Column } from "drizzle-orm";
import { db, schema } from "../../src/db/client";
import { newId } from "../../src/lib/ids";

/**
 * Rows that make the admin API return something in every list, so the panel can be
 * checked against real data. Everything is tagged "teste-contrato" and is removed by
 * `deletePanelFixtures` (zones and other leaf rows first, accounts last).
 */
export type PanelFixtureIds = {
  adminEmail: string;
  adminId: string;
  clientIds: string[];
  providerIds: string[];
  zoneIds: string[];
  requestIds: string[];
  disputeIds: string[];
  refundIds: string[];
  withdrawalIds: string[];
  cashDepositIds: string[];
  walletTransactionIds: string[];
  sosIds: string[];
  promotionIds: string[];
  vehicleIds: string[];
  documentIds: string[];
  ticketIds: string[];
  privacyIds: string[];
  fleetIds: string[];
  penaltyIds: string[];
  businessIds: string[];
  claimIds: string[];
  broadcastIds: string[];
  applicationIds: string[];
  apiKeyIds: string[];
  webhookIds: string[];
  batchIds: string[];
};

const safeIn = (column: Column, values: string[] | undefined) => (values && values.length ? inArray(column, values) : sql`false`);

const place = (id: string, label: string, lat: number, lng: number) => ({ id, label, district: "Maianga", city: "Luanda", lat, lng });
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const FLOW = ["searching", "assigned", "en_route", "arrived", "pickup_confirmed", "in_transit", "delivered", "paid", "rated"] as const;

async function createEmptyIds(adminId: string, adminEmail: string): Promise<PanelFixtureIds> {
  return { adminEmail, adminId, clientIds: [], providerIds: [], zoneIds: [], requestIds: [], disputeIds: [], refundIds: [], withdrawalIds: [], cashDepositIds: [], walletTransactionIds: [], sosIds: [], promotionIds: [], vehicleIds: [], documentIds: [], ticketIds: [], privacyIds: [], fleetIds: [], penaltyIds: [], businessIds: [], claimIds: [], broadcastIds: [], applicationIds: [], apiKeyIds: [], webhookIds: [], batchIds: [] };
}

export async function createPanelFixtures(): Promise<PanelFixtureIds> {
  const tag = randomUUID().slice(0, 6);
  const ids: PanelFixtureIds = {
    adminEmail: `teste-contrato-admin-${tag}@angoleva.ao`,
    adminId: newId("acc"),
    clientIds: [],
    providerIds: [],
    zoneIds: [],
    requestIds: [],
    disputeIds: [],
    refundIds: [],
    withdrawalIds: [],
    cashDepositIds: [],
    walletTransactionIds: [],
    sosIds: [],
    promotionIds: [],
    vehicleIds: [],
    documentIds: [],
    ticketIds: [],
    privacyIds: [],
    fleetIds: [],
    penaltyIds: [],
    businessIds: [],
    claimIds: [],
    broadcastIds: [],
    applicationIds: [],
    apiKeyIds: [],
    webhookIds: [],
    batchIds: [],
  };

  await db.insert(schema.accounts).values({ id: ids.adminId, kind: "admin", email: ids.adminEmail, fullName: "Administrador de Teste", active: true, adminRole: "admin", passwordHash: null });

  const zoneId = newId("zn");
  await db.insert(schema.zones).values({ id: zoneId, name: `Zona contrato ${tag}`, lat: "-8.8256", lng: "13.2311", radiusKm: "10.00" });
  ids.zoneIds.push(zoneId);

  for (const [index, name] of ["Ana", "Bruno", "Carla"].entries()) {
    const id = newId("acc");
    await db.insert(schema.accounts).values({ id, kind: "client", email: `teste-contrato-cliente${index}-${tag}@angoleva.ao`, phone: `+244 92300000${index}`, fullName: `${name} Cliente ${tag}`, active: true });
    await db.insert(schema.clients).values({ accountId: id, rating: "4.5", blocked: index === 2, blockedReason: index === 2 ? "Teste de bloqueio" : null });
    ids.clientIds.push(id);
  }

  for (const [index, name] of ["Duarte", "Elisa"].entries()) {
    const id = newId("acc");
    await db.insert(schema.accounts).values({ id, kind: "provider", email: `teste-contrato-prestador${index}-${tag}@angoleva.ao`, phone: `+244 91200000${index}`, fullName: `${name} Prestador ${tag}`, active: true });
    await db.insert(schema.providers).values({
      accountId: id,
      rating: "4.8",
      reviewsCount: 12,
      verified: true,
      online: true,
      lat: "-8.8300",
      lng: "13.2400",
      coverageZoneIds: [zoneId],
      coverageServiceTypes: ["tow", "cargo"],
      accountStatus: "active",
    });
    const vehicleId = newId("veh");
    await db.insert(schema.vehicles).values({ id: vehicleId, providerAccountId: id, brand: "Toyota", model: "Hilux", plate: `LD-${tag.slice(0, 2).toUpperCase()}-${index}${index}-AB`, color: "Branco", vehicleClass: "pickup", categoryLabel: "Pickup", capacityKg: 1000, year: 2020 });
    ids.vehicleIds.push(vehicleId);
    for (const [kind, status, validDays] of [["license", "verified", 400], ["id", "pending", null], ["vehicle", "rejected", null]] as const) {
      const documentId = newId("doc");
      await db.insert(schema.providerDocuments).values({
        id: documentId,
        providerAccountId: id,
        title: `Documento ${kind}`,
        kind,
        fileUrl: null,
        validUntil: validDays ? new Date(Date.now() + validDays * 86_400_000) : null,
        status,
      });
      ids.documentIds.push(documentId);
    }
    ids.providerIds.push(id);
  }

  const [client0, client1] = ids.clientIds;
  const [provider0, provider1] = ids.providerIds;
  const statuses: { status: (typeof FLOW)[number] | "cancelled"; provider?: string; client: string; method: "cash" | "card" | null; minutesAgo: number; scheduledInMinutes?: number; rating?: number; moving?: boolean }[] = [
    { status: "searching", client: client0!, method: "cash", minutesAgo: 30 },
    { status: "assigned", client: client0!, provider: provider0, method: "cash", minutesAgo: 60 },
    { status: "in_transit", client: client1!, provider: provider0, method: "cash", minutesAgo: 90 },
    { status: "delivered", client: client1!, provider: provider1, method: "cash", minutesAgo: 120 },
    { status: "paid", client: client0!, provider: provider0, method: "cash", minutesAgo: 600 },
    { status: "rated", client: client1!, provider: provider1, method: "cash", minutesAgo: 1500 },
    { status: "cancelled", client: client0!, method: null, minutesAgo: 2000 },
    { status: "paid", client: client1!, provider: provider1, method: "card", minutesAgo: 700, rating: 1 },
    { status: "searching", client: client1!, method: "cash", minutesAgo: 5, scheduledInMinutes: 240 },
    { status: "assigned", client: client0!, provider: provider1, method: "cash", minutesAgo: 45, moving: true },
  ];
  for (const [index, spec] of statuses.entries()) {
    const id = newId("req");
    const createdAt = ago(spec.minutesAgo);
    const total = 9000 + index * 500;
    const earning = Math.floor((total - 500) * 0.85 / 500) * 500;
    await db.insert(schema.serviceRequests).values({
      id,
      code: `AL-${tagNumber(tag, index)}`,
      serviceType: spec.moving ? "small_move" : index % 2 ? "cargo" : "tow",
      status: spec.status,
      clientAccountId: spec.client,
      providerAccountId: spec.provider ?? null,
      pickup: place(`plc-a-${tag}`, "Maianga", -8.8256, 13.2311),
      dropoff: place(`plc-b-${tag}`, "Talatona", -8.9167, 13.1833),
      stops: [],
      distanceKm: "12.50",
      durationMin: 34,
      movingDetails: spec.moving ? { property_type: null, rooms: 2, items: "Sofá e mesa", helpers: 2, pickup_floor: 1, delivery_floor: 3, elevator: false, disassembly: true, when: "now", date: null, time: null } : null,
      towDetails: spec.moving || index % 2 ? null : { incident: "mechanical", brand: "Toyota", model: "Corolla", plate: "LD-01-01-AA", color: "Branco", can_move: false },
      cargoDetails: !spec.moving && index % 2 ? { cargo_type: "boxes", description: "Caixas", weight: "upto100", volume: "small", vehicle_class: "pickup", helper: false } : null,
      photos: index === 1 ? [{ id: newId("ph"), url: "https://example.com/a.jpg", caption: "Estado do veículo" }] : [],
      pickupPhotos: index === 2 ? [{ id: newId("ph"), url: "https://example.com/b.jpg", caption: "Recolha" }] : [],
      pricing: { base_kz: total - 1500, distance_kz: 1000, extras_kz: 0, platform_fee_kz: 500, total_kz: total },
      providerEarningKz: spec.provider ? earning : null,
      paymentMethod: spec.method,
      scheduledFor: spec.scheduledInMinutes ? new Date(Date.now() + spec.scheduledInMinutes * 60_000) : null,
      rating: spec.rating ?? (spec.status === "rated" ? 5 : null),
      review: spec.rating === 1 ? "Muito atrasado" : spec.status === "rated" ? "Serviço excelente" : null,
      proof: ["delivered", "paid", "rated"].includes(spec.status) ? { photos: [], signed_by: "Cliente", good_condition: true, notes: null, delivered_at: createdAt.toISOString() } : null,
      cancelReason: spec.status === "cancelled" ? "Cliente desistiu" : null,
      createdAt,
      updatedAt: createdAt,
    });
    const reached = spec.status === "cancelled" ? (["searching"] as const) : FLOW.slice(0, FLOW.indexOf(spec.status) + 1);
    for (const [step, status] of reached.entries()) {
      await db.insert(schema.serviceRequestEvents).values({ id: newId("evt"), requestId: id, status, actor: step === 0 ? "system" : "provider", at: new Date(createdAt.getTime() + step * 6 * 60_000) });
    }
    if (spec.status === "cancelled") await db.insert(schema.serviceRequestEvents).values({ id: newId("evt"), requestId: id, status: "cancelled", actor: "client", at: new Date(createdAt.getTime() + 5 * 60_000) });
    ids.requestIds.push(id);
    if (spec.provider && ["paid", "rated"].includes(spec.status)) {
      const txId = newId("tx");
      await db.insert(schema.walletTransactions).values({ id: txId, providerAccountId: spec.provider, type: "earning", title: "Serviço", amountKz: earning, status: "completed", serviceType: index % 2 ? "cargo" : "tow", requestId: id });
      ids.walletTransactionIds.push(txId);
    }
  }

  const delivered = ids.requestIds[4]!;
  const disputeRequest = ids.requestIds[5]!;
  const refundId = newId("rf");
  await db.insert(schema.refunds).values({ id: refundId, code: `RF-${tag}`, requestId: delivered, amountKz: 2000, reason: "Atraso do prestador", source: "manual", chargeProvider: true, status: "pending", requestedByAccountId: ids.adminId });
  ids.refundIds.push(refundId);

  const disputeId = newId("dsp");
  await db.insert(schema.disputes).values({ id: disputeId, requestId: disputeRequest, reason: "Carga danificada", category: "damage", openedByAccountId: ids.adminId, notes: [{ id: newId("note"), author: "Administrador de Teste", text: "A analisar", at: new Date().toISOString() }] });
  ids.disputeIds.push(disputeId);

  const withdrawalId = newId("wd");
  await db.insert(schema.withdrawals).values({ id: withdrawalId, providerAccountId: provider0!, amountKz: 5000, iban: "AO06004000000000000000000", status: "pending" });
  ids.withdrawalIds.push(withdrawalId);

  const depositId = newId("cd");
  await db.insert(schema.cashDeposits).values({ id: depositId, providerAccountId: provider0!, amountKz: 1000, reference: "teste-contrato", recordedByAccountId: ids.adminId });
  ids.cashDepositIds.push(depositId);

  const sosId = newId("sos");
  await db.insert(schema.sosAlerts).values({ id: sosId, requestId: ids.requestIds[2]!, accountId: client1!, lat: "-8.8300", lng: "13.2400", area: "Maianga", message: "Preciso de ajuda", status: "open" });
  ids.sosIds.push(sosId);

  const promotionId = newId("promo");
  await db.insert(schema.promotions).values({
    id: promotionId,
    code: `TC${tag.toUpperCase()}`,
    name: "Promoção de teste",
    kind: "percent",
    value: 10,
    maxDiscountKz: 1500,
    minOrderKz: 0,
    startsAt: ago(60),
    endsAt: new Date(Date.now() + 86_400_000),
    budgetKz: 50_000,
    perClientLimit: 1,
    createdByAccountId: ids.adminId,
  });
  ids.promotionIds.push(promotionId);

  const adminId = ids.adminId;
  const requestOf = (index: number) => ids.requestIds[index]!;

  const ticketId = newId("tk");
  await db.insert(schema.supportTickets).values({ id: ticketId, code: `TK-${tag}`, requestId: requestOf(2), accountId: client1!, reason: "Atraso", description: "O prestador está atrasado", subject: "Prestador atrasado", status: "open", priority: "high" });
  const resolvedTicketId = newId("tk");
  await db.insert(schema.supportTickets).values({ id: resolvedTicketId, code: `TR-${tag}`, requestId: requestOf(5), accountId: client1!, reason: "Dúvida", description: "Dúvida sobre o preço", subject: "Dúvida sobre o preço", status: "resolved", priority: "low", resolution: "Esclarecido", resolvedAt: new Date(), assigneeAccountId: adminId, satisfactionScore: 5, satisfactionComment: "Obrigado", satisfactionAt: new Date() });
  ids.ticketIds.push(ticketId, resolvedTicketId);

  const privacyId = newId("prv");
  await db.insert(schema.privacyRequests).values({ id: privacyId, code: `PV-${tag}`, subjectKind: "client", subjectAccountId: client0!, subjectName: "Ana Cliente", kind: "access", channel: "app", details: "Quero os meus dados", dueAt: new Date(Date.now() + 30 * 86_400_000), status: "received" });
  ids.privacyIds.push(privacyId);

  const fleetId = newId("flt");
  await db.insert(schema.fleets).values({ id: fleetId, name: `Frota ${tag}`, nif: `50${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, contactName: "Gestor", phone: "+244 923000111", email: `teste-contrato-frota-${tag}@angoleva.ao`, status: "active" });
  ids.fleetIds.push(fleetId);

  const penaltyId = newId("pen");
  await db.insert(schema.penalties).values({ id: penaltyId, providerAccountId: provider1!, kind: "warning", reason: "Atraso repetido", createdByAccountId: adminId });
  ids.penaltyIds.push(penaltyId);

  const businessId = newId("biz");
  await db.insert(schema.businessAccounts).values({ id: businessId, name: `Empresa ${tag}`, nif: `54${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, sector: "Comércio", contactName: "Contacto", phone: "+244 923000222", email: `teste-contrato-empresa-${tag}@angoleva.ao`, status: "active", contractStartsAt: ago(60 * 24 * 30), contractEndsAt: new Date(Date.now() + 86_400_000 * 300), contractDiscountRate: "0.10", contractPaymentTermsDays: 30, contractCreditLimitKz: 200_000 });
  await db.insert(schema.businessMembers).values({ id: newId("bm"), businessId, clientAccountId: client0! });
  await db.insert(schema.businessStatements).values({ id: newId("bs"), businessId, month: "2026-10", reference: "teste-contrato" });
  ids.businessIds.push(businessId);

  const claimId = newId("clm");
  await db.insert(schema.claims).values({ id: claimId, code: `SN-${tag}`, requestId: requestOf(4), kind: "cargo_damage", description: "Carga danificada", occurredAt: ago(300), reportedByAccountId: adminId, estimatedAmountKz: 15_000, status: "reported", notes: [], photoIds: [] });
  ids.claimIds.push(claimId);

  const broadcastId = newId("bc");
  await db.insert(schema.broadcasts).values({ id: broadcastId, title: "Aviso de teste", channel: "push", audienceKind: "clients", audienceSegment: "all", audienceZoneIds: [], message: "Mensagem de teste", status: "scheduled", scheduledFor: new Date(Date.now() + 86_400_000), createdByAccountId: adminId });
  ids.broadcastIds.push(broadcastId);

  const applicationId = newId("app");
  await db.insert(schema.providerApplications).values({ id: applicationId, fullName: `Candidato ${tag}`, email: `teste-contrato-candidato-${tag}@angoleva.ao`, phone: "+244 923000333", serviceTypes: ["tow"], zoneIds: [zoneId], vehicle: { brand: "Toyota", model: "Hilux", plate: "LD-99-99-ZZ", color: "Branco", vehicle_class: "pickup", category_label: "Pickup" }, status: "pending" });
  ids.applicationIds.push(applicationId);

  const apiKeyId = newId("key");
  await db.insert(schema.adminApiKeys).values({ id: apiKeyId, name: "Chave de teste", prefix: `tc_${tag}`, secretHash: "x", scopes: ["requests.read"], createdByAccountId: adminId });
  ids.apiKeyIds.push(apiKeyId);

  const webhookId = newId("wh");
  await db.insert(schema.adminWebhooks).values({ id: webhookId, url: "https://example.com/hook", description: "Teste", events: ["request.created"], active: true, secretHash: "x", secretPreview: "whsec_…abcd", createdByAccountId: adminId });
  ids.webhookIds.push(webhookId);

  const batchId = newId("pb");
  await db.insert(schema.payoutBatches).values({ id: batchId, code: `LT-${tag}`, status: "draft", totalKz: 5000, count: 1, createdByAccountId: adminId });
  await db.update(schema.withdrawals).set({ batchId }).where(inArray(schema.withdrawals.id, ids.withdrawalIds));
  ids.batchIds.push(batchId);

  return ids;
}

function tagNumber(tag: string, index: number) {
  return `${parseInt(tag.slice(0, 4), 16) % 9000 + 1000}${index}`;
}

export async function deletePanelFixtures(given: Partial<PanelFixtureIds> & Pick<PanelFixtureIds, "adminId" | "adminEmail">) {
  const ids = { ...(await createEmptyIds(given.adminId, given.adminEmail)), ...given };
  const run = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      console.error(`limpeza: ${label} falhou: ${(error as Error).message}`);
    }
  };
  const accountIds = [ids.adminId, ...ids.clientIds, ...ids.providerIds];
  await run("zonas", () => db.delete(schema.zones).where(safeIn(schema.zones.id, ids.zoneIds)));
  await run("webhooks", () => db.delete(schema.adminWebhooks).where(safeIn(schema.adminWebhooks.id, ids.webhookIds)));
  await run("chaves", () => db.delete(schema.adminApiKeys).where(safeIn(schema.adminApiKeys.id, ids.apiKeyIds)));
  await run("candidaturas", () => db.delete(schema.providerApplications).where(safeIn(schema.providerApplications.id, ids.applicationIds)));
  await run("difusões", () => db.delete(schema.broadcasts).where(safeIn(schema.broadcasts.id, ids.broadcastIds)));
  await run("sinistros", () => db.delete(schema.claims).where(safeIn(schema.claims.id, ids.claimIds)));
  await run("penalizações", () => db.delete(schema.penalties).where(safeIn(schema.penalties.id, ids.penaltyIds)));
  await run("tickets", () => db.delete(schema.supportTickets).where(safeIn(schema.supportTickets.id, ids.ticketIds)));
  await run("privacidade", () => db.delete(schema.privacyRequests).where(safeIn(schema.privacyRequests.id, ids.privacyIds)));
  await run("extractos", () => db.delete(schema.businessStatements).where(safeIn(schema.businessStatements.businessId, ids.businessIds)));
  await run("membros", () => db.delete(schema.businessMembers).where(safeIn(schema.businessMembers.businessId, ids.businessIds)));
  await run("empresas", () => db.delete(schema.businessAccounts).where(safeIn(schema.businessAccounts.id, ids.businessIds)));
  await run("promoções", () => db.delete(schema.promotions).where(safeIn(schema.promotions.id, ids.promotionIds)));
  await run("sos", () => db.delete(schema.sosAlerts).where(safeIn(schema.sosAlerts.id, ids.sosIds)));
  await run("disputas", () => db.delete(schema.disputes).where(safeIn(schema.disputes.id, ids.disputeIds)));
  await run("reembolsos", () => db.delete(schema.refunds).where(safeIn(schema.refunds.id, ids.refundIds)));
  await run("levantamentos", () => db.delete(schema.withdrawals).where(safeIn(schema.withdrawals.id, ids.withdrawalIds)));
  await run("lotes", () => db.delete(schema.payoutBatches).where(safeIn(schema.payoutBatches.id, ids.batchIds)));
  await run("frotas", () => db.delete(schema.fleets).where(safeIn(schema.fleets.id, ids.fleetIds)));
  await run("depósitos", () => db.delete(schema.cashDeposits).where(safeIn(schema.cashDeposits.id, ids.cashDepositIds)));
  await run("movimentos", () => db.delete(schema.walletTransactions).where(safeIn(schema.walletTransactions.providerAccountId, ids.providerIds)));
  await run("pagamentos", () => db.delete(schema.payments).where(safeIn(schema.payments.requestId, ids.requestIds)));
  await run("eventos", () => db.delete(schema.serviceRequestEvents).where(safeIn(schema.serviceRequestEvents.requestId, ids.requestIds)));
  await run("pedidos", () => db.delete(schema.serviceRequests).where(safeIn(schema.serviceRequests.id, ids.requestIds)));
  await run("documentos", () => db.delete(schema.providerDocuments).where(safeIn(schema.providerDocuments.id, ids.documentIds)));
  await run("viaturas", () => db.delete(schema.vehicles).where(safeIn(schema.vehicles.id, ids.vehicleIds)));
  await run("carteiras", () => db.delete(schema.wallets).where(safeIn(schema.wallets.providerAccountId, ids.providerIds)));
  await run("prestadores", () => db.delete(schema.providers).where(safeIn(schema.providers.accountId, ids.providerIds)));
  await run("clientes", () => db.delete(schema.clients).where(safeIn(schema.clients.accountId, ids.clientIds)));
  await run("sessões", () => db.delete(schema.adminSessions).where(safeIn(schema.adminSessions.accountId, accountIds)));
  await run("registo de acessos", () => db.delete(schema.adminAccessLog).where(safeIn(schema.adminAccessLog.accountId, accountIds)));
  await run("auditoria", () => db.delete(schema.adminAuditLog).where(safeIn(schema.adminAuditLog.actorAccountId, accountIds)));
  await run("códigos", () => db.delete(schema.otpCodes).where(safeIn(schema.otpCodes.email, [ids.adminEmail])));
  await run("contas", () => db.delete(schema.accounts).where(safeIn(schema.accounts.id, accountIds)));
}

export async function collectLeftoverFixtures(): Promise<PanelFixtureIds[]> {
  const admins = await db.select().from(schema.accounts).where(like(schema.accounts.email, "teste-contrato-admin-%@angoleva.ao"));
  const result: PanelFixtureIds[] = [];
  for (const admin of admins) {
    const tag = admin.email.replace("teste-contrato-admin-", "").replace("@angoleva.ao", "");
    const ids = await createEmptyIds(admin.id, admin.email);
    const members = await db.select().from(schema.accounts).where(like(schema.accounts.email, `teste-contrato-%-${tag}@angoleva.ao`));
    ids.clientIds = members.filter((row) => row.kind === "client").map((row) => row.id);
    ids.providerIds = members.filter((row) => row.kind === "provider").map((row) => row.id);
    const pick = async (table: { id: Column }, where: ReturnType<typeof safeIn>) => (await db.select({ id: table.id }).from(table as never).where(where)).map((row) => (row as { id: string }).id);
    ids.requestIds = await pick(schema.serviceRequests, safeIn(schema.serviceRequests.clientAccountId, ids.clientIds));
    ids.zoneIds = await pick(schema.zones, like(schema.zones.name, `Zona contrato ${tag}`));
    ids.disputeIds = await pick(schema.disputes, safeIn(schema.disputes.requestId, ids.requestIds));
    ids.refundIds = await pick(schema.refunds, safeIn(schema.refunds.requestId, ids.requestIds));
    ids.withdrawalIds = await pick(schema.withdrawals, safeIn(schema.withdrawals.providerAccountId, ids.providerIds));
    ids.cashDepositIds = await pick(schema.cashDeposits, safeIn(schema.cashDeposits.providerAccountId, ids.providerIds));
    ids.sosIds = await pick(schema.sosAlerts, safeIn(schema.sosAlerts.requestId, ids.requestIds));
    ids.promotionIds = await pick(schema.promotions, eq(schema.promotions.createdByAccountId, admin.id));
    ids.vehicleIds = await pick(schema.vehicles, safeIn(schema.vehicles.providerAccountId, ids.providerIds));
    ids.documentIds = await pick(schema.providerDocuments, safeIn(schema.providerDocuments.providerAccountId, ids.providerIds));
    ids.ticketIds = await pick(schema.supportTickets, safeIn(schema.supportTickets.accountId, ids.clientIds));
    ids.privacyIds = await pick(schema.privacyRequests, safeIn(schema.privacyRequests.subjectAccountId, ids.clientIds));
    ids.fleetIds = await pick(schema.fleets, like(schema.fleets.email, `teste-contrato-frota-${tag}@angoleva.ao`));
    ids.penaltyIds = await pick(schema.penalties, eq(schema.penalties.createdByAccountId, admin.id));
    ids.businessIds = await pick(schema.businessAccounts, like(schema.businessAccounts.email, `teste-contrato-empresa-${tag}@angoleva.ao`));
    ids.claimIds = await pick(schema.claims, eq(schema.claims.reportedByAccountId, admin.id));
    ids.broadcastIds = await pick(schema.broadcasts, eq(schema.broadcasts.createdByAccountId, admin.id));
    ids.applicationIds = await pick(schema.providerApplications, like(schema.providerApplications.email, `teste-contrato-candidato-${tag}@angoleva.ao`));
    ids.apiKeyIds = await pick(schema.adminApiKeys, eq(schema.adminApiKeys.createdByAccountId, admin.id));
    ids.webhookIds = await pick(schema.adminWebhooks, eq(schema.adminWebhooks.createdByAccountId, admin.id));
    ids.batchIds = await pick(schema.payoutBatches, eq(schema.payoutBatches.createdByAccountId, admin.id));
    result.push(ids);
  }
  return result;
}

if (process.argv[1]?.endsWith("panel-fixtures.ts")) {
  const [command, payload] = process.argv.slice(2);
  try {
    if (command === "create") {
      console.log(JSON.stringify(await createPanelFixtures()));
    } else if (command === "cleanup" && payload) {
      await deletePanelFixtures(JSON.parse(payload) as PanelFixtureIds);
      console.log("ok");
    } else if (command === "sweep") {
      const leftovers = await collectLeftoverFixtures();
      for (const given of leftovers) await deletePanelFixtures(given);
      console.log(`removidos ${leftovers.length} conjuntos`);
    } else {
      throw new Error("uso: panel-fixtures.ts create | cleanup '<json>' | sweep");
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
