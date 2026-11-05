import { apiError } from "./envelope";
import type { GeoPoint } from "./geo";

export type PlaceLike = {
  id: string;
  label: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
};

export type FetchImpl = typeof fetch;

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "AngoLeva/1.0 (contacto@angoleva.ao)";
const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_CITY = "Luanda";
const LUANDA_VIEWBOX = { minLat: -9.34, minLng: 12.73, maxLat: -8.34, maxLng: 13.73 };

type NominatimAddress = {
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
};

type NominatimResult = {
  place_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

function buildHeaders() {
  return { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" };
}

function buildId(result: NominatimResult, fallback: GeoPoint) {
  if (result.place_id !== undefined) return `osm-${result.place_id}`;
  return `osm-${fallback.lat.toFixed(5)}-${fallback.lng.toFixed(5)}`;
}

function mapResult(result: NominatimResult): PlaceLike {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  const address = result.address ?? {};
  return {
    id: buildId(result, { lat, lng }),
    label: result.display_name,
    district: address.suburb ?? address.neighbourhood ?? address.city_district ?? DEFAULT_CITY,
    city: address.city ?? address.town ?? DEFAULT_CITY,
    lat,
    lng,
  };
}

async function callNominatim(path: string, fetchImpl: FetchImpl) {
  try {
    const response = await fetchImpl(`${NOMINATIM_BASE_URL}${path}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number, fetchImpl: FetchImpl = fetch): Promise<PlaceLike> {
  const query = `/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt`;
  const result = (await callNominatim(query, fetchImpl)) as NominatimResult | null;
  if (!result || !result.lat || !result.lon) {
    throw apiError("not_found", "Não foi possível identificar o endereço para estas coordenadas.");
  }
  return mapResult(result);
}

export async function searchPlaces(query: string, options: { near?: GeoPoint } = {}, fetchImpl: FetchImpl = fetch): Promise<PlaceLike[]> {
  const near = options.near;
  const box = near
    ? { minLat: near.lat - 0.5, maxLat: near.lat + 0.5, minLng: near.lng - 0.5, maxLng: near.lng + 0.5 }
    : LUANDA_VIEWBOX;
  const viewbox = `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`;
  const path = `/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=ao&accept-language=pt&limit=8&viewbox=${viewbox}&bounded=1`;
  const results = (await callNominatim(path, fetchImpl)) as NominatimResult[] | null;
  if (!results || results.length === 0) return [];
  return results.map(mapResult);
}
