"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type AddItemFormProps = {
  id: string;
  label: string;
  placeholder: string;
  buttonLabel: string;
  validate: (value: string) => string | undefined;
  onAdd: (value: string) => void;
};

export default function AddItemForm({
  id,
  label,
  placeholder,
  buttonLabel,
  validate,
  onAdd,
}: AddItemFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    const problem = next ? validate(next) : "Indique um nome.";
    setError(problem);
    if (problem) return;
    onAdd(next);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="aria-invalid:border-danger h-[30px] max-w-[280px] min-w-0 flex-1"
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
        />
        <Button type="submit" variant="secondary" size="sm">
          <PlusIcon aria-hidden className="size-3" />
          {buttonLabel}
        </Button>
      </div>
      {error && (
        <span role="alert" className="caption-style text-danger">
          {error}
        </span>
      )}
    </form>
  );
}
