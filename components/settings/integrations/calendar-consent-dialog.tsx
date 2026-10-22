"use client";

import { useState } from "react";
import Asset from "@/components/_ui/asset";
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
import { Input } from "@/components/_ui/input";
import { CALENDAR_PROVIDERS, CRM_CALENDAR_NAME } from "@/data/calendar-sync";
import { CURRENT_USER } from "@/data/companies";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";

export default function CalendarConsentDialog() {
  const authorizing = useCalendarSyncStore((state) => state.authorizing);
  const cancelConnect = useCalendarSyncStore((state) => state.cancelConnect);
  const confirmConnect = useCalendarSyncStore((state) => state.confirmConnect);
  const provider = CALENDAR_PROVIDERS.find((item) => item.id === authorizing);
  const [account, setAccount] = useState(CURRENT_USER.email);
  const [error, setError] = useState<string>();

  return (
    <Dialog open={Boolean(provider)} onOpenChange={(open) => !open && cancelConnect()}>
      <DialogContent onCloseAutoFocus={() => setError(undefined)}>
        {provider && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Asset type="image" src={provider.logo} alt="" width={1} height={1} fit="contain" className="size-10 shrink-0" />
                <div className="flex flex-col gap-1">
                  <DialogTitle>Ligar {provider.name}</DialogTitle>
                  <DialogDescription>{provider.vendor}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-6 py-5">
              <span className="caption-style rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-2 text-(--tag-amber-text)">
                Simulação: nesta versão não há ligação real ao {provider.name}. Em produção, este passo abre a página de autorização do fornecedor.
              </span>
              <Field label="Conta" htmlFor="calendar-account" error={error}>
                <Input
                  id="calendar-account"
                  type="email"
                  value={account}
                  autoFocus
                  onChange={(event) => {
                    setAccount(event.target.value);
                    setError(undefined);
                  }}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="lead-style">O Alimenta Angola CRM vai poder:</span>
                <ul className="caption-style text-soft flex list-disc flex-col gap-1 pl-5">
                  {provider.scopes.map((scope) => (
                    <li key={scope}>{scope}</li>
                  ))}
                </ul>
                <span className="caption-style text-subtle">
                  Os eventos ficam num calendário próprio, «{CRM_CALENDAR_NAME}», e não mexem nos outros calendários da conta.
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="subtle" size="sm" onClick={cancelConnect}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.trim())) {
                    setError("Indique um e-mail válido.");
                    return;
                  }
                  confirmConnect(account);
                }}
              >
                Permitir acesso
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
