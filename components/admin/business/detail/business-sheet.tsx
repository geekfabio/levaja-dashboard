"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import DetailList from "@/components/admin/shared/detail-list";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage, isRepositoryError } from "@/data/leva-ja";
import type { BusinessDetail, BusinessStatementStatus } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAddBusinessMember, useBusinessCandidates, useBusinessAccount, useMarkStatementPaid, useRemoveBusinessMember, useSetBusinessStatus, useUpdateContract } from "@/hooks/admin/use-commerce";
import { formatDateNumeric, formatKz, formatNumber, formatPercent } from "@/lib/format";
import { monthLabel } from "@/lib/leva-ja/commerce";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import { ContractFields, contractFromDraft, draftFromContract } from "../dialogs/contract-fields";

const STATEMENT_LABELS: Record<BusinessStatementStatus, string> = { open: "Mês em curso", due: "Por pagar", overdue: "Em atraso", paid: "Pago" };
const STATEMENT_TONES = { open: "neutral", due: "warning", overdue: "danger", paid: "success" } as const;

type Dialog = { kind: "contract" } | { kind: "status" } | { kind: "remove"; clientId: string; name: string } | { kind: "paid"; month: string; net: number } | null;

function Body({ account, canManage, canOpenClients }: { account: BusinessDetail; canManage: boolean; canOpenClients: boolean }) {
  const candidates = useBusinessCandidates(canManage);
  const contract = useUpdateContract();
  const add = useAddBusinessMember();
  const remove = useRemoveBusinessMember();
  const paid = useMarkStatementPaid();
  const status = useSetBusinessStatus();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [candidate, setCandidate] = useState("");
  const [reference, setReference] = useState("");
  const [draft, setDraft] = useState(draftFromContract(account.contract));
  const suspended = account.status === "suspended";
  const available = candidates.data ?? [];
  const contractIssues = isRepositoryError(contract.error) ? contract.error.issues : [];
  const close = (next: boolean) => {
    if (!next) {
      setDialog(null);
      [contract, remove, paid, status].forEach((mutation) => mutation.reset());
      setReference("");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={suspended ? "danger" : "success"} label={suspended ? "Suspensa" : "Activa"} />
            {account.overLimit && <ToneBadge tone="danger" label="Acima do limite de crédito" />}
            <span className="caption-style text-subtle">{account.sector}</span>
          </div>
          {suspended && account.suspensionReason && <p className="caption-style text-danger">{account.suspensionReason}</p>}
          <DetailList
            items={[
              { label: "NIF", value: <span className="tabular-nums">{account.nif}</span> },
              { label: "Responsável", value: `${account.contactName} · ${account.phone}` },
              { label: "E-mail", value: account.email, wide: true },
              { label: "Desconto", value: formatPercent(account.contract.discountRate * 100) },
              { label: "Prazo de pagamento", value: `${account.contract.paymentTermsDays} dias` },
              { label: "Limite de crédito", value: formatKz(account.contract.creditLimit) },
              { label: "Crédito usado", value: formatKz(account.creditUsed) },
              { label: "Contrato", value: `${formatDateNumeric(account.contract.startsAt)} a ${formatDateNumeric(account.contract.endsAt)}`, wide: true },
            ]}
          />
          {canManage && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setDialog({ kind: "contract" })}>
              Alterar contrato
            </Button>
          )}

          <section aria-label="Extractos mensais" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Extractos mensais</h3>
            {account.statements.length ? (
              <div className="overflow-x-auto">
                <Table aria-label="Extractos mensais">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Mês</TableHead>
                      <TableHead scope="col" className="text-right">
                        A pagar
                      </TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">Acções</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.statements.map((statement) => (
                      <TableRow key={statement.month}>
                        <TableCell>
                          {monthLabel(statement.month)}
                          <span className="caption-style text-subtle block pt-0.5">
                            {formatNumber(statement.count)} pedido(s) · vence a {formatDateNumeric(statement.dueDate)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatKz(statement.net)}
                          {statement.discount > 0 && <span className="caption-style text-subtle block pt-0.5">−{formatKz(statement.discount)} de desconto</span>}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={STATEMENT_TONES[statement.status]} label={STATEMENT_LABELS[statement.status]} />
                        </TableCell>
                        <TableCell>
                          {canManage && (statement.status === "due" || statement.status === "overdue") && (
                            <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "paid", month: statement.month, net: statement.net })} aria-label={`Marcar ${monthLabel(statement.month)} como pago`}>
                              Pago
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="caption-style text-subtle">Ainda sem pedidos pagos pelos utilizadores desta empresa.</p>
            )}
          </section>

          <section aria-label="Utilizadores autorizados" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Utilizadores autorizados</h3>
            {account.memberClients.length ? (
              <ul className="divide-border flex flex-col divide-y">
                {account.memberClients.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {canOpenClients ? (
                        <Button variant="link" size="none" href={`${SECTION_ROUTES.clients}/${member.id}`} className="self-start">
                          {member.name}
                        </Button>
                      ) : (
                        <span className="lead-style">{member.name}</span>
                      )}
                      <span className="caption-style text-subtle tabular-nums">
                        {member.phone} · {formatNumber(member.requests30)} pedido(s) em 30 dias
                      </span>
                    </span>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "remove", clientId: member.id, name: member.name })} aria-label={`Retirar ${member.name}`}>
                        Retirar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption-style text-subtle">Ainda sem utilizadores.</p>
            )}
            {canManage && !suspended && (
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <Field label="Acrescentar cliente" htmlFor="business-add-member" className="min-w-[220px] flex-1">
                  <Select value={candidate} onValueChange={setCandidate}>
                    <SelectTrigger id="business-add-member">
                      <SelectValue placeholder={available.length ? "Escolha um cliente sem empresa" : "Não há clientes sem empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} · {client.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!candidate || add.isPending}
                  onClick={() => add.mutateAsync({ id: account.id, clientId: candidate }).then(() => setCandidate(""), () => undefined)}
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
          <Button variant={suspended ? "primary" : "danger"} size="md" onClick={() => setDialog({ kind: "status" })}>
            {suspended ? "Reactivar conta" : "Suspender conta"}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={dialog?.kind === "contract"}
        onOpenChange={close}
        title={`Contrato de ${account.name}`}
        description="As alterações aplicam-se aos extractos que ainda não fecharam."
        confirmLabel="Guardar contrato"
        requireReason
        pending={contract.isPending}
        error={contractIssues.length ? null : mutationError(contract.error)}
        onConfirm={(reason) => contract.mutateAsync({ id: account.id, contract: contractFromDraft(draft), reason }).then(() => setDialog(null), () => undefined)}
      >
        <ContractFields draft={draft} onChange={setDraft} issueFor={(field) => contractIssues.find((issue) => issue.field === field)?.message} />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.kind === "paid"}
        onOpenChange={close}
        title={dialog?.kind === "paid" ? `Pagamento de ${monthLabel(dialog.month)}` : "Pagamento"}
        description={dialog?.kind === "paid" ? `Confirme o recebimento de ${formatKz(dialog.net)}.` : undefined}
        confirmLabel="Marcar como pago"
        canConfirm={reference.trim().length >= 3}
        pending={paid.isPending}
        error={mutationError(paid.error)}
        onConfirm={() => (dialog?.kind === "paid" ? paid.mutateAsync({ id: account.id, month: dialog.month, reference: reference.trim() }).then(() => setDialog(null), () => undefined) : undefined)}
      >
        <Field label="Referência do pagamento" htmlFor="statement-reference" required>
          <Input id="statement-reference" value={reference} placeholder="Por exemplo: TRF482913" onChange={(event) => setReference(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.kind === "remove"}
        onOpenChange={close}
        title={dialog?.kind === "remove" ? `Retirar ${dialog.name}` : "Retirar"}
        description="O cliente continua na app, mas os próximos pedidos deixam de entrar no extracto da empresa."
        confirmLabel="Retirar"
        tone="danger"
        requireReason
        pending={remove.isPending}
        error={mutationError(remove.error)}
        onConfirm={(reason) => (dialog?.kind === "remove" ? remove.mutateAsync({ id: account.id, clientId: dialog.clientId, reason }).then(() => setDialog(null), () => undefined) : undefined)}
      />
      <ConfirmDialog
        open={dialog?.kind === "status"}
        onOpenChange={close}
        title={suspended ? `Reactivar ${account.name}` : `Suspender ${account.name}`}
        description={suspended ? "Os utilizadores voltam a poder pedir com as condições do contrato." : "Os utilizadores deixam de poder pedir com as condições da empresa."}
        confirmLabel={suspended ? "Reactivar" : "Suspender"}
        tone={suspended ? "primary" : "danger"}
        requireReason
        pending={status.isPending}
        error={mutationError(status.error)}
        onConfirm={(reason) => status.mutateAsync({ id: account.id, status: suspended ? "active" : "suspended", reason }).then(() => setDialog(null), () => undefined)}
      />
    </div>
  );
}

export default function BusinessSheet({ accountId, onClose, canManage, canOpenClients }: { accountId: string | null; onClose: () => void; canManage: boolean; canOpenClients: boolean }) {
  const query = useBusinessAccount(accountId);
  return (
    <Sheet open={accountId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[600px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{query.data?.name ?? "Conta empresarial"}</SheetTitle>
            <SheetDescription className="sr-only">Contrato, extractos e utilizadores da conta empresarial.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <Body key={`${data.id}-${data.contract.discountRate}-${data.contract.endsAt}`} account={data} canManage={canManage} canOpenClients={canOpenClients} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
