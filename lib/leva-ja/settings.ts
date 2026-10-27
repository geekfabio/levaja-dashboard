import { formatKz } from "@/lib/format";
import type {
  AdminPermission,
  AuditChange,
  NotificationChannel,
  NotificationEvent,
  PlatformSettings,
  SettingsSection,
} from "@/types/leva-ja";
import { DOCUMENT_TITLES, PAYMENT_LABELS, SERVICE_SHORT_LABELS, TICKET_PRIORITY_LABELS, VEHICLE_CLASS_LABELS, VEHICLE_SERVICES } from "./services";

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
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

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  "request.assigned": "Prestador atribuído",
  "request.arrived": "Prestador no local",
  "request.delivered": "Serviço entregue",
  "request.cancelled": "Pedido cancelado",
  "document.rejected": "Documento recusado",
  "withdrawal.paid": "Levantamento pago",
  "sos.raised": "Alerta SOS",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: "Notificação",
  sms: "SMS",
  email: "E-mail",
};

export const PAYOUT_FREQUENCY_LABELS = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal" } as const;

export const DISPATCH_FALLBACK_LABELS = { manual: "Passar para atribuição manual", cancel: "Cancelar e avisar o cliente" } as const;

export function defaultPlatformSettings(updatedAt: string, updatedBy = "Sistema"): PlatformSettings {
  return {
    general: {
      tradeName: "AngoLeva",
      legalName: "AngoLeva Tecnologias, Lda.",
      nif: "5000123456",
      supportPhone: "+244 923 000 111",
      supportEmail: "apoio@angoleva.ao",
      openingHours: "Todos os dias, 06:00–23:00",
      termsUrl: "https://angoleva.ao/termos",
      privacyUrl: "https://angoleva.ao/privacidade",
    },
    services: (["tow", "cargo", "small_move", "house_move"] as const).map((kind) => ({
      kind,
      enabled: true,
      vehicleClasses: (Object.keys(VEHICLE_SERVICES) as (keyof typeof VEHICLE_SERVICES)[]).filter((vehicle) => VEHICLE_SERVICES[vehicle].includes(kind)),
    })),
    dispatch: {
      initialRadiusKm: 5,
      maxRadiusKm: 15,
      offerTimeoutSeconds: 45,
      maxAttempts: 5,
      stalledAfterMinutes: 10,
      scheduleLeadMinutes: 60,
      assignTargetMinutes: 8,
      arrivalTargetMinutes: 30,
      distanceWeight: 70,
      fallback: "manual",
    },
    cancellation: {
      clientFreeMinutes: 3,
      clientFee: 1500,
      waitToleranceMinutes: 10,
      waitFeePerMinute: 100,
      providerCancelLimit: 3,
      providerAutoSuspend: false,
    },
    payouts: {
      methods: ["bank_reference", "card", "cash"],
      minimumWithdrawal: 5000,
      payoutFrequency: "weekly",
      multicaixaEntity: "10725",
      cashSettlementDays: 7,
      refundWindowDays: 30,
      refundDualApprovalAbove: 20000,
    },
    tax: { vatRate: 0.14, invoiceSeries: "FT LJ", creditNoteSeries: "NC LJ", vatOnReceipts: true },
    documents: {
      requirements: (["license", "id", "vehicle", "insurance"] as const).map((icon) => ({ icon, required: true, minValidityDays: 30 })),
      expiryWarningDays: 30,
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
      sosEscalation: ["+244 923 000 911", "operacoes@angoleva.ao"],
    },
    support: {
      firstResponseHours: { urgent: 1, high: 4, medium: 12, low: 24 },
      cannedReplies: [
        { id: "cr-1", title: "Recebemos a ocorrência", body: "Obrigado pelo contacto. Já estamos a analisar a situação e voltamos a falar consigo em breve." },
        { id: "cr-2", title: "Pedir comprovativo", body: "Pode enviar uma fotografia ou o comprovativo de pagamento, por favor?" },
        { id: "cr-3", title: "Reembolso aprovado", body: "O reembolso foi aprovado e chega ao seu método de pagamento em até 5 dias úteis." },
        { id: "cr-4", title: "Prestador advertido", body: "Falámos com o prestador e registámos a situação. Pedimos desculpa pelo incómodo." },
      ],
      satisfactionSurvey: true,
    },
    security: { require2fa: false, sessionHours: 12, ipAllowlist: [] },
    app: { minVersionAndroid: "2.4.0", minVersionIos: "2.4.0", maintenance: false, maintenanceMessage: "Estamos em manutenção. Voltamos dentro de momentos.", banner: "" },
    updatedAt,
    updatedBy,
  };
}

