import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { platformSettings } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { recordAdminAudit } from "../lib/admin-audit";
import { ADMIN_ROLES, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, type AdminPermission, type RolePermissions } from "../lib/admin-roles";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

const SETTINGS_KEY = "settings";
const ROLE_PERMISSIONS_KEY = "role_permissions";

const serviceKindEnum = z.enum(["tow", "cargo", "small_move", "house_move"]);
const vehicleClassEnum = z.enum(["tow_truck", "pickup", "van", "truck"]);
const paymentMethodEnum = z.enum(["bank_reference", "card", "cash"]);
const notificationEventEnum = z.enum(["request.assigned", "request.arrived", "request.delivered", "request.cancelled", "document.rejected", "withdrawal.paid", "sos.raised"]);
const notificationChannelEnum = z.enum(["push", "sms", "email"]);
const documentIconEnum = z.enum(["license", "id", "vehicle", "insurance"]);

const generalSchema = z.object({
  trade_name: z.string(),
  legal_name: z.string(),
  nif: z.string(),
  support_phone: z.string(),
  support_email: z.string(),
  opening_hours: z.string(),
  terms_url: z.string(),
  privacy_url: z.string(),
});

const servicesSchema = z.array(
  z.object({ kind: serviceKindEnum, enabled: z.boolean(), vehicle_classes: z.array(vehicleClassEnum) }),
);

const dispatchSchema = z.object({
  initial_radius_km: z.number(),
  max_radius_km: z.number(),
  offer_timeout_seconds: z.number(),
  max_attempts: z.number(),
  stalled_after_minutes: z.number(),
  schedule_lead_minutes: z.number(),
  assign_target_minutes: z.number(),
  arrival_target_minutes: z.number(),
  distance_weight: z.number(),
  fallback: z.enum(["manual", "cancel"]),
});

const cancellationSchema = z.object({
  client_free_minutes: z.number(),
  client_fee: z.number(),
  wait_tolerance_minutes: z.number(),
  wait_fee_per_minute: z.number(),
  provider_cancel_limit: z.number(),
  provider_auto_suspend: z.boolean(),
});

const payoutsSchema = z.object({
  methods: z.array(paymentMethodEnum),
  minimum_withdrawal: z.number(),
  payout_frequency: z.enum(["daily", "weekly", "biweekly"]),
  multicaixa_entity: z.string(),
  cash_settlement_days: z.number(),
  refund_window_days: z.number(),
  refund_dual_approval_above: z.number(),
});

const taxSchema = z.object({
  vat_rate: z.number(),
  invoice_series: z.string(),
  credit_note_series: z.string(),
  vat_on_receipts: z.boolean(),
});

const documentsSchema = z.object({
  requirements: z.array(z.object({ icon: documentIconEnum, required: z.boolean(), min_validity_days: z.number() })),
  expiry_warning_days: z.number(),
});

const notificationsSchema = z.object({
  templates: z.array(z.object({ event: notificationEventEnum, channels: z.array(notificationChannelEnum), body: z.string() })),
  sos_escalation: z.array(z.string()),
});

const supportSchema = z.object({
  first_response_hours: z.object({ urgent: z.number(), high: z.number(), medium: z.number(), low: z.number() }),
  canned_replies: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })),
  satisfaction_survey: z.boolean(),
});

const securitySchema = z.object({
  require_2fa: z.boolean(),
  session_hours: z.number(),
  ip_allowlist: z.array(z.string()),
});

const appSchema = z.object({
  min_version_android: z.string(),
  min_version_ios: z.string(),
  maintenance: z.boolean(),
  maintenance_message: z.string(),
  banner: z.string(),
});

const SECTION_SCHEMAS = {
  general: generalSchema,
  services: servicesSchema,
  dispatch: dispatchSchema,
  cancellation: cancellationSchema,
  payouts: payoutsSchema,
  tax: taxSchema,
  documents: documentsSchema,
  notifications: notificationsSchema,
  support: supportSchema,
  security: securitySchema,
  app: appSchema,
} as const;

type SettingsSection = keyof typeof SECTION_SCHEMAS;

