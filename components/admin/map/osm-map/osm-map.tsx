"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import Button from "@/components/_ui/button";
import { formatNumber } from "@/lib/format";
import {
  ANGOLA_BOUNDS,
  LUANDA_VIEW,
  TILE_SIZE,
  clampCenter,
  clusterByGrid,
  fitView,
  metersPerPixel,
  niceScale,
  project,
  toScreen,
  unproject,
  visibleTiles,
  zoomAround,
} from "@/lib/map-projection";
import type { LatLng, Point, TileRef } from "@/lib/map-projection";
import type { StatusTone } from "@/lib/leva-ja/status";
import { cn } from "@/lib/utils";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import LocateIcon from "@/public/assets/images/admin/map/locate.svg";
import MinusIcon from "@/public/assets/images/admin/map/minus.svg";
import type { Coordinates } from "@/types/leva-ja";
import MapMarkerPin, { MapClusterPin } from "./map-marker";
import type { MapMarker } from "./map-marker";

export type MapRouteTone = StatusTone | "brand";

export type MapRoute = { id: string; points: Coordinates[]; tone?: MapRouteTone; dashed?: boolean };

export type MapZone = { id: string; name: string; coords: Coordinates; radiusKm: number };

export type MapHeat = { points: (Coordinates & { weight: number })[]; max: number; tone: "demand" | "supply" };

type View = { center: LatLng; zoom: number };
type Size = { width: number; height: number };

type OsmMapProps = {
  markers: MapMarker[];
  routes?: MapRoute[];
  zones?: MapZone[];
  fit?: Coordinates[];
  fitKey?: string;
  maxFitZoom?: number;
  ariaLabel: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  compact?: boolean;
  heat?: MapHeat | null;
  children?: ReactNode;
};

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 18;
const CLUSTER_BELOW_ZOOM = 11;
const CLUSTER_CELL = 36;
const PAN_STEP = 96;
const PAN_BOUNDS = {
  south: ANGOLA_BOUNDS.south - 2,
  west: ANGOLA_BOUNDS.west - 3,
  north: ANGOLA_BOUNDS.north + 2,
  east: ANGOLA_BOUNDS.east + 2,
};
const ANGOLA_CORNERS: Coordinates[] = [
  { latitude: ANGOLA_BOUNDS.north, longitude: ANGOLA_BOUNDS.west },
  { latitude: ANGOLA_BOUNDS.south, longitude: ANGOLA_BOUNDS.east },
];
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ROUTE_STROKE: Record<MapRouteTone, string> = {
  brand: "var(--brand)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success)",
  danger: "var(--danger)",
  neutral: "var(--subtle)",
};

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

function clampView(view: View): View {
  return { center: clampCenter(view.center, PAN_BOUNDS), zoom: clampZoom(view.zoom) };
}

function tileUrl(tile: TileRef) {
  return TILE_URL.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
}

function viewFor(points: Coordinates[], size: Size, maxZoom: number): View {
  const fitted = fitView(points, size, { padding: 56, minZoom: MIN_ZOOM, maxZoom });
  return clampView(fitted ?? LUANDA_VIEW);
}

function pathOf(points: Point[]) {
  let d = "";
  let last: Point | null = null;
  for (const point of points) {
    if (last && Math.abs(point.x - last.x) < 1.5 && Math.abs(point.y - last.y) < 1.5) continue;
    d += `${last ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    last = point;
  }
  return d;
}

function TileLayer({ view, size }: { view: View; size: Size }) {
  const half = { width: size.width / 2, height: size.height / 2 };
  const parent = view.zoom > MIN_ZOOM ? visibleTiles(view.center, view.zoom - 1, half) : [];
  const tiles = visibleTiles(view.center, view.zoom, size);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-0 left-0 origin-top-left scale-200" style={half}>
        {parent.map((tile) => (
          <div
            key={tile.key}
            className="absolute bg-cover"
            style={{ left: Math.round(tile.left), top: Math.round(tile.top), width: TILE_SIZE, height: TILE_SIZE, backgroundImage: `url(${tileUrl(tile)})` }}
          />
        ))}
      </div>
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="absolute bg-cover"
          style={{ left: Math.round(tile.left), top: Math.round(tile.top), width: TILE_SIZE, height: TILE_SIZE, backgroundImage: `url(${tileUrl(tile)})` }}
        />
      ))}
    </div>
  );
}

function HeatLayer({ view, size, heat, gradientId }: { view: View; size: Size; heat: MapHeat; gradientId: string }) {
  const color = heat.tone === "demand" ? "var(--danger)" : "var(--info)";
  return (
    <svg aria-hidden width={size.width} height={size.height} className="pointer-events-none absolute inset-0">
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <stop offset="50%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {heat.points.map((point) => {
        const center = toScreen(point, view.center, view.zoom, size);
        const intensity = heat.max ? point.weight / heat.max : 0;
        const radius = Math.max(18, 1400 / metersPerPixel(point.latitude, view.zoom)) * (0.9 + intensity * 0.8);
        return <circle key={`${point.latitude}:${point.longitude}`} cx={center.x} cy={center.y} r={radius} fill={`url(#${gradientId})`} opacity={0.5 + intensity * 0.5} />;
      })}
    </svg>
  );
}

