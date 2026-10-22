import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailItem = { label: string; value: ReactNode; wide?: boolean };

export default function DetailList({ items, className }: { items: DetailItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className={cn("flex min-w-0 flex-col gap-1", item.wide && "sm:col-span-2")}>
          <dt className="caption-style text-subtle">{item.label}</dt>
          <dd className="lead-style min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
