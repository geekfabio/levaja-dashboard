"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";

type EditFooterProps = {
  editing: boolean;
  dirty: boolean;
  confirmingClose: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDiscard: () => void;
  onClose: () => void;
  saveForm: string;
  extra?: ReactNode;
};

export default function EditFooter({
  editing,
  dirty,
  confirmingClose,
  onEdit,
  onCancel,
  onDiscard,
  onClose,
  saveForm,
  extra,
}: EditFooterProps) {
  if (confirmingClose) {
    return (
      <div role="alert" className="flex w-full flex-wrap items-center justify-between gap-2">
        <span className="lead-style text-soft">Tem alterações por guardar.</span>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={onDiscard}>
            Descartar
          </Button>
          <Button variant="primary" size="sm" type="submit" form={saveForm}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <span aria-live="polite" className="caption-style text-subtle">
          {dirty ? "Alterações por guardar" : "Sem alterações"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" form={saveForm} disabled={!dirty}>
            Guardar alterações
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">{extra}</div>
      <div className="flex items-center gap-2">
        <Button variant="subtle" size="sm" onClick={onClose}>
          Fechar
        </Button>
        <Button variant="primary" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </div>
  );
}
