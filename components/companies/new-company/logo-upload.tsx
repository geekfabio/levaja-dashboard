"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Asset from "@/components/_ui/asset";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

type LogoUploadProps = {
  value: string | null;
  companyName: string;
  onChange: (value: string | null) => void;
};

export default function LogoUpload({
  value,
  companyName,
  onChange,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use uma imagem PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Mantenha a imagem até 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      onChange(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    readFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    readFile(event.dataTransfer.files?.[0]);
  }

  const initial = companyName.trim().slice(0, 1).toUpperCase();

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      data-dragging={dragging}
      className="ease-power3-out data-[dragging=true]:border-line-strong flex items-center gap-4 rounded-xl border border-dashed border-transparent transition-[border-color,background-color] duration-150 data-[dragging=true]:bg-white/3"
    >
      <span className="bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] shadow-[0px_6px_6px_0px_rgba(15,15,15,0.24),0px_0px_0px_1.5px_var(--border)]">
        {value ? (
          <Asset
            type="image"
            src={value}
            alt="Pré-visualização do logótipo"
            width={1}
            height={1}
            fit="contain"
            className="size-9"
          />
        ) : initial ? (
          <span className="h2-style text-soft">{initial}</span>
        ) : (
          <BuildingIcon aria-hidden className="text-subtle size-5" />
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
          >
            {value ? "Substituir logótipo" : "Carregar logótipo"}
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              Remover
            </Button>
          )}
        </div>
        <span
          id={hintId}
          role={error ? "alert" : undefined}
          className={cn(
            "caption-style block",
            error ? "text-danger" : "text-subtle",
          )}
        >
          {error ??
            "PNG, JPG, WebP ou SVG até 2 MB. Também pode arrastar um ficheiro para aqui."}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={handleInput}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