export type SettingsIssue = { field: string; message: string };

const VERSION = /^\d+\.\d+\.\d+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

function finite(value: number) {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateSettingsSection<K extends SettingsSection>(section: K, value: PlatformSettings[K]): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const need = (condition: boolean, field: string, message: string) => {
    if (!condition) issues.push({ field, message });
  };
  if (section === "general") {
    const general = value as PlatformSettings["general"];
    need(general.tradeName.trim().length >= 2, "tradeName", "Indique o nome comercial.");
    need(/^\d{9,14}$/.test(general.nif.replace(/\s/g, "")), "nif", "O NIF tem de ter entre 9 e 14 dígitos.");
    need(/^\+244 ?9\d{2} ?\d{3} ?\d{3}$/.test(general.supportPhone.trim()), "supportPhone", "Use o formato +244 9XX XXX XXX.");
    need(EMAIL.test(general.supportEmail.trim()), "supportEmail", "Indique um e-mail válido.");
  }
  if (section === "services") {
    const services = value as PlatformSettings["services"];
    need(services.some((service) => service.enabled), "services", "Mantenha pelo menos um serviço activo.");
    for (const service of services) {
      need(!service.enabled || service.vehicleClasses.length > 0, `services.${service.kind}`, `Escolha pelo menos uma viatura para ${SERVICE_SHORT_LABELS[service.kind]}.`);
    }
  }
  if (section === "dispatch") {
    const dispatch = value as PlatformSettings["dispatch"];
    need(finite(dispatch.initialRadiusKm) && dispatch.initialRadiusKm >= 1, "initialRadiusKm", "O raio inicial tem de ser pelo menos 1 km.");
    need(finite(dispatch.maxRadiusKm) && dispatch.maxRadiusKm >= dispatch.initialRadiusKm && dispatch.maxRadiusKm <= 60, "maxRadiusKm", "O raio máximo tem de estar entre o raio inicial e 60 km.");
    need(finite(dispatch.offerTimeoutSeconds) && dispatch.offerTimeoutSeconds >= 15 && dispatch.offerTimeoutSeconds <= 300, "offerTimeoutSeconds", "O tempo para aceitar tem de estar entre 15 e 300 segundos.");
    need(Number.isInteger(dispatch.maxAttempts) && dispatch.maxAttempts >= 1 && dispatch.maxAttempts <= 20, "maxAttempts", "As tentativas têm de estar entre 1 e 20.");
    need(finite(dispatch.stalledAfterMinutes) && dispatch.stalledAfterMinutes >= 1, "stalledAfterMinutes", "Indique ao fim de quantos minutos um pedido fica parado.");
    need(Number.isInteger(dispatch.scheduleLeadMinutes) && dispatch.scheduleLeadMinutes >= 15 && dispatch.scheduleLeadMinutes <= 1440, "scheduleLeadMinutes", "A antecedência tem de estar entre 15 minutos e 24 horas.");
    need(finite(dispatch.assignTargetMinutes) && dispatch.assignTargetMinutes >= 1, "assignTargetMinutes", "Indique o prazo de atribuição.");
    need(finite(dispatch.arrivalTargetMinutes) && dispatch.arrivalTargetMinutes >= 5, "arrivalTargetMinutes", "O prazo de chegada tem de ser pelo menos 5 minutos.");
    need(finite(dispatch.distanceWeight) && dispatch.distanceWeight >= 0 && dispatch.distanceWeight <= 100, "distanceWeight", "O peso da distância tem de estar entre 0 e 100.");
  }
  if (section === "cancellation") {
    const cancellation = value as PlatformSettings["cancellation"];
    need(finite(cancellation.clientFreeMinutes) && cancellation.clientFreeMinutes >= 0, "clientFreeMinutes", "Os minutos sem custo não podem ser negativos.");
    need(finite(cancellation.clientFee) && cancellation.clientFee >= 0, "clientFee", "A taxa de cancelamento não pode ser negativa.");
    need(finite(cancellation.waitToleranceMinutes) && cancellation.waitToleranceMinutes >= 0, "waitToleranceMinutes", "A tolerância não pode ser negativa.");
    need(finite(cancellation.waitFeePerMinute) && cancellation.waitFeePerMinute >= 0, "waitFeePerMinute", "O valor por minuto não pode ser negativo.");
    need(Number.isInteger(cancellation.providerCancelLimit) && cancellation.providerCancelLimit >= 1, "providerCancelLimit", "O limite tem de ser pelo menos 1.");
  }
  if (section === "payouts") {
    const payouts = value as PlatformSettings["payouts"];
    need(payouts.methods.length > 0, "methods", "Mantenha pelo menos um método de pagamento activo.");
    need(finite(payouts.minimumWithdrawal) && payouts.minimumWithdrawal >= 0, "minimumWithdrawal", "O mínimo não pode ser negativo.");
    need(/^\d{5}$/.test(payouts.multicaixaEntity), "multicaixaEntity", "A entidade Multicaixa tem 5 dígitos.");
    need(Number.isInteger(payouts.cashSettlementDays) && payouts.cashSettlementDays >= 1 && payouts.cashSettlementDays <= 30, "cashSettlementDays", "O prazo tem de estar entre 1 e 30 dias.");
    need(Number.isInteger(payouts.refundWindowDays) && payouts.refundWindowDays >= 1 && payouts.refundWindowDays <= 180, "refundWindowDays", "O prazo para reembolsos tem de estar entre 1 e 180 dias.");
    need(finite(payouts.refundDualApprovalAbove) && payouts.refundDualApprovalAbove >= 0, "refundDualApprovalAbove", "O limite não pode ser negativo.");
  }
  if (section === "tax") {
    const tax = value as PlatformSettings["tax"];
    need(finite(tax.vatRate) && tax.vatRate >= 0 && tax.vatRate <= 0.3, "vatRate", "O IVA tem de estar entre 0 % e 30 %.");
    need(tax.invoiceSeries.trim().length >= 2, "invoiceSeries", "Indique a série das facturas.");
    need(tax.creditNoteSeries.trim().length >= 2 && tax.creditNoteSeries.trim() !== tax.invoiceSeries.trim(), "creditNoteSeries", "A série das notas de crédito tem de ser diferente da das facturas.");
  }
  if (section === "documents") {
    const documents = value as PlatformSettings["documents"];
    need(documents.requirements.some((item) => item.required), "requirements", "Exija pelo menos um documento.");
    for (const item of documents.requirements) {
      need(Number.isInteger(item.minValidityDays) && item.minValidityDays >= 0, `requirements.${item.icon}`, `A validade mínima de ${DOCUMENT_TITLES[item.icon]} não pode ser negativa.`);
    }
    need(Number.isInteger(documents.expiryWarningDays) && documents.expiryWarningDays >= 1 && documents.expiryWarningDays <= 120, "expiryWarningDays", "O aviso tem de estar entre 1 e 120 dias.");
  }
  if (section === "notifications") {
    const notifications = value as PlatformSettings["notifications"];
    for (const template of notifications.templates) {
      need(template.body.trim().length >= 5, `templates.${template.event}`, `Escreva a mensagem de «${NOTIFICATION_EVENT_LABELS[template.event]}».`);
    }
    need(notifications.sosEscalation.length > 0, "sosEscalation", "Indique pelo menos um contacto para os alertas SOS.");
  }
  if (section === "support") {
    const support = value as PlatformSettings["support"];
    for (const [priority, hours] of Object.entries(support.firstResponseHours)) {
      need(finite(hours) && hours > 0, `firstResponseHours.${priority}`, "Os prazos de resposta têm de ser superiores a 0 horas.");
    }
    for (const reply of support.cannedReplies) {
      need(reply.title.trim().length >= 2 && reply.body.trim().length >= 5, `cannedReplies.${reply.id}`, "Cada resposta pronta precisa de título e texto.");
    }
  }
  if (section === "security") {
    const security = value as PlatformSettings["security"];
    need(Number.isInteger(security.sessionHours) && security.sessionHours >= 1 && security.sessionHours <= 72, "sessionHours", "A sessão tem de durar entre 1 e 72 horas.");
    for (const ip of security.ipAllowlist) need(IP.test(ip), "ipAllowlist", `«${ip}» não é um endereço IP válido.`);
  }
  if (section === "app") {
    const app = value as PlatformSettings["app"];
    need(VERSION.test(app.minVersionAndroid), "minVersionAndroid", "Use o formato 1.2.3.");
    need(VERSION.test(app.minVersionIos), "minVersionIos", "Use o formato 1.2.3.");
    need(!app.maintenance || app.maintenanceMessage.trim().length >= 5, "maintenanceMessage", "Escreva a mensagem de manutenção.");
  }
  return issues;
}

