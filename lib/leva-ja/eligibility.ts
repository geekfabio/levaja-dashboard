import { distanceMeters } from "@/lib/geo";
import type {
  Coordinates,
  ProviderAccount,
  ProviderDisplayStatus,
  ProviderDocument,
  ServiceKind,
  Zone,
} from "@/types/leva-ja";

export function distanceKm(a: Coordinates, b: Coordinates) {
  return (
    distanceMeters({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) / 1000
  );
}

export function zoneContains(zone: Zone, point: Coordinates) {
  return distanceKm(zone.coords, point) <= zone.radiusKm;
}

export function zoneFor(zones: readonly Zone[], point: Coordinates) {
  let best: { zone: Zone; distance: number } | null = null;
  for (const zone of zones) {
    const distance = distanceKm(zone.coords, point);
    if (distance <= zone.radiusKm && (!best || distance < best.distance)) best = { zone, distance };
  }
  return best?.zone ?? null;
}

export function isDocumentValid(document: ProviderDocument, today: string) {
  return document.state === "verified" && document.validUntil.slice(0, 10) >= today;
}

export function documentsVerified(provider: Pick<ProviderAccount, "documents">, today: string) {
  return provider.documents.length === 4 && provider.documents.every((document) => isDocumentValid(document, today));
}

export function providerDisplayStatus(provider: Pick<ProviderAccount, "accountStatus" | "availability">): ProviderDisplayStatus {
  return provider.accountStatus === "suspended" ? "suspended" : provider.availability;
}

export type EligibilityIssue = "offline" | "not_active" | "documents" | "service" | "zone";

export const ELIGIBILITY_ISSUE_LABELS: Record<EligibilityIssue, string> = {
  offline: "Está offline",
  not_active: "Conta não activa",
  documents: "Documentos por verificar",
  service: "Não presta este serviço",
  zone: "Fora das zonas de cobertura",
};

export function eligibilityIssues(
  provider: ProviderAccount,
  request: { kind: ServiceKind; zoneId: string },
  today: string,
): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  if (provider.availability !== "online") issues.push("offline");
  if (provider.accountStatus !== "active") issues.push("not_active");
  if (!documentsVerified(provider, today)) issues.push("documents");
  if (!provider.services.includes(request.kind)) issues.push("service");
  if (!provider.zoneIds.includes(request.zoneId)) issues.push("zone");
  return issues;
}

export function isEligible(provider: ProviderAccount, request: { kind: ServiceKind; zoneId: string }, today: string) {
  return eligibilityIssues(provider, request, today).length === 0;
}
