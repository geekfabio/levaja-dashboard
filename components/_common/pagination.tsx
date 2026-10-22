"use client";

import Button from "@/components/_ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
};

function pageWindow(page: number, pages: number) {
  const items: (number | "gap")[] = [];
  const add = (value: number) => {
    if (value >= 1 && value <= pages && !items.includes(value)) items.push(value);
  };
  add(1);
  if (page - 1 > 2) items.push("gap");
  for (let value = page - 1; value <= page + 1; value += 1) add(value);
  if (page + 1 < pages - 1) items.push("gap");
  add(pages);
  return items;
}

export default function Pagination({ page, pageSize, total, onPageChange, label = "Paginação", className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", className)}>
      <span className="caption-style text-subtle tabular-nums" aria-live="polite">
        {total === 0 ? "Sem registos" : `${formatNumber(first)}–${formatNumber(last)} de ${formatNumber(total)}`}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronIcon aria-hidden className="size-3 rotate-90" />
          </Button>
          {pageWindow(page, pages).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} aria-hidden className="caption-style text-subtle px-1">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "muted" : "ghost"}
                size="icon"
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className="tabular-nums"
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Página seguinte"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronIcon aria-hidden className="size-3 -rotate-90" />
          </Button>
        </div>
      )}
    </nav>
  );
}
