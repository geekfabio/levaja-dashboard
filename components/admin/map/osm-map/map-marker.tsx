"use client";

import type { CSSProperties, ComponentType, SVGProps } from "react";
import Button from "@/components/_ui/button";
import type { StatusTone } from "@/lib/leva-ja/status";
import { cn } from "@/lib/utils";
import PickupIcon from "@/public/assets/images/admin/map/pickup.svg";
import TowTruckIcon from "@/public/assets/images/admin/map/tow-truck.svg";
import TruckIcon from "@/public/assets/images/admin/map/truck.svg";
import VanIcon from "@/public/assets/images/admin/map/van.svg";
import type { Coordinates, VehicleClass } from "@/types/leva-ja";

export type MapMarkerKind = "vehicle" | "request" | "origin" | "destination" | "stop";

export type MapMarker = {
  id: string;
  coords: Coordinates;
  kind: MapMarkerKind;
  label: string;
  tone?: StatusTone;
  vehicleClass?: VehicleClass;
  busy?: boolean;
};

export const VEHICLE_ICONS: Record<VehicleClass, ComponentType<SVGProps<SVGSVGElement>>> = {
  tow_truck: TowTruckIcon,
  pickup: PickupIcon,
  van: VanIcon,
  truck: TruckIcon,
};

const KIND_LAYER: Record<MapMarkerKind, string> = {
  vehicle: "z-0",
  request: "z-1",
  stop: "z-2",
  origin: "z-3",
  destination: "z-3",
};

const TONE_BG: Record<StatusTone, string> = {
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
  neutral: "bg-subtle",
};

function MarkerFace({ marker }: { marker: MapMarker }) {
  if (marker.kind === "vehicle") {
    const Icon = VEHICLE_ICONS[marker.vehicleClass ?? "pickup"];
    return (
      <span
        className={cn(
          "bg-card flex size-8 items-center justify-center rounded-full shadow-md ring-2",
          marker.busy ? "ring-info text-info" : "ring-brand-vivid text-brand",
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>
    );
  }
  if (marker.kind === "request") {
    return (
      <span className={cn("border-card flex size-6 items-center justify-center rounded-full border-2 shadow-md", TONE_BG[marker.tone ?? "warning"])}>
        <span className="bg-card size-2 rounded-full" />
      </span>
    );
  }
  if (marker.kind === "stop") return <span className="bg-warning border-card size-3.5 rounded-full border-2 shadow-md" />;
  return (
    <span
      className={cn(
        "caption-style border-card text-primary-foreground flex size-6 items-center justify-center rounded-full border-2 font-semibold shadow-md",
        marker.kind === "origin" ? "bg-primary" : "bg-info",
      )}
    >
      {marker.kind === "origin" ? "A" : "B"}
    </span>
  );
}

type MapMarkerPinProps = {
  marker: MapMarker;
  style: CSSProperties;
  selected: boolean;
  onSelect?: (id: string) => void;
};

export default function MapMarkerPin({ marker, style, selected, onSelect }: MapMarkerPinProps) {
  const position = "absolute top-0 left-0 transition-transform duration-1000 ease-power3-out motion-reduce:transition-none";
  if (!onSelect) {
    return (
      <span role="img" aria-label={marker.label} title={marker.label} data-map-marker style={style} className={cn(position, KIND_LAYER[marker.kind], "pointer-events-none")}>
        <span className="flex -translate-1/2">
          <MarkerFace marker={marker} />
        </span>
      </span>
    );
  }
  return (
    <span data-map-marker style={style} className={cn(position, selected ? "z-10" : KIND_LAYER[marker.kind])}>
      <Button
        variant="ghost"
        size="none"
        aria-label={marker.label}
        aria-pressed={selected}
        title={marker.label}
        onClick={() => onSelect(marker.id)}
        className={cn(
          "-translate-1/2 cursor-pointer rounded-full hover:bg-transparent focus-visible:ring-offset-2",
          selected && "outline-ring outline-2 outline-offset-2",
        )}
      >
        <MarkerFace marker={marker} />
      </Button>
    </span>
  );
}

export function MapClusterPin({ count, label, style, onOpen }: { count: number; label: string; style: CSSProperties; onOpen: () => void }) {
  return (
    <span data-map-marker style={style} className="absolute top-0 left-0 z-4">
      <Button
        variant="primary"
        size="none"
        aria-label={label}
        title={label}
        onClick={onOpen}
        className="caption-style border-card size-9 -translate-1/2 border-2 font-semibold tabular-nums"
      >
        {count}
      </Button>
    </span>
  );
}
