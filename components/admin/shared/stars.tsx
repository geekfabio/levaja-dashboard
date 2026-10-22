import StarIcon from "@/public/assets/images/companies/detail/star-filled.svg";

export default function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon key={index} aria-hidden className={index < rating ? "text-warning size-3.5 [&_path]:fill-current" : "text-line-strong size-3.5 [&_path]:fill-current"} />
      ))}
    </span>
  );
}
