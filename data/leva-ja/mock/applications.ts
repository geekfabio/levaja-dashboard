import { formatDateTimeNumeric } from "@/lib/format";
import { APPLICATION_FLOW, APPLICATION_STAGE_LABELS, applicationBlocker, isApplicationOpen, nextApplicationStage } from "@/lib/leva-ja/quality";
import { DOCUMENT_TITLES, VEHICLE_CLASS_LABELS } from "@/lib/leva-ja/services";
import type { ApplicationStage, ProviderAccount, ProviderApplication } from "@/types/leva-ja";
import type { ApplicationsRepository } from "../repositories/applications";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, addDays } from "./domain";
import { VEHICLE_CAPACITY } from "./fixtures";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function providerFromApplication(ctx: MockContext, application: ProviderApplication, id: string): ProviderAccount {
  const zone = ctx.state.zones.find((item) => item.id === application.zoneId) ?? ctx.state.zones[0];
  const [brand, ...model] = application.vehicleLabel.split(" ");
  const validUntil = addDays(ctx.today, 365);
  return {
    id,
    name: application.name,
    initials: initialsOf(application.name),
    phone: application.phone,
    email: application.email,
    rating: 0,
    reviewsCount: 0,
    verified: false,
    vehicle: {
      id: `veh-${id}`,
      brand: brand ?? application.vehicleLabel,
      model: model.join(" ") || "—",
      plate: application.plate,
      color: "—",
      vehicleClass: application.vehicleClass,
      categoryLabel: VEHICLE_CLASS_LABELS[application.vehicleClass],
      capacityKg: VEHICLE_CAPACITY[application.vehicleClass],
      year: new Date(ctx.nowIso).getUTCFullYear() - 5,
    },
    coords: { ...zone.coords },
    availability: "offline",
    accountStatus: "pending_approval",
    zoneIds: [application.zoneId],
    services: [...application.services],
    documents: (Object.keys(DOCUMENT_TITLES) as (keyof typeof DOCUMENT_TITLES)[]).map((icon) => ({
      id: `doc-${id}-${icon}`,
      title: DOCUMENT_TITLES[icon],
      icon,
      state: "pending",
      validUntil,
    })),
    balance: 0,
    totalEarnings: 0,
    completedCount: 0,
    joinedAt: ctx.nowIso,
    fleetId: application.fleetId,
  };
}