const SETTINGS_SECTION_PERMISSION: Record<SettingsSection, AdminPermission> = {
  general: "settings.manage",
  services: "settings.operations",
  dispatch: "settings.operations",
  cancellation: "settings.operations",
  documents: "settings.operations",
  payouts: "settings.finance",
  tax: "settings.finance",
  notifications: "settings.manage",
  support: "support.tickets",
  security: "security.manage",
  app: "settings.manage",
};

const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: "Plataforma",
  services: "Serviços e viaturas",
  dispatch: "Atribuição",
  cancellation: "Cancelamentos e penalizações",
  payouts: "Pagamentos e levantamentos",
  tax: "Impostos e facturação",
  documents: "Documentos exigidos",
  notifications: "Notificações",
  support: "Suporte",
  security: "Segurança",
  app: "App móvel",
};

function isSettingsSection(value: string): value is SettingsSection {
  return value in SECTION_SCHEMAS;
}

const VERSION = /^\d+\.\d+\.\d+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const SERVICE_SHORT_LABELS: Record<string, string> = { tow: "Reboque", cargo: "Carga", small_move: "Mudança pequena", house_move: "Mudança de casa" };
const DOCUMENT_TITLES: Record<string, string> = { license: "Carta de condução", id: "Bilhete de identidade", vehicle: "Documento da viatura", insurance: "Seguro" };

