import { formatDateTimeNumeric } from "@/lib/format";
import type { Review } from "@/types/leva-ja";
import type { ReactNode } from "react";
import Stars from "./stars";

export default function ReviewList({ reviews, title }: { reviews: Review[]; title?: (review: Review) => ReactNode }) {
  return (
    <ul className="divide-border flex flex-col divide-y">
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="lead-style">{title ? title(review) : review.authorName}</span>
            <span className="caption-style text-subtle tabular-nums">{formatDateTimeNumeric(review.at)}</span>
          </div>
          <Stars rating={review.rating} />
          {review.comment ? <p className="caption-style text-soft">«{review.comment}»</p> : <p className="caption-style text-subtle">Sem comentário.</p>}
        </li>
      ))}
    </ul>
  );
}
