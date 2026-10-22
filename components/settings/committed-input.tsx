"use client";

import { useState } from "react";
import { Input } from "@/components/_ui/input";
import { cn } from "@/lib/utils";

type CommittedInputProps = {
  id: string;
  label: string;
  value: string;
  validate: (value: string) => string | undefined;
  onCommit: (value: string) => void;
  className?: string;
};

export default function CommittedInput({
  id,
  label,
  value,
  validate,
  onCommit,
  className,
}: CommittedInputProps) {
  const [draft, setDraft] = useState(value);
  const error = draft.trim() === value ? undefined : validate(draft.trim());

  function commit() {
    const next = draft.trim();
    if (next === value) return setDraft(value);
    if (error) return;
    onCommit(next);
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Input
        id={id}
        aria-label={label}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="aria-invalid:border-danger h-[30px] font-medium"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") setDraft(value);
        }}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="caption-style text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