type Formatter = (value: unknown) => string;

const plain: Formatter = (value) => (Array.isArray(value) ? (value.length ? value.join(", ") : "—") : value === "" || value === undefined ? "—" : String(value));
const yesNo: Formatter = (value) => (value ? "Sim" : "Não");
const kz: Formatter = (value) => formatKz(Number(value));
const percent: Formatter = (value) => `${Math.round(Number(value) * 1000) / 10} %`;
const minutes: Formatter = (value) => `${value} min`;

const FIELD_LABELS: Record<string, [string, Formatter]> = {
  "general.tradeName": ["Nome comercial", plain],
  "general.legalName": ["Denominação social", plain],
  "general.nif": ["NIF", plain],
  "general.supportPhone": ["Telefone de apoio", plain],
  "general.supportEmail": ["E-mail de apoio", plain],
  "general.openingHours": ["Horário", plain],
  "general.termsUrl": ["Termos e condições", plain],
  "general.privacyUrl": ["Política de privacidade", plain],
  "dispatch.initialRadiusKm": ["Raio inicial", (value) => `${value} km`],
  "dispatch.maxRadiusKm": ["Raio máximo", (value) => `${value} km`],
  "dispatch.offerTimeoutSeconds": ["Tempo para aceitar", (value) => `${value} s`],
  "dispatch.maxAttempts": ["Tentativas", plain],
  "dispatch.stalledAfterMinutes": ["Pedido parado ao fim de", minutes],
  "dispatch.scheduleLeadMinutes": ["Antecedência para atribuir agendados", minutes],
  "dispatch.assignTargetMinutes": ["Prazo de atribuição", minutes],
  "dispatch.arrivalTargetMinutes": ["Prazo de chegada", minutes],
  "dispatch.distanceWeight": ["Peso da distância", (value) => `${value} %`],
  "dispatch.fallback": ["Sem prestador", (value) => DISPATCH_FALLBACK_LABELS[value as keyof typeof DISPATCH_FALLBACK_LABELS] ?? plain(value)],
  "cancellation.clientFreeMinutes": ["Cancelamento grátis até", minutes],
  "cancellation.clientFee": ["Taxa de cancelamento", kz],
  "cancellation.waitToleranceMinutes": ["Tolerância de espera", minutes],
  "cancellation.waitFeePerMinute": ["Espera por minuto", kz],
  "cancellation.providerCancelLimit": ["Cancelamentos do prestador por semana", plain],
  "cancellation.providerAutoSuspend": ["Suspender automaticamente", yesNo],
  "payouts.methods": ["Métodos de pagamento", (value) => (value as (keyof typeof PAYMENT_LABELS)[]).map((method) => PAYMENT_LABELS[method]).join(", ") || "—"],
  "payouts.minimumWithdrawal": ["Levantamento mínimo", kz],
  "payouts.payoutFrequency": ["Frequência dos pagamentos", (value) => PAYOUT_FREQUENCY_LABELS[value as keyof typeof PAYOUT_FREQUENCY_LABELS] ?? plain(value)],
  "payouts.multicaixaEntity": ["Entidade Multicaixa", plain],
  "payouts.cashSettlementDays": ["Prazo de entrega do numerário", (value) => `${value} dias`],
  "payouts.refundWindowDays": ["Prazo para pedir reembolso", (value) => `${value} dias`],
  "payouts.refundDualApprovalAbove": ["Dupla aprovação de reembolsos acima de", kz],
  "tax.vatRate": ["IVA", percent],
  "tax.invoiceSeries": ["Série das facturas", plain],
  "tax.creditNoteSeries": ["Série das notas de crédito", plain],
  "tax.vatOnReceipts": ["IVA discriminado nos recibos", yesNo],
  "documents.expiryWarningDays": ["Aviso de validade", (value) => `${value} dias`],
  "notifications.sosEscalation": ["Contactos SOS", plain],
  "support.satisfactionSurvey": ["Inquérito de satisfação", yesNo],
  "security.require2fa": ["Verificação em dois passos", yesNo],
  "security.sessionHours": ["Duração da sessão", (value) => `${value} h`],
  "security.ipAllowlist": ["IPs autorizados", plain],
  "app.minVersionAndroid": ["Versão mínima Android", plain],
  "app.minVersionIos": ["Versão mínima iOS", plain],
  "app.maintenance": ["Modo de manutenção", yesNo],
  "app.maintenanceMessage": ["Mensagem de manutenção", plain],
  "app.banner": ["Aviso na app", plain],
};

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function settingsChanges<K extends SettingsSection>(section: K, before: PlatformSettings[K], after: PlatformSettings[K]): AuditChange[] {
  const changes: AuditChange[] = [];
  if (section === "services") {
    const previous = before as PlatformSettings["services"];
    for (const service of after as PlatformSettings["services"]) {
      const old = previous.find((item) => item.kind === service.kind);
      const name = SERVICE_SHORT_LABELS[service.kind];
      if (old?.enabled !== service.enabled) changes.push({ field: name, from: old?.enabled ? "Activo" : "Inactivo", to: service.enabled ? "Activo" : "Inactivo" });
      if (!same(old?.vehicleClasses, service.vehicleClasses)) {
        changes.push({
          field: `${name}: viaturas`,
          from: (old?.vehicleClasses ?? []).map((item) => VEHICLE_CLASS_LABELS[item]).join(", ") || "—",
          to: service.vehicleClasses.map((item) => VEHICLE_CLASS_LABELS[item]).join(", ") || "—",
        });
      }
    }
    return changes;
  }
  if (section === "documents") {
    const previous = before as PlatformSettings["documents"];
    const next = after as PlatformSettings["documents"];
    for (const item of next.requirements) {
      const old = previous.requirements.find((entry) => entry.icon === item.icon);
      if (!same(old, item)) {
        const describe = (entry?: typeof item) => (entry ? `${entry.required ? "Obrigatório" : "Opcional"} · ${entry.minValidityDays} dias` : "—");
        changes.push({ field: DOCUMENT_TITLES[item.icon], from: describe(old), to: describe(item) });
      }
    }
    if (previous.expiryWarningDays !== next.expiryWarningDays) {
      changes.push({ field: "Aviso de validade", from: `${previous.expiryWarningDays} dias`, to: `${next.expiryWarningDays} dias` });
    }
    return changes;
  }
  if (section === "notifications") {
    const previous = before as PlatformSettings["notifications"];
    const next = after as PlatformSettings["notifications"];
    for (const template of next.templates) {
      const old = previous.templates.find((entry) => entry.event === template.event);
      if (!same(old, template)) {
        changes.push({
          field: `Mensagem: ${NOTIFICATION_EVENT_LABELS[template.event]}`,
          from: old ? `${old.channels.map((channel) => NOTIFICATION_CHANNEL_LABELS[channel]).join(", ")} · ${old.body}` : "—",
          to: `${template.channels.map((channel) => NOTIFICATION_CHANNEL_LABELS[channel]).join(", ")} · ${template.body}`,
        });
      }
    }
    if (!same(previous.sosEscalation, next.sosEscalation)) {
      changes.push({ field: "Contactos SOS", from: previous.sosEscalation.join(", ") || "—", to: next.sosEscalation.join(", ") || "—" });
    }
    return changes;
  }
  if (section === "support") {
    const previous = before as PlatformSettings["support"];
    const next = after as PlatformSettings["support"];
    for (const [priority, hours] of Object.entries(next.firstResponseHours) as [keyof typeof next.firstResponseHours, number][]) {
      if (previous.firstResponseHours[priority] !== hours) {
        changes.push({ field: `Prazo de resposta: prioridade ${TICKET_PRIORITY_LABELS[priority].toLowerCase()}`, from: `${previous.firstResponseHours[priority]} h`, to: `${hours} h` });
      }
    }
    if (!same(previous.cannedReplies, next.cannedReplies)) {
      changes.push({ field: "Respostas prontas", from: `${previous.cannedReplies.length}`, to: `${next.cannedReplies.length}` });
    }
    if (previous.satisfactionSurvey !== next.satisfactionSurvey) {
      changes.push({ field: "Inquérito de satisfação", from: yesNo(previous.satisfactionSurvey), to: yesNo(next.satisfactionSurvey) });
    }
    return changes;
  }
  const previous = before as Record<string, unknown>;
  for (const [key, value] of Object.entries(after as Record<string, unknown>)) {
    if (same(previous[key], value)) continue;
    const [label, format] = FIELD_LABELS[`${section}.${key}`] ?? [key, plain];
    changes.push({ field: label, from: format(previous[key]), to: format(value) });
  }
  return changes;
}

export function renderNotification(body: string, values: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

export const SETTINGS_SECTION_PERMISSION: Record<SettingsSection, AdminPermission> = {
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
