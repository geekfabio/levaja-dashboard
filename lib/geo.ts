export type GeoPoint = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`;
  return `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function mapsDirectionsUrl(point: GeoPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

export const CHECK_IN_RADIUS_M = 300;