function validateSection(section: SettingsSection, value: z.infer<(typeof SECTION_SCHEMAS)[SettingsSection]>): string | null {
  if (section === "general") {
    const v = value as z.infer<typeof generalSchema>;
    if (v.trade_name.trim().length < 2) return "Indique o nome comercial.";
    if (!/^\d{9,14}$/.test(v.nif.replace(/\s/g, ""))) return "O NIF tem de ter entre 9 e 14 dígitos.";
    if (!/^\+244 ?9\d{2} ?\d{3} ?\d{3}$/.test(v.support_phone.trim())) return "Use o formato +244 9XX XXX XXX.";
    if (!EMAIL.test(v.support_email.trim())) return "Indique um e-mail válido.";
    return null;
  }
  if (section === "services") {
    const v = value as z.infer<typeof servicesSchema>;
    if (!v.some((item) => item.enabled)) return "Mantenha pelo menos um serviço activo.";
    for (const item of v) {
      if (item.enabled && item.vehicle_classes.length === 0) return `Escolha pelo menos uma viatura para ${SERVICE_SHORT_LABELS[item.kind] ?? item.kind}.`;
    }
    return null;
  }
  if (section === "dispatch") {
    const v = value as z.infer<typeof dispatchSchema>;
    if (v.initial_radius_km < 1) return "O raio inicial tem de ser pelo menos 1 km.";
    if (v.max_radius_km < v.initial_radius_km || v.max_radius_km > 60) return "O raio máximo tem de estar entre o raio inicial e 60 km.";
    if (v.offer_timeout_seconds < 15 || v.offer_timeout_seconds > 300) return "O tempo para aceitar tem de estar entre 15 e 300 segundos.";
    if (!Number.isInteger(v.max_attempts) || v.max_attempts < 1 || v.max_attempts > 20) return "As tentativas têm de estar entre 1 e 20.";
    if (v.stalled_after_minutes < 1) return "Indique ao fim de quantos minutos um pedido fica parado.";
    if (!Number.isInteger(v.schedule_lead_minutes) || v.schedule_lead_minutes < 15 || v.schedule_lead_minutes > 1440) return "A antecedência tem de estar entre 15 minutos e 24 horas.";
    if (v.assign_target_minutes < 1) return "Indique o prazo de atribuição.";
    if (v.arrival_target_minutes < 5) return "O prazo de chegada tem de ser pelo menos 5 minutos.";
    if (v.distance_weight < 0 || v.distance_weight > 100) return "O peso da distância tem de estar entre 0 e 100.";
    return null;
  }
  if (section === "cancellation") {
    const v = value as z.infer<typeof cancellationSchema>;
    if (v.client_free_minutes < 0) return "Os minutos sem custo não podem ser negativos.";
    if (v.client_fee < 0) return "A taxa de cancelamento não pode ser negativa.";
    if (v.wait_tolerance_minutes < 0) return "A tolerância não pode ser negativa.";
    if (v.wait_fee_per_minute < 0) return "O valor por minuto não pode ser negativo.";
    if (!Number.isInteger(v.provider_cancel_limit) || v.provider_cancel_limit < 1) return "O limite tem de ser pelo menos 1.";
    return null;
  }
  if (section === "payouts") {
    const v = value as z.infer<typeof payoutsSchema>;
    if (v.methods.length === 0) return "Mantenha pelo menos um método de pagamento activo.";
    if (v.minimum_withdrawal < 0) return "O mínimo não pode ser negativo.";
    if (!/^\d{5}$/.test(v.multicaixa_entity)) return "A entidade Multicaixa tem 5 dígitos.";
    if (!Number.isInteger(v.cash_settlement_days) || v.cash_settlement_days < 1 || v.cash_settlement_days > 30) return "O prazo tem de estar entre 1 e 30 dias.";
    if (!Number.isInteger(v.refund_window_days) || v.refund_window_days < 1 || v.refund_window_days > 180) return "O prazo para reembolsos tem de estar entre 1 e 180 dias.";
    if (v.refund_dual_approval_above < 0) return "O limite não pode ser negativo.";
    return null;
  }
  if (section === "tax") {
    const v = value as z.infer<typeof taxSchema>;
    if (v.vat_rate < 0 || v.vat_rate > 0.3) return "O IVA tem de estar entre 0 % e 30 %.";
    if (v.invoice_series.trim().length < 2) return "Indique a série das facturas.";
    if (v.credit_note_series.trim().length < 2 || v.credit_note_series.trim() === v.invoice_series.trim()) return "A série das notas de crédito tem de ser diferente da das facturas.";
    return null;
  }
  if (section === "documents") {
    const v = value as z.infer<typeof documentsSchema>;
    if (!v.requirements.some((item) => item.required)) return "Exija pelo menos um documento.";
    for (const item of v.requirements) {
      if (!Number.isInteger(item.min_validity_days) || item.min_validity_days < 0) return `A validade mínima de ${DOCUMENT_TITLES[item.icon] ?? item.icon} não pode ser negativa.`;
    }
    if (!Number.isInteger(v.expiry_warning_days) || v.expiry_warning_days < 1 || v.expiry_warning_days > 120) return "O aviso tem de estar entre 1 e 120 dias.";
    return null;
  }
  if (section === "notifications") {
    const v = value as z.infer<typeof notificationsSchema>;
    for (const template of v.templates) {
      if (template.body.trim().length < 5) return `Escreva a mensagem de «${template.event}».`;
    }
    if (v.sos_escalation.length === 0) return "Indique pelo menos um contacto para os alertas SOS.";
    return null;
  }
  if (section === "support") {
    const v = value as z.infer<typeof supportSchema>;
    for (const hours of Object.values(v.first_response_hours)) {
      if (!(hours > 0)) return "Os prazos de resposta têm de ser superiores a 0 horas.";
    }
    for (const reply of v.canned_replies) {
      if (reply.title.trim().length < 2 || reply.body.trim().length < 5) return "Cada resposta pronta precisa de título e texto.";
    }
    return null;
  }
  if (section === "security") {
    const v = value as z.infer<typeof securitySchema>;
    if (!Number.isInteger(v.session_hours) || v.session_hours < 1 || v.session_hours > 72) return "A sessão tem de durar entre 1 e 72 horas.";
    for (const ip of v.ip_allowlist) if (!IP.test(ip)) return `«${ip}» não é um endereço IP válido.`;
    return null;
  }
  if (section === "app") {
    const v = value as z.infer<typeof appSchema>;
    if (!VERSION.test(v.min_version_android)) return "Use o formato 1.2.3.";
    if (!VERSION.test(v.min_version_ios)) return "Use o formato 1.2.3.";
    if (v.maintenance && v.maintenance_message.trim().length < 5) return "Escreva a mensagem de manutenção.";
    return null;
  }
  return null;
}

type AllSettings = { [K in SettingsSection]: z.infer<(typeof SECTION_SCHEMAS)[K]> } & { updated_at: string; updated_by: string };