export function createMockApplications(db: MockDatabase): ApplicationsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.applications, id, "Candidatura");
  const label = (application: ProviderApplication) => `${application.code} — ${application.name}`;
  const open = (application: ProviderApplication) => {
    if (!isApplicationOpen(application.stage)) {
      throw new RepositoryError("invalid_transition", `A candidatura já está «${APPLICATION_STAGE_LABELS[application.stage].toLowerCase()}».`);
    }
  };
  const requireStage = (application: ProviderApplication, stage: ApplicationStage, message: string) => {
    open(application);
    if (application.stage !== stage) throw new RepositoryError("invalid_transition", message);
  };
  const move = (ctx: MockContext, application: ProviderApplication, stage: ApplicationStage, note?: string) => {
    const from = APPLICATION_STAGE_LABELS[application.stage];
    application.stage = stage;
    application.history.push({ stage, at: ctx.nowIso, by: ctx.session.user.name, note: note?.trim() || undefined });
    return { field: "Etapa", from, to: APPLICATION_STAGE_LABELS[stage] };
  };

  return {
    list: (filters = {}) =>
      db.run({ permission: "applications.manage" }, ({ state }) =>
        paginate(
          state.applications
            .filter((application) => {
              if (filters.stage?.length && !filters.stage.includes(application.stage)) return false;
              if (filters.zone?.length && !filters.zone.includes(application.zoneId)) return false;
              return matchesQuery(filters.q, application.code, application.name, application.phone, application.plate);
            })
            .sort(byNewest((application) => application.submittedAt)),
          filters,
        ),
      ),

    get: (id) => db.run({ permission: "applications.manage" }, (ctx) => find(ctx, id)),

    summary: () =>
      db.run({ permission: "applications.manage" }, ({ state, now }) => {
        const since = new Date(now.getTime() - 30 * DAY).toISOString();
        const closedAt = (application: ProviderApplication) => application.history[application.history.length - 1]?.at ?? application.submittedAt;
        const approved = state.applications.filter((application) => application.stage === "approved");
        const recentApproved = approved.filter((application) => closedAt(application) >= since);
        const durations = approved.map((application) => (new Date(closedAt(application)).getTime() - new Date(application.submittedAt).getTime()) / DAY);
        return {
          funnel: APPLICATION_FLOW.map((stage) => ({ stage, count: state.applications.filter((application) => application.history.some((event) => event.stage === stage)).length })),
          open: state.applications.filter((application) => isApplicationOpen(application.stage)).length,
          approvedLast30: recentApproved.length,
          rejectedLast30: state.applications.filter((application) => application.stage === "rejected" && closedAt(application) >= since).length,
          averageDaysToApprove: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : null,
        };
      }),

    receiveDocument: (id, icon) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        open(application);
        if (application.stage !== "submitted" && application.stage !== "documents") {
          throw new RepositoryError("invalid_transition", "Os documentos só se recebem antes da entrevista.");
        }
        if (!(icon in DOCUMENT_TITLES)) throw new RepositoryError("validation", "Documento desconhecido.");
        if (!application.documentsReceived.includes(icon)) application.documentsReceived.push(icon);
        db.audit(ctx, "application.advance", { kind: "application", id, label: label(application) }, `Recebido: ${DOCUMENT_TITLES[icon]}.`);
        db.commit("providers");
        return application;
      }),

    scheduleInterview: (id, at) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        requireStage(application, "interview", "Só é possível marcar a entrevista na etapa de entrevista.");
        if (Number.isNaN(Date.parse(at))) throw new RepositoryError("validation", "Indique a data e a hora da entrevista.", [{ field: "at", message: "Data inválida." }]);
        const from = application.interviewAt ? formatDateTimeNumeric(application.interviewAt) : "—";
        application.interviewAt = new Date(at).toISOString();
        db.audit(ctx, "application.interview", { kind: "application", id, label: label(application) }, undefined, [
          { field: "Entrevista", from, to: formatDateTimeNumeric(application.interviewAt) },
        ]);
        db.commit("providers");
        return application;
      }),

    recordInspection: (id, passed, notes) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        requireStage(application, "inspection", "A vistoria só se regista na etapa de vistoria.");
        const why = requireReason(notes, "as notas da vistoria");
        application.inspection = { passed, notes: why, at: ctx.nowIso, by: ctx.session.user.name };
        db.audit(ctx, "application.inspection", { kind: "application", id, label: label(application) }, why, [
          { field: "Vistoria", from: "—", to: passed ? "Aprovada" : "Reprovada" },
        ]);
        db.commit("providers");
        return application;
      }),

    advance: (id, note) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        open(application);
        const next = nextApplicationStage(application.stage);
        if (!next) throw new RepositoryError("invalid_transition", "Nesta etapa a candidatura só pode ser aprovada ou recusada.");
        const blocker = applicationBlocker(application, ctx.now.getTime());
        if (blocker) throw new RepositoryError("validation", blocker);
        const change = move(ctx, application, next, note);
        db.audit(ctx, "application.advance", { kind: "application", id, label: label(application) }, note, [change]);
        db.commit("providers");
        return application;
      }),

    approve: (id, reason) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        requireStage(application, "inspection", "Só é possível aprovar depois da vistoria.");
        const blocker = applicationBlocker(application, ctx.now.getTime());
        if (blocker) throw new RepositoryError("validation", blocker);
        const why = requireReason(reason, "o motivo da aprovação");
        if (application.fleetId && !ctx.state.fleets.some((fleet) => fleet.id === application.fleetId && fleet.status === "active")) {
          throw new RepositoryError("validation", "A frota desta candidatura está suspensa.");
        }
        const provider = providerFromApplication(ctx, application, db.nextId("prv"));
        ctx.state.providers.push(provider);
        for (const document of provider.documents) ctx.state.documentSubmittedAt[document.id] = ctx.nowIso;
        application.providerId = provider.id;
        const change = move(ctx, application, "approved", why);
        db.audit(ctx, "application.approve", { kind: "application", id, label: label(application) }, why, [change]);
        db.commit("providers", "documents");
        return application;
      }),

    reject: (id, reason) =>
      db.run({ permission: "applications.manage" }, (ctx) => {
        const application = find(ctx, id);
        open(application);
        const why = requireReason(reason, "o motivo da recusa");
        application.rejectionReason = why;
        const change = move(ctx, application, "rejected", why);
        db.audit(ctx, "application.reject", { kind: "application", id, label: label(application) }, why, [change]);
        db.commit("providers");
        return application;
      }),
  };
}
