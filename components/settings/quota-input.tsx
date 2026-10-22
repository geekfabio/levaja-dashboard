import { Input } from "@/components/_ui/input";

type QuotaInputProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export default function QuotaInput({ id, label, value, onChange }: QuotaInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] leading-none"
      >
        Kz
      </span>
      <Input
        id={id}
        aria-label={label}
        type="number"
        min={0}
        step={1000000}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) || 0)))}
        className="h-[30px] pr-9 tabular-nums"
      />
    </div>
  );
}