const DEFAULT_SETTINGS: AllSettings = {
  general: {
    trade_name: "AngoLeva",
    legal_name: "AngoLeva Tecnologias, Lda.",
    nif: "5000123456",
    support_phone: "+244 923 000 111",
    support_email: "apoio@angoleva.ao",
    opening_hours: "Todos os dias, 06:00–23:00",
    terms_url: "https://angoleva.ao/termos",
    privacy_url: "https://angoleva.ao/privacidade",
  },
  services: [
    { kind: "tow", enabled: true, vehicle_classes: ["tow_truck"] },
    { kind: "cargo", enabled: true, vehicle_classes: ["pickup", "van"] },
    { kind: "small_move", enabled: true, vehicle_classes: ["pickup", "van", "truck"] },
    { kind: "house_move", enabled: true, vehicle_classes: ["van", "truck"] },
  ],
  dispatch: {
    initial_radius_km: 5,
    max_radius_km: 15,
    offer_timeout_seconds: 45,
    max_attempts: 5,
    stalled_after_minutes: 10,
    schedule_lead_minutes: 60,
    assign_target_minutes: 8,
    arrival_target_minutes: 30,
    distance_weight: 70,
    fallback: "manual",
  },
  cancellation: {
    client_free_minutes: 3,
    client_fee: 1500,
    wait_tolerance_minutes: 10,
    wait_fee_per_minute: 100,
    provider_cancel_limit: 3,
    provider_auto_suspend: false,
  },
  payouts: {
    methods: ["bank_reference", "card", "cash"],
    minimum_withdrawal: 5000,
    payout_frequency: "weekly",
    multicaixa_entity: "10725",
    cash_settlement_days: 7,
    refund_window_days: 30,
    refund_dual_approval_above: 20000,
  },
  tax: { vat_rate: 0.14, invoice_series: "FT LJ", credit_note_series: "NC LJ", vat_on_receipts: true },
  documents: {
    requirements: [
      { icon: "license", required: true, min_validity_days: 30 },
      { icon: "id", required: true, min_validity_days: 30 },
      { icon: "vehicle", required: true, min_validity_days: 30 },
      { icon: "insurance", required: true, min_validity_days: 30 },
    ],
    expiry_warning_days: 30,
  },
  notifications: {
    templates: [
      { event: "request.assigned", channels: ["push"], body: "{{prestador}} aceitou o seu pedido {{codigo}} e está a caminho." },
      { event: "request.arrived", channels: ["push", "sms"], body: "{{prestador}} chegou ao local de recolha." },
      { event: "request.delivered", channels: ["push", "email"], body: "O seu pedido {{codigo}} foi entregue. Avalie o serviço na app." },
      { event: "request.cancelled", channels: ["push", "sms"], body: "O pedido {{codigo}} foi cancelado: {{motivo}}." },
      { event: "document.rejected", channels: ["push", "email"], body: "O documento {{documento}} foi recusado: {{motivo}}. Envie-o de novo na app." },
      { event: "withdrawal.paid", channels: ["push", "sms"], body: "Transferimos {{valor}} para a sua conta. Referência {{referencia}}." },
      { event: "sos.raised", channels: ["sms", "email"], body: "SOS no pedido {{codigo}} em {{zona}}. Contacte {{telefone}}." },
    ],
    sos_escalation: ["+244 923 000 911", "operacoes@angoleva.ao"],
  },
  support: {
    first_response_hours: { urgent: 1, high: 4, medium: 12, low: 24 },
    canned_replies: [
      { id: "cr-1", title: "Recebemos a ocorrência", body: "Obrigado pelo contacto. Já estamos a analisar a situação e voltamos a falar consigo em breve." },
      { id: "cr-2", title: "Pedir comprovativo", body: "Pode enviar uma fotografia ou o comprovativo de pagamento, por favor?" },
      { id: "cr-3", title: "Reembolso aprovado", body: "O reembolso foi aprovado e chega ao seu método de pagamento em até 5 dias úteis." },
      { id: "cr-4", title: "Prestador advertido", body: "Falámos com o prestador e registámos a situação. Pedimos desculpa pelo incómodo." },
    ],
    satisfaction_survey: true,
  },
  security: { require_2fa: false, session_hours: 12, ip_allowlist: [] },
  app: { min_version_android: "2.4.0", min_version_ios: "2.4.0", maintenance: false, maintenance_message: "Estamos em manutenção. Voltamos dentro de momentos.", banner: "" },
  updated_at: new Date(0).toISOString(),
  updated_by: "Sistema",
};

