"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import { CURRENT_USER, DEFAULT_TREND, OWNERS, type Company, type CompanyProfile } from "@/data/companies";
import type { Contact } from "@/data/contacts";
import { useToday } from "@/hooks/use-today";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, plural } from "@/lib/format";
import {
  IMPORT_FIELDS,
  IMPORT_TEMPLATE,
  analyzeRows,
  guessMapping,
  parseCsv,
  type ImportAction,
  type ImportField,
  type ImportMapping,
  type ImportRow,
} from "@/lib/import";
import { cn, slugify } from "@/lib/utils";
import { recordEvent } from "@/stores/audit-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useSettingsStore } from "@/stores/settings-store";

type Step = "ficheiro" | "colunas" | "verificar";

const NONE = "nenhuma";
const MAX_BYTES = 2 * 1024 * 1024;

const ACTION_TONES: Record<ImportAction, "green" | "blue" | "neutral"> = {
  criar: "green",
  atualizar: "blue",
  ignorar: "neutral",
};

const ACTION_LABELS: Record<ImportAction, string> = {
  criar: "Criar",
  atualizar: "Atualizar",
  ignorar: "Ignorar",
};

function blankConsent(date: string) {
  return { granted: false, date, origin: "Importação de ficheiro" };
}

export default function ImportDialog() {
  const open = useCompaniesStore((state) => state.importOpen);
  const setOpen = useCompaniesStore((state) => state.setImportOpen);
  const companies = useCompaniesStore((state) => state.companies);
  const importCompanies = useCompaniesStore((state) => state.importCompanies);
  const zones = useSettingsStore((state) => state.zones);
  const today = useToday();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("ficheiro");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [overrides, setOverrides] = useState<Record<number, ImportAction>>({});
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  const headers = table[0] ?? [];
  const body = useMemo(() => table.slice(1), [table]);
  const analyzed = useMemo(
    () =>
      step === "verificar"
        ? analyzeRows(body, mapping, {
            companies,
            zones: zones.map((zone) => zone.name),
            owners: [CURRENT_USER.name, ...OWNERS.map((owner) => owner.name)],
            today,
          })
        : [],
    [step, body, mapping, companies, zones, today],
  );
  const rows: ImportRow[] = analyzed.map((row) =>
    row.errors.length === 0 && overrides[row.line] ? { ...row, action: overrides[row.line] } : row,
  );
  const count = (action: ImportAction) => rows.filter((row) => row.action === action).length;
  const withErrors = rows.filter((row) => row.errors.length > 0).length;

  function reset() {
    setStep("ficheiro");
    setFileName("");
    setTable([]);
    setMapping({});
    setOverrides({});
    setError(undefined);
  }

  async function load(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Use um ficheiro CSV. No Excel: Ficheiro → Guardar como → CSV (separado por vírgulas ou ponto e vírgula).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("O ficheiro tem mais de 2 MB. Divida-o em partes.");
      return;
    }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setError("O ficheiro não tem linhas de dados depois do cabeçalho.");
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(guessMapping(parsed[0]));
    setStep("colunas");
  }

  function confirm() {
    const created: Company[] = [];
    const updated: [string, CompanyProfile][] = [];
    const contacts: Contact[] = [];
    for (const row of rows) {
      if (row.action === "ignorar") continue;
      let companyId = row.matchId;
      if (row.action === "atualizar" && row.matchId) {
        const current = companies.find((company) => company.id === row.matchId);
        const base = current?.profile;
        updated.push([
          row.matchId,
          {
            ...row.profile,
            card: base?.card ?? "",
            customerSince: base?.customerSince || row.profile.customerSince,
            phone: row.profile.phone || base?.phone || "",
            billingEmail: row.profile.billingEmail || base?.billingEmail || "",
            address: row.profile.address || base?.address || "",
            municipality: row.profile.municipality || base?.municipality || "",
          },
        ]);
      } else {
        companyId = `${slugify(row.name)}-${crypto.randomUUID().slice(0, 6)}`;
        created.push({
          id: companyId,
          name: row.name,
          tags: [row.segment, "Novo cliente"],
          owner: row.owner,
          zone: row.zone,
          openDeals: 0,
          pipelineValue: 0,
          winProbability: 0,
          trend: DEFAULT_TREND,
          lastInteraction: { date: today, label: "Importado" },
          activityDays: 0,
          profile: row.profile,
        });
      }
      if (row.contact && companyId) {
        contacts.push({
          id: `ct-${crypto.randomUUID().slice(0, 8)}`,
          name: row.contact.name,
          role: row.contact.role || "Contacto",
          companyId,
          companyName: row.action === "atualizar" ? (row.matchName ?? row.name) : row.name,
          phone: row.contact.phone,
          whatsapp: row.contact.phone,
          email: row.contact.email,
          preferredLanguage: "Português",
          contactability: "Válido",
          consent: { email: blankConsent(today), sms: blankConsent(today), whatsapp: blankConsent(today) },
        });
      }
    }
    if (created.length + updated.length === 0) return;

    const undoCompanies = importCompanies(created, updated);
    const previousContacts = useContactsStore.getState().contacts;
    useContactsStore.setState({ contacts: [...contacts, ...previousContacts] });

    recordEvent({
      action: `importou ${fileName}:`,
      target: { module: "Clientes", label: `${plural(created.length, "cliente novo", "clientes novos")}, ${plural(updated.length, "atualizado", "atualizados")}` },
      sensitive: true,
      changes: [
        { field: "Clientes criados", to: formatNumber(created.length) },
        { field: "Clientes atualizados", to: formatNumber(updated.length) },
        { field: "Contactos criados", to: formatNumber(contacts.length) },
        { field: "Linhas ignoradas", to: formatNumber(count("ignorar")) },
      ],
      toast: {
        title: "Importação concluída",
        description: `${plural(created.length, "cliente criado", "clientes criados")}, ${plural(updated.length, "atualizado", "atualizados")}, ${plural(contacts.length, "contacto", "contactos")}.`,
        tone: "success",
        action: {
          label: "Anular",
          run: () => {
            undoCompanies();
            useContactsStore.setState({ contacts: previousContacts });
          },
        },
      },
    });
    setOpen(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    load(event.dataTransfer.files[0]);
  }

  const missingName = mapping.name === undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[760px]" onCloseAutoFocus={reset}>
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            {step === "ficheiro" && "Um cliente por linha, com contacto opcional. O NIF evita duplicados: um NIF que já existe atualiza a ficha."}
            {step === "colunas" && `${fileName} · ${plural(body.length, "linha", "linhas")}. Confirme a que campo corresponde cada coluna.`}
            {step === "verificar" && "Reveja o que vai acontecer a cada linha antes de importar."}
          </DialogDescription>
        </DialogHeader>

        {step === "ficheiro" && (
          <div className="flex flex-col gap-4 px-6 py-5">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-primary bg-white/4" : "border-line-strong",
              )}
            >
              <span className="lead-style font-medium">Arraste o ficheiro CSV para aqui</span>
              <span className="caption-style text-subtle">
                Do Excel: Ficheiro → Guardar como → CSV. Máximo 2 MB.
              </span>
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                Escolher ficheiro
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="sr-only"
                aria-label="Ficheiro CSV para importar"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  load(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            {error && (
              <p role="alert" className="caption-style text-danger">
                {error}
              </p>
            )}
            <Button
              variant="link"
              size="none"
              className="caption-style self-start"
              onClick={() => downloadCsv("modelo-importacao-clientes.csv", IMPORT_TEMPLATE)}
            >
              Descarregar modelo de ficheiro
            </Button>
          </div>
        )}

        {step === "colunas" && (
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => {
              const value = mapping[field.key as ImportField];
              const sample = value !== undefined ? body[0]?.[value] : undefined;
              return (
                <Field
                  key={field.key}
                  label={field.label}
                  htmlFor={`import-${field.key}`}
                  required={"required" in field && field.required}
                  hint={sample ? `Ex.: ${sample}` : undefined}
                  error={"required" in field && field.required && missingName ? "Escolha a coluna com o nome." : undefined}
                >
                  <Select
                    value={value === undefined ? NONE : String(value)}
                    onValueChange={(next) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: next === NONE ? undefined : Number(next),
                      }))
                    }
                  >
                    <SelectTrigger id={`import-${field.key}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não importar</SelectItem>
                      {headers.map((header, index) => (
                        <SelectItem key={`${header}-${index}`} value={String(index)}>
                          {header || `Coluna ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            })}
          </div>
        )}

        {step === "verificar" && (
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-wrap gap-2">
              <Tag tone="green">{plural(count("criar"), "a criar", "a criar")}</Tag>
              <Tag tone="blue">{plural(count("atualizar"), "a atualizar", "a atualizar")}</Tag>
              <Tag tone="neutral">{plural(count("ignorar"), "ignorada", "ignoradas")}</Tag>
              {withErrors > 0 && <Tag tone="red">{plural(withErrors, "com erro", "com erros")}</Tag>}
            </div>
            <ul className="divide-border flex flex-col divide-y rounded-lg border border-line-strong">
              {rows.map((row) => (
                <li key={row.line} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="lead-style truncate">
                      <span className="text-subtle tabular-nums">Linha {row.line} · </span>
                      {row.name || "Sem nome"}
                      {row.matchName && row.action === "atualizar" && (
                        <span className="text-soft"> → atualiza {row.matchName}</span>
                      )}
                    </span>
                    {[...row.errors.map((text) => ({ text, error: true })), ...row.warnings.map((text) => ({ text, error: false }))].map(
                      (item) => (
                        <span key={item.text} className={cn("caption-style", item.error ? "text-danger" : "text-(--tag-amber-text)")}>
                          {item.text}
                        </span>
                      ),
                    )}
                    {row.contact && (
                      <span className="caption-style text-subtle">
                        Contacto: {row.contact.name}
                        {row.contact.role && ` (${row.contact.role})`} — sem consentimento até ser registado.
                      </span>
                    )}
                  </div>
                  {row.errors.length > 0 ? (
                    <Tag tone="red" size="sm" className="shrink-0 self-start">
                      Ignorar
                    </Tag>
                  ) : (
                    <Select
                      value={row.action}
                      onValueChange={(value) => setOverrides((current) => ({ ...current, [row.line]: value as ImportAction }))}
                    >
                      <SelectTrigger aria-label={`Ação para a linha ${row.line}`} className="h-[30px] w-[130px] shrink-0 self-start">
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={cn("size-1.5 rounded-full", ACTION_TONES[row.action] === "green" ? "bg-success" : ACTION_TONES[row.action] === "blue" ? "bg-primary" : "bg-subtle")} />
                          {ACTION_LABELS[row.action]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {(row.matchId ? (["atualizar", "criar", "ignorar"] as const) : (["criar", "ignorar"] as const)).map((action) => (
                          <SelectItem key={action} value={action}>
                            {ACTION_LABELS[action]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="justify-between">
          {step === "ficheiro" ? (
            <span />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setStep(step === "verificar" ? "colunas" : "ficheiro")}>
              Voltar
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {step === "colunas" && (
              <Button variant="primary" size="sm" disabled={missingName} onClick={() => setStep("verificar")}>
                Verificar linhas
              </Button>
            )}
            {step === "verificar" && (
              <Button variant="primary" size="sm" disabled={count("criar") + count("atualizar") === 0} onClick={confirm}>
                Importar {formatNumber(count("criar") + count("atualizar"))}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
