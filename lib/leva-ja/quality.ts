import type {
  ApplicationStage,
  FleetStatus,
  PenaltyKind,
  ProviderApplication,
  ProviderDocument,
  ProviderQuality,
  QualityFlag,
} from "@/types/leva-ja";

export const APPLICATION_FLOW: readonly ApplicationStage[] = ["submitted", "documents", "interview", "inspection", "approved"];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted: "Registo recebido",
  documents: "Documentos",
  interview: "Entrevista",
  inspection: "Vistoria da viatura",
  approved: "Aprovada",
  rejected: "Recusada",
};

export const APPLICATION_STAGE_TONES = {
  submitted: "neutral",
  documents: "warning",
  interview: "info",
  inspection: "info",
  approved: "success",
  rejected: "danger",
} as const;

export const APPLICATION_SOURCE_LABELS: Record<ProviderApplication["source"], string> = {
  app: "App",
  site: "Site",
  referral: "Indicação",
  fleet: "Frota",
};

export const FLEET_STATUS_LABELS: Record<FleetStatus, string> = { active: "Activa", suspended: "Suspensa" };

export const PENALTY_KIND_LABELS: Record<PenaltyKind, string> = {
  warning: "Advertência",
  fine: "Multa",
  suspension: "Suspensão temporária",
};

export const QUALITY_FLAG_LABELS: Record<QualityFlag, string> = {
  low_rating: "Avaliação baixa",
  cancellations: "Cancelamentos acima do limite",
  late_arrivals: "Chegadas atrasadas",
  disputes: "Disputas repetidas",
  inactive: "Sem serviços",
};

export const REQUIRED_APPLICATION_DOCUMENTS: readonly ProviderDocument["icon"][] = ["id", "license", "vehicle", "insurance"];

export function nextApplicationStage(stage: ApplicationStage): ApplicationStage | null {
  if (stage === "rejected" || stage === "approved" || stage === "inspection") return null;
  return APPLICATION_FLOW[APPLICATION_FLOW.indexOf(stage) + 1] ?? null;
}

export function applicationBlocker(application: Pick<ProviderApplication, "stage" | "documentsReceived" | "interviewAt" | "inspection">, now: number): string | null {
  if (application.stage === "documents") {
    const missing = REQUIRED_APPLICATION_DOCUMENTS.filter((icon) => !application.documentsReceived.includes(icon));
    return missing.length ? `Faltam ${missing.length} documento(s) obrigatório(s).` : null;
  }
  if (application.stage === "interview") {
    if (!application.interviewAt) return "Marque a entrevista antes de avançar.";
    if (new Date(application.interviewAt).getTime() > now) return "A entrevista ainda não aconteceu.";
    return null;
  }
  if (application.stage === "inspection") {
    if (!application.inspection) return "Registe o resultado da vistoria.";
    if (!application.inspection.passed) return "A viatura não passou na vistoria.";
    return null;
  }
  return null;
}

export function isApplicationOpen(stage: ApplicationStage) {
  return stage !== "approved" && stage !== "rejected";
}

export type QualityInput = {
  completed: number;
  cancelled: number;
  arrivals: number[];
  ratings: number[];
  disputes: number;
  joinedDaysAgo: number;
  active: boolean;
};

export type QualityThresholds = { arrivalTargetMinutes: number; cancelLimit: number };

export function qualityScore(input: QualityInput, thresholds: QualityThresholds): Pick<ProviderQuality, "cancellationRate" | "lateArrivals" | "lateRate" | "averageArrivalMinutes" | "rating" | "lowRatings" | "score" | "flags"> {
  const assigned = input.completed + input.cancelled;
  const cancellationRate = assigned ? input.cancelled / assigned : 0;
  const lateArrivals = input.arrivals.filter((minutes) => minutes > thresholds.arrivalTargetMinutes).length;
  const lateRate = input.arrivals.length ? lateArrivals / input.arrivals.length : 0;
  const averageArrivalMinutes = input.arrivals.length ? Math.round(input.arrivals.reduce((sum, value) => sum + value, 0) / input.arrivals.length) : null;
  const rating = input.ratings.length ? Math.round((input.ratings.reduce((sum, value) => sum + value, 0) / input.ratings.length) * 10) / 10 : null;
  const lowRatings = input.ratings.filter((value) => value <= 2).length;
  const penalty =
    Math.min(30, cancellationRate * 100 * 0.8) +
    Math.min(25, lateRate * 100 * 0.4) +
    Math.min(30, rating === null ? 0 : Math.max(0, 5 - rating) * 15) +
    Math.min(15, input.disputes * 5);
  const flags: QualityFlag[] = [];
  if (rating !== null && rating < 4 && input.ratings.length >= 3) flags.push("low_rating");
  if (input.cancelled >= thresholds.cancelLimit) flags.push("cancellations");
  if (input.arrivals.length >= 3 && lateRate > 0.25) flags.push("late_arrivals");
  if (input.disputes >= 2) flags.push("disputes");
  if (input.active && assigned === 0 && input.joinedDaysAgo > 30) flags.push("inactive");
  return {
    cancellationRate,
    lateArrivals,
    lateRate,
    averageArrivalMinutes,
    rating,
    lowRatings,
    score: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    flags,
  };
}

export type PenaltyInput = { kind: PenaltyKind; reason: string; amount?: number; days?: number };

export function penaltyIssues(input: PenaltyInput): { field: "reason" | "amount" | "days"; message: string }[] {
  const issues: { field: "reason" | "amount" | "days"; message: string }[] = [];
  if (input.reason.trim().length < 3) issues.push({ field: "reason", message: "Indique o motivo da penalização." });
  if (input.kind === "fine" && (!Number.isInteger(input.amount) || (input.amount ?? 0) <= 0)) {
    issues.push({ field: "amount", message: "Indique o valor da multa em kwanzas." });
  }
  if (input.kind === "suspension" && (!Number.isInteger(input.days) || (input.days ?? 0) < 1 || (input.days ?? 0) > 90)) {
    issues.push({ field: "days", message: "A suspensão tem de durar entre 1 e 90 dias." });
  }
  return issues;
}

export function isPenaltyActive(penalty: { kind: PenaltyKind; until?: string; revokedAt?: string }, now: number) {
  if (penalty.revokedAt) return false;
  if (penalty.kind === "suspension" && penalty.until) return new Date(penalty.until).getTime() > now;
  return true;
}