async function loadSettings(): Promise<AllSettings> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  return (row?.value as AllSettings | undefined) ?? DEFAULT_SETTINGS;
}

async function loadRolePermissions(): Promise<RolePermissions> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, ROLE_PERMISSIONS_KEY)).limit(1);
  return (row?.value as RolePermissions | undefined) ?? DEFAULT_ROLE_PERMISSIONS;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const updateSectionBody = z.object({ value: z.unknown(), reason: z.string().optional() });
const updateRolesBody = z.object({ matrix: z.record(z.string(), z.array(z.string())), reason: z.string().optional() });

export async function adminSettingsRoutes(app: FastifyInstance) {
  app.get("/admin/settings", { preHandler: [authenticateAdmin] }, async () => {
    return dataEnvelope(await loadSettings());
  });

  app.put("/admin/settings/:section", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    const { section: rawSection } = request.params as { section: string };
    if (!isSettingsSection(rawSection)) {
      throw apiError("validation", "Secção de definições desconhecida.");
    }
    const section = rawSection;
    requirePermission(admin.adminRole!, SETTINGS_SECTION_PERMISSION[section]);

    const body = updateSectionBody.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da alteração");

    const schema = SECTION_SCHEMAS[section];
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) {
      throw apiError("validation", "Os dados enviados são inválidos.", { issues: parsed.error.issues });
    }

    const issue = validateSection(section, parsed.data);
    if (issue) throw apiError("validation", issue);

    const current = await loadSettings();
    if (stableStringify(current[section]) === stableStringify(parsed.data)) {
      throw apiError("validation", "Não há alterações para guardar.");
    }

    const next: AllSettings = { ...current, [section]: parsed.data, updated_at: new Date().toISOString(), updated_by: admin.fullName };

    await db
      .insert(platformSettings)
      .values({ key: SETTINGS_KEY, value: next, updatedByAccountId: admin.id })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: next, updatedByAccountId: admin.id, updatedAt: new Date() } });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "settings.update",
      targetModule: "settings",
      targetId: section,
      targetLabel: SETTINGS_SECTION_LABELS[section],
      reason,
      changes: [{ field: SETTINGS_SECTION_LABELS[section], from: "Anterior", to: "Actualizada" }],
      sensitive: section === "security",
    });

    return dataEnvelope(next);
  });

  app.get("/admin/settings/roles", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "security.manage");
    return dataEnvelope(await loadRolePermissions());
  });

  app.put("/admin/settings/roles", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "security.manage");

    const body = updateRolesBody.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da alteração");

    const next: RolePermissions = { admin: [...ALL_PERMISSIONS], operations: [], support: [], finance: [] };
    for (const role of ADMIN_ROLES) {
      if (role === "admin") continue;
      const given = body.matrix[role] ?? [];
      next[role] = given.filter((item): item is AdminPermission => (ALL_PERMISSIONS as readonly string[]).includes(item));
    }

    const current = await loadRolePermissions();
    const changes: { field: string; from: string; to: string }[] = [];
    for (const role of ADMIN_ROLES) {
      const before = new Set(current[role]);
      const after = new Set(next[role]);
      const added = next[role].filter((item) => !before.has(item));
      const removed = current[role].filter((item) => !after.has(item));
      if (added.length) changes.push({ field: `${ROLE_LABELS[role]}: acrescentado`, from: "—", to: added.join(", ") });
      if (removed.length) changes.push({ field: `${ROLE_LABELS[role]}: retirado`, from: removed.join(", "), to: "—" });
    }
    if (!changes.length) throw apiError("validation", "Não há alterações para guardar.");

    await db
      .insert(platformSettings)
      .values({ key: ROLE_PERMISSIONS_KEY, value: next, updatedByAccountId: admin.id })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: next, updatedByAccountId: admin.id, updatedAt: new Date() } });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "roles.update",
      targetModule: "roles",
      targetId: "roles",
      targetLabel: "Papéis e permissões",
      reason,
      changes,
      sensitive: true,
    });

    return dataEnvelope(next);
  });
}
