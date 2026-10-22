import Button from "@/components/_ui/button";

type SaveBarProps = {
  dirty: boolean;
  saved: boolean;
  onReset: () => void;
};

export default function SaveBar({ dirty, saved, onReset }: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span aria-live="polite" className="caption-style text-subtle mr-auto">
        {dirty ? "Alterações por guardar." : saved ? "Alterações guardadas." : ""}
      </span>
      <Button type="button" variant="subtle" size="sm" disabled={!dirty} onClick={onReset}>
        Repor
      </Button>
      <Button type="submit" variant="primary" size="sm" disabled={!dirty}>
        Guardar alterações
      </Button>
    </div>
  );
}
