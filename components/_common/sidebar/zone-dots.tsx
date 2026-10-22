import type { ComponentType, SVGProps } from "react";
import type { ZoneColor } from "@/data/settings";
import { cn } from "@/lib/utils";

const DOT_FILL: Record<ZoneColor, string> = {
  yellow: "fill-(--tag-yellow-text)",
  red: "fill-(--tag-red-text)",
  purple: "fill-(--tag-purple-text)",
  blue: "fill-(--tag-blue-text)",
  green: "fill-(--tag-green-text)",
  teal: "fill-(--tag-teal-text)",
};

function dot(color: ZoneColor) {
  function ZoneDot({ className, ...props }: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 14 14" className={cn(className)} {...props}>
        <circle cx="7" cy="7" r="4" className={DOT_FILL[color]} />
      </svg>
    );
  }
  return ZoneDot;
}

export const ZONE_DOTS: Record<ZoneColor, ComponentType<SVGProps<SVGSVGElement>>> = {
  yellow: dot("yellow"),
  red: dot("red"),
  purple: dot("purple"),
  blue: dot("blue"),
  green: dot("green"),
  teal: dot("teal"),
};
