export type LatLng = { latitude: number; longitude: number };
export type Point = { x: number; y: number };
export type Bounds = { south: number; west: number; north: number; east: number };

export const TILE_SIZE = 256;
export const MAX_LATITUDE = 85.05112878;

export const ANGOLA_BOUNDS: Bounds = { south: -18.2, west: 11.4, north: -4.3, east: 24.2 };
export const ANGOLA_VIEW = { center: { latitude: -11.6, longitude: 17.8 }, zoom: 6 };
export const LUANDA_VIEW = { center: { latitude: -8.88, longitude: 13.26 }, zoom: 11 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function worldSize(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}

export function project({ latitude, longitude }: LatLng, zoom: number): Point {
  const size = worldSize(zoom);
  const lat = (clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size,
  };
}

export function unproject({ x, y }: Point, zoom: number): LatLng {
  const size = worldSize(zoom);
  const longitude = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

export function metersPerPixel(latitude: number, zoom: number) {
  return (156_543.033_92 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

export function clampCenter(center: LatLng, bounds: Bounds): LatLng {
  return { latitude: clamp(center.latitude, bounds.south, bounds.north), longitude: clamp(center.longitude, bounds.west, bounds.east) };
}

export function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  return points.reduce<Bounds>(
    (box, point) => ({
      south: Math.min(box.south, point.latitude),
      north: Math.max(box.north, point.latitude),
      west: Math.min(box.west, point.longitude),
      east: Math.max(box.east, point.longitude),
    }),
    { south: points[0].latitude, north: points[0].latitude, west: points[0].longitude, east: points[0].longitude },
  );
}

export function fitView(points: LatLng[], size: { width: number; height: number }, options: { padding?: number; minZoom?: number; maxZoom?: number } = {}) {
  const { padding = 48, minZoom = 5, maxZoom = 16 } = options;
  const box = boundsOf(points);
  if (!box) return null;
  const center = { latitude: (box.south + box.north) / 2, longitude: (box.west + box.east) / 2 };
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);
  for (let zoom = maxZoom; zoom >= minZoom; zoom -= 1) {
    const a = project({ latitude: box.north, longitude: box.west }, zoom);
    const b = project({ latitude: box.south, longitude: box.east }, zoom);
    if (Math.abs(b.x - a.x) <= width && Math.abs(b.y - a.y) <= height) return { center, zoom };
  }
  return { center, zoom: minZoom };
}

export type TileRef = { key: string; x: number; y: number; z: number; left: number; top: number };

export function visibleTiles(center: LatLng, zoom: number, size: { width: number; height: number }): TileRef[] {
  const middle = project(center, zoom);
  const originX = middle.x - size.width / 2;
  const originY = middle.y - size.height / 2;
  const count = 2 ** zoom;
  const tiles: TileRef[] = [];
  const startX = Math.floor(originX / TILE_SIZE);
  const endX = Math.floor((originX + size.width) / TILE_SIZE);
  const startY = Math.max(0, Math.floor(originY / TILE_SIZE));
  const endY = Math.min(count - 1, Math.floor((originY + size.height) / TILE_SIZE));
  for (let ty = startY; ty <= endY; ty += 1) {
    for (let tx = startX; tx <= endX; tx += 1) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, x: wrapped, y: ty, z: zoom, left: tx * TILE_SIZE - originX, top: ty * TILE_SIZE - originY });
    }
  }
  return tiles;
}

export function toScreen(point: LatLng, center: LatLng, zoom: number, size: { width: number; height: number }): Point {
  const world = project(point, zoom);
  const middle = project(center, zoom);
  return { x: world.x - middle.x + size.width / 2, y: world.y - middle.y + size.height / 2 };
}

export function fromScreen(point: Point, center: LatLng, zoom: number, size: { width: number; height: number }): LatLng {
  const middle = project(center, zoom);
  return unproject({ x: middle.x + point.x - size.width / 2, y: middle.y + point.y - size.height / 2 }, zoom);
}

export function zoomAround(center: LatLng, zoom: number, nextZoom: number, anchor: Point, size: { width: number; height: number }): LatLng {
  const fixed = fromScreen(anchor, center, zoom, size);
  const fixedWorld = project(fixed, nextZoom);
  return unproject({ x: fixedWorld.x - (anchor.x - size.width / 2), y: fixedWorld.y - (anchor.y - size.height / 2) }, nextZoom);
}

export type GridCluster<T> = { key: string; point: Point; items: T[] };

export function clusterByGrid<T extends { point: Point }>(items: T[], cell: number): GridCluster<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${Math.floor(item.point.x / cell)}:${Math.floor(item.point.y / cell)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    items: group,
    point: {
      x: group.reduce((sum, item) => sum + item.point.x, 0) / group.length,
      y: group.reduce((sum, item) => sum + item.point.y, 0) / group.length,
    },
  }));
}

export function niceScale(metersPerPixelValue: number, targetPx: number) {
  const meters = metersPerPixelValue * targetPx;
  const magnitude = 10 ** Math.floor(Math.log10(meters));
  const step = [5, 2, 1].map((factor) => factor * magnitude).find((value) => value <= meters) ?? magnitude;
  return { meters: step, width: step / metersPerPixelValue };
}

export function circlePoints(center: LatLng, radiusKm: number): LatLng[] {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180));
  return [
    { latitude: center.latitude + dLat, longitude: center.longitude - dLng },
    { latitude: center.latitude - dLat, longitude: center.longitude + dLng },
  ];
}
