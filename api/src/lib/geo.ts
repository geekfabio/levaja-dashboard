export type GeoPoint = { lat: number; lng: number };

/** Usado como posição de recurso quando um prestador ainda não enviou o seu GPS. */
export const LUANDA_CENTER: GeoPoint = { lat: -8.8368, lng: 13.2343 };

const EARTH_RADIUS_KM = 6371;
const URBAN_ROAD_FACTOR = 1.3;
const MIN_DISTANCE_KM = 2;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function estimateDistanceKm(pickup: GeoPoint, dropoff: GeoPoint, stops: GeoPoint[] = []) {
  const points = [pickup, ...stops, dropoff];
  let straight = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    straight += haversineKm(points[i]!, points[i + 1]!);
  }
  const estimated = straight * URBAN_ROAD_FACTOR;
  return Math.max(MIN_DISTANCE_KM, Math.round(estimated * 100) / 100);
}

export function estimateDurationMin(distanceKm: number) {
  return Math.max(8, Math.round((distanceKm / 22) * 60));
}
