import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      data-slot="textarea"
      className={cn(
        "flex w-full min-w-0 resize-none rounded-lg border border-line-strong bg-secondary px-3 py-2 text-[14px] leading-[1.4] text-foreground outline-none transition-[border-color] duration-150 ease-power3-out placeholder:text-subtle focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
