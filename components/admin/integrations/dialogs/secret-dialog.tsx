"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";

export default function SecretDialog({ title, label, secret, onClose }: { title: string; label: string; secret: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Copie e guarde num local seguro. Por segurança, não volta a ser mostrado; se o perder, crie outro.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 px-6 py-5">
          <label htmlFor="integration-secret" className="caption-style text-subtle">
            {label}
          </label>
          <div className="flex items-center gap-2">
            <Input id="integration-secret" readOnly value={secret ?? ""} onFocus={(event) => event.target.select()} className="font-mono text-[13px]" />
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                if (!secret) return;
                navigator.clipboard?.writeText(secret).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <span aria-live="polite" className="sr-only">
            {copied ? "Copiado para a área de transferência." : ""}
          </span>
        </div>
        <DialogFooter>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setCopied(false);
              onClose();
            }}
          >
            Já guardei
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
