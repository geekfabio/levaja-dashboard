"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { numberFrom, numberText } from "../section-form";

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  hint?: string;
  scale?: number;
};

export function NumberField({ id, label, value, onChange, error, hint, scale = 1 }: NumberFieldProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input
        id={id}
        inputMode="decimal"
        value={numberText(Math.round(value * scale * 1000) / 1000)}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(numberFrom(event.target.value) / scale)}
        className="tabular-nums"
      />
    </Field>
  );
}

type TextFieldProps = { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string; placeholder?: string };

export function TextField({ id, label, value, onChange, error, hint, placeholder }: TextFieldProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input id={id} value={value} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function CheckField({ checked, onChange, children, disabled }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      {children}
    </label>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function toggle<T>(list: readonly T[], item: T, on: boolean) {
  return on ? (list.includes(item) ? [...list] : [...list, item]) : list.filter((entry) => entry !== item);
}
