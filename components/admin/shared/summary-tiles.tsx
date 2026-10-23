"use client";

import StatTile from "@/components/_common/stat-tile";
import Skeleton from "@/components/_ui/skeleton";

export type SummaryTile = { label: string; value: number; display: string };

export default function SummaryTiles({ tiles, count = 4 }: { tiles: SummaryTile[] | null; count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles
        ? tiles.map((tile, index) => <StatTile key={tile.label} index={index} {...tile} />)
        : Array.from({ length: count }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
    </div>
  );
}
