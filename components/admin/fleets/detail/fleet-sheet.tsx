"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import DetailList from "@/components/admin/shared/detail-list";
import { ProviderStatusBadge } from "@/components/admin/shared/provider-badges";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import type { FleetDetail } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAddFleetDriver, useFleet, useRemoveFleetDriver, useSetFleetStatus } from "@/hooks/admin/use-network";
import { useProvidersList } from "@/hooks/admin/use-providers";
import { formatDateNumeric, formatDecimal, formatKz, formatNumber } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { FLEET_STATUS_LABELS } from "@/lib/leva-ja/quality";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import type { ProviderAccount } from "@/types/leva-ja";

function Body({ fleet, canManage }: { fleet: FleetDetail; canManage: boolean }) {
  const providers = useProvidersList({ pageSize: 200 });
  const add = useAddFleetDriver();
  const remove = useRemoveFleetDriver();
  const status = useSetFleetStatus();
  const [candidate, setCandidate] = useState("");
  const [removing, setRemoving] = useState<ProviderAccount | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const loose = (providers.data?.items ?? []).filter((provider) => !provider.fleetId && provider.accountStatus !== "pending_approval");
  const suspended = fleet.status === "suspended";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={suspended ? "danger" : "success"} label={FLEET_STATUS_LABELS[fleet.status]} />
            <span className="caption-style text-subtle">Desde {formatDateNumeric(fleet.createdAt)}</span>
          </div>
          {suspended && fleet.suspensionReason && <p className="caption-style text-danger">{fleet.suspensionReason}</p>}
          <DetailList
            items={[
              { label: "NIF", value: <span className="tabular-nums">{fleet.nif}</span> },
              { label: "Responsável", value: fleet.contactName },
              { label: "Telefone", value: <span className="tabular-nums">{fleet.phone}</span> },
              { label: "E-mail", value: fleet.email },
              { label: "Serviços em 30 dias", value: formatNumber(fleet.stats.completed30) },
              { label: "Volume em 30 dias", value: formatKz(fleet.stats.volume30) },
              { label: "Avaliação média", value: fleet.stats.rating === null ? "—" : `${formatDecimal(fleet.stats.rating, 1)} ★` },
              { label: "Online agora", value: `${formatNumber(fleet.stats.online)} de ${formatNumber(fleet.stats.drivers)}` },
            ]}
          />

          <section aria-label="Motoristas" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Motoristas e viaturas</h3>
            {fleet.drivers.length ? (
              <ul className="divide-border flex flex-col divide-y">
                {fleet.drivers.map((driver) => (
                  <li key={driver.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${driver.id}`} className="self-start">
                        {driver.name}
                      </Button>
                      <span className="caption-style text-subtle truncate">
                        {driver.vehicle.brand} {driver.vehicle.model} · {driver.vehicle.plate}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <ProviderStatusBadge provider={driver} />
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(driver)} aria-label={`Retirar ${driver.name} da frota`}>
                          Retirar
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption-style text-subtle">Ainda sem motoristas.</p>
            )}
            {canManage && !suspended && (
              <div className="flex flex-wrap items-end gap-2 pt-2">
                <Field label="Acrescentar motorista" htmlFor="fleet-add-driver" className="min-w-[220px] flex-1">
                  <Select value={candidate} onValueChange={setCandidate}>
                    <SelectTrigger id="fleet-add-driver">
                      <SelectValue placeholder={loose.length ? "Escolha um prestador sem frota" : "Não há prestadores sem frota"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loose.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} · {provider.vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!candidate || add.isPending}
                  onClick={() => add.mutateAsync({ id: fleet.id, providerId: candidate }).then(() => setCandidate(""), () => undefined)}
                >
                  Acrescentar
                </Button>
              </div>
            )}
            {add.error ? (
              <p role="alert" className="caption-style text-danger">
                {mutationError(add.error)}
              </p>
            ) : null}
          </section>
        </div>
      </ScrollArea>
      {canManage && (
        <div className="border-line-strong flex justify-end border-t p-4">
          <Button variant={suspended ? "primary" : "danger"} size="md" onClick={() => setStatusOpen(true)}>
            {suspended ? "Reactivar frota" : "Suspender frota"}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            remove.reset();
          }
        }}
        title={`Retirar ${removing?.name ?? ""} da frota`}
        description="O prestador continua na plataforma como independente."
        confirmLabel="Retirar"
        tone="danger"
        requireReason
        pending={remove.isPending}
        error={mutationError(remove.error)}
        onConfirm={(reason) => (removing ? remove.mutateAsync({ id: fleet.id, providerId: removing.id, reason }).then(() => setRemoving(null), () => undefined) : undefined)}
      />
      <ConfirmDialog
        open={statusOpen}
        onOpenChange={(open) => {
          setStatusOpen(open);
          if (!open) status.reset();
        }}
        title={suspended ? `Reactivar ${fleet.name}` : `Suspender ${fleet.name}`}
        description={suspended ? "A frota volta a poder receber motoristas novos." : "Não entram motoristas novos nem candidaturas desta frota enquanto estiver suspensa."}
        confirmLabel={suspended ? "Reactivar" : "Suspender"}
        tone={suspended ? "primary" : "danger"}
        requireReason
        pending={status.isPending}
        error={mutationError(status.error)}
        onConfirm={(reason) => status.mutateAsync({ id: fleet.id, status: suspended ? "active" : "suspended", reason }).then(() => setStatusOpen(false), () => undefined)}
      />
    </div>
  );
}

export default function FleetSheet({ fleetId, onClose, canManage }: { fleetId: string | null; onClose: () => void; canManage: boolean }) {
  const query = useFleet(fleetId);
  return (
    <Sheet open={fleetId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{query.data?.name ?? "Frota"}</SheetTitle>
            <SheetDescription className="sr-only">Dados da frota, motoristas e acções.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <Body fleet={data} canManage={canManage} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