function OverlayLayer({ view, size, routes, zones }: { view: View; size: Size; routes: MapRoute[]; zones: MapZone[] }) {
  const screen = (point: Coordinates) => toScreen(point, view.center, view.zoom, size);
  return (
    <svg aria-hidden width={size.width} height={size.height} className="pointer-events-none absolute inset-0">
      {zones.map((zone) => {
        const center = screen(zone.coords);
        const radius = (zone.radiusKm * 1000) / metersPerPixel(zone.coords.latitude, view.zoom);
        return (
          <g key={zone.id}>
            <circle
              cx={center.x}
              cy={center.y}
              r={radius}
              fill="var(--brand)"
              fillOpacity={0.07}
              stroke="var(--brand)"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="6 5"
            />
            {view.zoom >= 11 && radius > 24 && (
              <text
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dy="0.35em"
                fontSize={12}
                fontWeight={600}
                fill="var(--brand)"
                stroke="var(--card)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {zone.name}
              </text>
            )}
          </g>
        );
      })}
      {routes.map((route) => {
        const d = pathOf(route.points.map(screen));
        const stroke = ROUTE_STROKE[route.tone ?? "info"];
        return (
          <g key={route.id} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d={d} stroke="var(--card)" strokeWidth={route.dashed ? 6 : 8} strokeOpacity={0.9} />
            <path d={d} stroke={stroke} strokeWidth={route.dashed ? 3.5 : 5} strokeDasharray={route.dashed ? "1 8" : undefined} />
          </g>
        );
      })}
    </svg>
  );
}

function MarkerLayer({
  view,
  size,
  markers,
  selectedId,
  onSelect,
  onZoomTo,
}: {
  view: View;
  size: Size;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onZoomTo: (point: Point, delta: number) => void;
}) {
  const base = project({ latitude: PAN_BOUNDS.north, longitude: PAN_BOUNDS.west }, view.zoom);
  const middle = project(view.center, view.zoom);
  const offset = { x: base.x - middle.x + size.width / 2, y: base.y - middle.y + size.height / 2 };
  const margin = 48;
  const placed = markers
    .map((marker) => {
      const world = project(marker.coords, view.zoom);
      return { marker, point: { x: world.x - base.x, y: world.y - base.y } };
    })
    .filter(({ point }) => {
      const x = point.x + offset.x;
      const y = point.y + offset.y;
      return x > -margin && y > -margin && x < size.width + margin && y < size.height + margin;
    });
  const clusterable = view.zoom < CLUSTER_BELOW_ZOOM;
  const loose = placed.filter(({ marker }) => !clusterable || marker.id === selectedId || (marker.kind !== "vehicle" && marker.kind !== "request"));
  const grouped = clusterable ? clusterByGrid(placed.filter((item) => !loose.includes(item)), CLUSTER_CELL) : [];
  const single = grouped.filter((group) => group.items.length === 1).flatMap((group) => group.items);
  const clusters = grouped.filter((group) => group.items.length > 1);

  return (
    <div key={view.zoom} className="absolute top-0 left-0" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      {clusters.map((cluster) => (
        <MapClusterPin
          key={`cluster-${cluster.key}`}
          count={cluster.items.length}
          label={`${formatNumber(cluster.items.length)} marcadores agrupados. Aproximar.`}
          style={{ transform: `translate(${cluster.point.x}px, ${cluster.point.y}px)` }}
          onOpen={() => onZoomTo({ x: cluster.point.x + offset.x, y: cluster.point.y + offset.y }, 2)}
        />
      ))}
      {[...single, ...loose].map(({ marker, point }) => (
        <MapMarkerPin
          key={`${marker.kind}-${marker.id}`}
          marker={marker}
          selected={selectedId === marker.id}
          onSelect={onSelect}
          style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
        />
      ))}
    </div>
  );
}

function ScaleBar({ view }: { view: View }) {
  const scale = niceScale(metersPerPixel(view.center.latitude, view.zoom), 96);
  const label = scale.meters >= 1000 ? `${formatNumber(scale.meters / 1000)} km` : `${formatNumber(scale.meters)} m`;
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-2 left-2 flex flex-col items-start gap-0.5">
      <span className="caption-style text-soft bg-card/80 rounded-sm px-1 tabular-nums">{label}</span>
      <span className="border-soft h-1.5 border-x-2 border-b-2" style={{ width: scale.width }} />
    </div>
  );
}

