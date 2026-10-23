import Tag from "@/components/_ui/tag";
import { formatDateTimeNumeric } from "@/lib/format";
import { PHOTO_STAGE_LABELS } from "@/lib/leva-ja/scheduling";
import type { RequestPhoto } from "@/types/leva-ja";

const STAGE_TONES = { pickup: "blue", delivery: "green", damage: "red" } as const;

export default function RequestPhotos({ photos }: { photos: RequestPhoto[] }) {
  if (photos.length === 0) return <p className="caption-style text-subtle">Ainda sem fotografias da recolha ou da entrega.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {photos.map((photo) => (
        <li key={photo.id} className="flex flex-col gap-1.5">
          <div
            role="img"
            aria-label={`${PHOTO_STAGE_LABELS[photo.stage]}: ${photo.label}`}
            className="bg-muted text-subtle caption-style flex aspect-[4/3] items-center justify-center rounded-lg p-2 text-center"
          >
            {photo.label}
          </div>
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone={STAGE_TONES[photo.stage]} size="sm">
              {PHOTO_STAGE_LABELS[photo.stage]}
            </Tag>
            <span className="caption-style text-subtle tabular-nums">
              {photo.by === "client" ? "Cliente" : "Prestador"} · {formatDateTimeNumeric(photo.at)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
