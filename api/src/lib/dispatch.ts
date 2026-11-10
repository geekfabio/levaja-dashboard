import { haversineKm, type GeoPoint } from "./geo";

export const SCHEDULE_RISK_HOURS = 3;

export function scheduleRisk(request: { scheduledFor: Date | null; status: string; providerAccountId: string | null }, now: number) {
  if (!request.scheduledFor || request.providerAccountId || request.status !== "searching") return false;
  return request.scheduledFor.getTime() - now < SCHEDULE_RISK_HOURS * 3_600_000;
}

export function dispatchStartsAt(request: { scheduledFor: Date | null; createdAt: Date }, leadMinutes: number) {
  const created = request.createdAt.getTime();
  if (!request.scheduledFor) return created;
  return Math.max(created, request.scheduledFor.getTime() - leadMinutes * 60_000);
}

export function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] ?? null;
}

export type SlaStats = { count: number; withinRate: number | null; average: number | null; p90: number | null; breaches: number };

export function slaStats(minutes: number[], target: number): SlaStats {
  const within = minutes.filter((value) => value <= target).length;
  return {
    count: minutes.length,
    withinRate: minutes.length ? within / minutes.length : null,
    average: minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : null,
    p90: percentile(minutes, 0.9),
    breaches: minutes.length - within,
  };
}

export function luandaDay(date: Date) {
  const shifted = new Date(date.getTime() + 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

export function luandaHour(date: Date) {
  return (new Date(date.getTime() + 3_600_000).getUTCHours());
}

export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function nearestZoneId(point: GeoPoint, zoneRows: { id: string; lat: number; lng: number; radiusKm: number }[]): string | null {
  if (zoneRows.length === 0) return null;
  let best = zoneRows[0]!;
  let bestDistance = haversineKm(point, { lat: best.lat, lng: best.lng });
  for (const zone of zoneRows.slice(1)) {
    const distance = haversineKm(point, { lat: zone.lat, lng: zone.lng });
    if (distance < bestDistance) {
      best = zone;
      bestDistance = distance;
    }
  }
  return best.id;
}
