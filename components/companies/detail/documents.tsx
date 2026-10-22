"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/data/documents";
import { useToday } from "@/hooks/use-today";
import { addDays } from "@/lib/follow-up";
import { formatDateShort, formatDateTimeShort } from "@/lib/format";
import { formatBytes, useDocumentsStore } from "@/stores/documents-store";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function Documents({ companyId }: { companyId: string }) {
  const allDocuments = useDocumentsStore((state) => state.documents);
  const documents = useMemo(() => allDocuments.filter((item) => item.companyId === companyId), [allDocuments, companyId]);
  const upload = useDocumentsStore((state) => state.upload);
  const remove = useDocumentsStore((state) => state.remove);
  const today = useToday();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>("Contrato");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string>();
  const withExpiry = category === "Contrato" || category === "Alvará";

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = upload(companyId, file, category, withExpiry ? expiresAt : undefined);
    setError(problem);
    if (!problem) setExpiresAt("");
  }

  return (
    <div className="flex flex-col gap-4">
      {documents.length === 0 ? (
        <p className="caption-style text-subtle">Sem documentos. Anexe contratos, alvarás ou documentos fiscais.</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {documents.map((document) => {
            const expired = document.expiresAt !== undefined && document.expiresAt < today;
            const expiring = !expired && document.expiresAt !== undefined && document.expiresAt <= addDays(today, 30);
            return (
              <li key={document.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {document.url ? (
                      <Button
                        variant="link"
                        size="none"
                        className="truncate font-medium no-underline"
                        onClick={() => window.open(document.url, "_blank", "noopener,noreferrer")}
                      >
                        {document.name}
                      </Button>
                    ) : (
                      <span className="lead-style truncate font-medium">{document.name}</span>
                    )}
                    <Tag tone="neutral" size="sm">{document.category}</Tag>
                    {expired && <Tag tone="red" size="sm">Expirou a {formatDateShort(document.expiresAt!)}</Tag>}
                    {expiring && <Tag tone="amber" size="sm">Expira a {formatDateShort(document.expiresAt!)}</Tag>}
                  </span>
                  <span className="caption-style text-subtle">
                    {formatBytes(document.size)} · {document.uploadedBy} · {formatDateTimeShort(document.uploadedAt)}
                    {!document.url && " · exemplo sem ficheiro"}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Remover ${document.name}`} onClick={() => remove(document.id)}>
                  <XIcon aria-hidden className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Categoria" htmlFor={`doc-category-${companyId}`}>
          <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
            <SelectTrigger id={`doc-category-${companyId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {withExpiry ? (
          <Field label="Válido até" htmlFor={`doc-expiry-${companyId}`}>
            <Input
              id={`doc-expiry-${companyId}`}
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="tabular-nums"
            />
          </Field>
        ) : (
          <span />
        )}
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Anexar ficheiro
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Ficheiro a anexar"
          onChange={onFile}
        />
      </div>
      {error && (
        <p role="alert" className="caption-style text-danger">
          {error}
        </p>
      )}
      <span className="caption-style text-subtle">
        PDF ou imagem até 10 MB. Nesta versão os ficheiros ficam só neste browser; com o Supabase passam para o Storage com acesso por perfil.
      </span>
    </div>
  );
}
