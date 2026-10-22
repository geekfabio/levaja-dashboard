"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Textarea } from "@/components/_ui/textarea";

const MIN_REASON = 3;

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  canConfirm?: boolean;
  pending?: boolean;
  error?: string | null;
  children?: ReactNode;
  onConfirm: (reason: string) => void | Promise<unknown>;
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  requireReason = false,
  reasonLabel = "Motivo",
  reasonPlaceholder = "Explique o motivo. Fica registado na auditoria.",
  canConfirm = true,
  pending = false,
  error,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const tooShort = reason.trim().length < MIN_REASON;
  const reasonError = requireReason && touched && tooShort ? "Indique o motivo (pelo menos 3 caracteres)." : undefined;

  function change(next: boolean) {
    if (pending) return;
    if (!next) {
      setReason("");
      setTouched(false);
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if ((requireReason && tooShort) || !canConfirm || pending) return;
    await onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader className="pr-12">
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-5">
            {children}
            {requireReason && (
              <Field label={reasonLabel} htmlFor="confirm-reason" required error={reasonError}>
                <Textarea
                  id="confirm-reason"
                  value={reason}
                  rows={3}
                  placeholder={reasonPlaceholder}
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={reasonError ? "confirm-reason-error" : undefined}
                  onChange={(event) => setReason(event.target.value)}
                  onBlur={() => setTouched(true)}
                  autoFocus
                />
              </Field>
            )}
            {error && (
              <p role="alert" className="caption-style text-danger">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="md" onClick={() => change(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} size="md" disabled={pending || !canConfirm}>
              {pending ? "A guardar…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