export default function OsmMap({
  markers,
  routes = [],
  zones = [],
  fit,
  fitKey = "initial",
  maxFitZoom = 15,
  ariaLabel,
  selectedId,
  onSelect,
  className,
  compact = false,
  heat = null,
  children,
}: OsmMapProps) {
  const hintId = useId();
  const gradientId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Point; zoom: number; moved: boolean } | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [fittedKey, setFittedKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fitPoints = fit && fit.length > 0 ? fit : markers.map((marker) => marker.coords);

  if (size && fittedKey !== fitKey) {
    setFittedKey(fitKey);
    setView(viewFor(fitPoints, size, maxFitZoom));
  }

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const zoomBy = useCallback(
    (delta: number, anchor?: Point) => {
      if (!size) return;
      setView((current) => {
        if (!current) return current;
        const nextZoom = clampZoom(current.zoom + delta);
        if (nextZoom === current.zoom) return current;
        const point = anchor ?? { x: size.width / 2, y: size.height / 2 };
        return clampView({ center: zoomAround(current.center, current.zoom, nextZoom, point, size), zoom: nextZoom });
      });
    },
    [size],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let accumulated = 0;
    let lastZoomAt = 0;
    function onWheel(event: WheelEvent) {
      if (!node) return;
      event.preventDefault();
      accumulated += event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
      const now = performance.now();
      if (Math.abs(accumulated) < 60 || now - lastZoomAt < 180) return;
      const rect = node.getBoundingClientRect();
      zoomBy(accumulated < 0 ? 1 : -1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      accumulated = 0;
      lastZoomAt = now;
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  function panBy(dx: number, dy: number) {
    setView((current) => {
      if (!current) return current;
      const middle = project(current.center, current.zoom);
      return clampView({ center: unproject({ x: middle.x + dx, y: middle.y + dy }, current.zoom), zoom: current.zoom });
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !view || (event.target as HTMLElement).closest("[data-map-control]")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: project(view.center, view.zoom), zoom: view.zoom, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    setView(clampView({ center: unproject({ x: current.origin.x - dx, y: current.origin.y - dy }, current.zoom), zoom: current.zoom }));
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.moved) setDragging(false);
  }

  function onDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-map-marker]") || target.closest("[data-map-control]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    zoomBy(event.shiftKey ? -1 : 1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-PAN_STEP, 0],
      ArrowRight: [PAN_STEP, 0],
      ArrowUp: [0, -PAN_STEP],
      ArrowDown: [0, PAN_STEP],
    };
    if (moves[event.key]) {
      event.preventDefault();
      panBy(...moves[event.key]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(-1);
    }
  }

  function showAngola() {
    if (size) setView(viewFor(ANGOLA_CORNERS, size, 7));
  }

  function showLuanda() {
    setView(clampView(LUANDA_VIEW));
  }

  function refit() {
    if (size) setView(viewFor(fitPoints, size, maxFitZoom));
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="mapa"
      aria-label={ariaLabel}
      aria-describedby={hintId}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "bg-muted focus-visible:ring-ring/60 relative isolate touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-inset",
        dragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
    >
      {view && size && (
        <>
          <TileLayer view={view} size={size} />
          {heat && heat.points.length > 0 && <HeatLayer view={view} size={size} heat={heat} gradientId={gradientId} />}
          <OverlayLayer view={view} size={size} routes={routes} zones={zones} />
          <MarkerLayer view={view} size={size} markers={markers} selectedId={selectedId} onSelect={onSelect} onZoomTo={(point, delta) => zoomBy(delta, point)} />
          <ScaleBar view={view} />
        </>
      )}
      {!compact && (
        <div data-map-control className="absolute top-2 left-2 flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={showAngola} aria-label="Ver Angola inteira">
            Angola
          </Button>
          <Button variant="secondary" size="sm" onClick={showLuanda} aria-label="Ver Luanda">
            Luanda
          </Button>
        </div>
      )}
      <div data-map-control className={cn("absolute top-2 right-2 flex flex-col", compact ? "gap-1" : "gap-1.5")}>
        <Button variant="secondary" size={compact ? "icon-sm" : "icon"} onClick={() => zoomBy(1)} disabled={!view || view.zoom >= MAX_ZOOM} aria-label="Aproximar">
          <PlusIcon aria-hidden className="size-3" />
        </Button>
        <Button variant="secondary" size={compact ? "icon-sm" : "icon"} onClick={() => zoomBy(-1)} disabled={!view || view.zoom <= MIN_ZOOM} aria-label="Afastar">
          <MinusIcon aria-hidden className="size-3" />
        </Button>
        <Button variant="secondary" size={compact ? "icon-sm" : "icon"} onClick={refit} aria-label="Ajustar aos marcadores">
          <LocateIcon aria-hidden className="size-3" />
        </Button>
      </div>
      {children}
      <a
        data-map-control
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="caption-style text-soft bg-card/85 hover:text-foreground absolute right-0 bottom-0 rounded-tl-md px-1.5 py-0.5"
      >
        © Colaboradores do OpenStreetMap
      </a>
      <p id={hintId} className="sr-only">
        Arraste ou use as setas para mover o mapa. Use a roda do rato, duplo clique, + ou − para aproximar e afastar.
      </p>
    </div>
  );
}
