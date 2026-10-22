"use client";

import { useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { StatusTone } from "@/lib/leva-ja/status";
import { cn } from "@/lib/utils";
import type { Coordinates, Zone } from "@/types/leva-ja";

export type MapMarkerKind = "provider" | "request" | "origin" | "destination" | "stop";

export type MapMarker = {
  id: string;
  coords: Coordinates;
  kind: MapMarkerKind;
  label: string;
  tone?: StatusTone;
};

export type MapRoute = { id: string; points: Coordinates[]; tone?: StatusTone; dashed?: boolean };

type LuandaMapProps = {
  markers: MapMarker[];
  routes?: MapRoute[];
  zones?: Zone[];
  fit?: Coordinates[];
  ariaLabel: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
};

const BOUNDS = { minLat: -9.08, maxLat: -8.74, minLng: 13.08, maxLng: 13.46 };
const WIDTH = 1000;
const LAT_SCALE = WIDTH / ((BOUNDS.maxLng - BOUNDS.minLng) * Math.cos((8.9 * Math.PI) / 180));
const HEIGHT = Math.round((BOUNDS.maxLat - BOUNDS.minLat) * LAT_SCALE);
const KM_UNITS = LAT_SCALE / 111;

const COAST: [number, number][] = [
  [13.08, -9.08],
  [13.11, -9.0],
  [13.13, -8.96],
  [13.16, -8.92],
  [13.19, -8.87],
  [13.215, -8.83],
  [13.228, -8.805],
  [13.25, -8.79],
  [13.29, -8.775],
  [13.34, -8.762],
  [13.4, -8.748],
  [13.46, -8.74],
];

const TONE_FILL: Record<StatusTone, string> = {
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success)",
  danger: "var(--danger)",
  neutral: "var(--subtle)",
};

