import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsPanelProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export default function SettingsPanel({
  title,
  description,
  actions,
  className,
  children,
}: SettingsPanelProps) {
  return (
    <section
      className={cn("border-border flex min-w-0 flex-col gap-4 rounded-xl border p-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="eyebrow-style text-faint font-normal">{title}</h2>
          {description && (
            <p className="caption-style text-subtle max-w-[46em]">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
