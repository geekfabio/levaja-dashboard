import Button from "@/components/_ui/button";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

type TemplateEditorHeaderProps = {
  title: string;
  onClose: () => void;
};

export default function TemplateEditorHeader({ title, onClose }: TemplateEditorHeaderProps) {
  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-3">
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        <ChevronIcon aria-hidden className="size-3 rotate-90" />
        Modelos
      </Button>
      <span className="lead-style min-w-0 flex-1 truncate font-medium">{title}</span>
      <Button type="button" variant="subtle" size="sm" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" size="sm">
        Guardar modelo
      </Button>
    </div>
  );
}