export function project(coords: Coordinates) {
  return {
    x: ((coords.longitude - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * WIDTH,
    y: (BOUNDS.maxLat - coords.latitude) * LAT_SCALE,
  };
}

function viewBoxFor(fit?: Coordinates[]) {
  if (!fit || fit.length === 0) return `0 0 ${WIDTH} ${HEIGHT}`;
  const points = fit.map(project);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = 70;
  let minX = Math.min(...xs) - padding;
  let maxX = Math.max(...xs) + padding;
  let minY = Math.min(...ys) - padding;
  let maxY = Math.max(...ys) + padding;
  const minSize = 220;
  if (maxX - minX < minSize) {
    const grow = (minSize - (maxX - minX)) / 2;
    minX -= grow;
    maxX += grow;
  }
  if (maxY - minY < minSize * 0.6) {
    const grow = (minSize * 0.6 - (maxY - minY)) / 2;
    minY -= grow;
    maxY += grow;
  }
  return `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`;
}

const coastPath = (() => {
  const points = COAST.map(([longitude, latitude]) => project({ latitude, longitude }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return `${line} L${WIDTH + 400},${-400} L${-400},${-400} L${-400},${HEIGHT + 400} L${points[0].x.toFixed(1)},${HEIGHT + 400} Z`;
})();

function MarkerShape({ marker, size, focused, selected }: { marker: MapMarker; size: number; focused: boolean; selected: boolean }) {
  const fill = marker.tone ? TONE_FILL[marker.tone] : "var(--brand-vivid)";
  const ring = (focused || selected) && (
    <circle r={size * 1.9} fill="none" stroke="var(--ring)" strokeWidth={size * 0.35} />
  );
  if (marker.kind === "provider") {
    return (
      <>
        {ring}
        <circle r={size * 1.25} fill="var(--card)" stroke="var(--brand)" strokeWidth={size * 0.35} />
        <circle r={size * 0.7} fill="var(--brand-vivid)" />
      </>
    );
  }
  if (marker.kind === "origin" || marker.kind === "destination" || marker.kind === "stop") {
    const color = marker.kind === "origin" ? "var(--brand)" : marker.kind === "destination" ? "var(--info)" : "var(--warning)";
    return (
      <>
        {ring}
        <circle r={size * 1.3} fill={color} stroke="var(--card)" strokeWidth={size * 0.4} />
        <text textAnchor="middle" dy="0.35em" fontSize={size * 1.3} fontWeight={700} fill="var(--primary-foreground)">
          {marker.kind === "origin" ? "A" : marker.kind === "destination" ? "B" : "•"}
        </text>
      </>
    );
  }
  return (
    <>
      {ring}
      <path
        d={`M0,${size * 0.2} C${-size * 1.4},${-size * 1.2} ${-size * 1.2},${-size * 2.8} 0,${-size * 2.8} C${size * 1.2},${-size * 2.8} ${size * 1.4},${-size * 1.2} 0,${size * 0.2} Z`}
        fill={fill}
        stroke="var(--card)"
        strokeWidth={size * 0.3}
        transform={`translate(0 ${size * 0.8})`}
      />
      <circle r={size * 0.45} cy={-size * 1.25} fill="var(--card)" />
    </>
  );
}

export default function LuandaMap({ markers, routes = [], zones = [], fit, ariaLabel, selectedId, onSelect, className }: LuandaMapProps) {
  const reduceMotion = useReducedMotion();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const viewBox = viewBoxFor(fit);
  const [, , boxWidth, boxHeight] = viewBox.split(" ").map(Number);
  const scale = fit?.length ? Math.max(boxWidth, boxHeight * 1.6) / WIDTH : boxWidth / WIDTH;
  const size = Math.max(3, 9 * scale);
  const textSize = Math.max(7, 12 * scale);

  function onKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(id);
    }
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={ariaLabel}
      className={cn("bg-(--tag-blue-bg) block h-full w-full rounded-xl", className)}
    >
      <rect x={-400} y={-400} width={WIDTH + 800} height={HEIGHT + 800} fill="var(--card)" />
      <path d={coastPath} fill="var(--tag-blue-bg)" stroke="var(--tag-blue-border)" strokeWidth={2 * scale} />
      {zones.map((zone) => {
        const center = project(zone.coords);
        return (
          <g key={zone.id} aria-hidden>
            <circle
              cx={center.x}
              cy={center.y}
              r={zone.radiusKm * KM_UNITS}
              fill="var(--brand)"
              fillOpacity={0.05}
              stroke="var(--brand)"
              strokeOpacity={0.35}
              strokeDasharray={`${6 * scale} ${5 * scale}`}
              strokeWidth={1.5 * scale}
            />
            <text x={center.x} y={center.y} textAnchor="middle" dy="0.35em" fontSize={textSize} fill="var(--subtle)">
              {zone.name}
            </text>
          </g>
        );
      })}
      {routes.map((route) => {
        const points = route.points.map(project);
        const d = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
        return (
          <path
            key={route.id}
            aria-hidden
            d={d}
            fill="none"
            stroke={route.tone ? TONE_FILL[route.tone] : "var(--brand)"}
            strokeWidth={3 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={route.dashed ? `${8 * scale} ${6 * scale}` : undefined}
            opacity={0.8}
          />
        );
      })}
      {markers.map((marker) => {
        const point = project(marker.coords);
        const interactive = Boolean(onSelect);
        return (
          <motion.g
            key={`${marker.kind}-${marker.id}`}
            initial={false}
            animate={{ x: point.x, y: point.y }}
            transition={{ duration: reduceMotion ? 0 : 1.2, ease: [0.25, 1, 0.5, 1] }}
            role={interactive ? "button" : "img"}
            tabIndex={interactive ? 0 : undefined}
            aria-label={marker.label}
            aria-pressed={interactive ? selectedId === marker.id : undefined}
            onClick={interactive ? () => onSelect?.(marker.id) : undefined}
            onKeyDown={interactive ? (event) => onKey(event, marker.id) : undefined}
            onFocus={() => setFocusedId(marker.id)}
            onBlur={() => setFocusedId(null)}
            className={cn("outline-none", interactive && "cursor-pointer")}
          >
            <title>{marker.label}</title>
            <MarkerShape marker={marker} size={size} focused={focusedId === marker.id} selected={selectedId === marker.id} />
          </motion.g>
        );
      })}
    </svg>
  );
}
