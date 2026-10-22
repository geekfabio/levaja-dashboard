"use client";

import { useState, type ReactNode } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useUpdateSettings } from "@/hooks/admin/use-settings";
import { formatDateTimeNumeric } from "@/lib/format";
import { SETTINGS_SECTION_LABELS, settingsChanges, validateSettingsSection } from "@/lib/leva-ja/settings";
import type { PlatformSettings, SettingsSection } from "@/types/leva-ja";

export type SectionFieldsProps<K extends SettingsSection> = {
  draft: PlatformSettings[K];
  update: (patch: Partial<PlatformSettings[K]>) => void;
  replace: (next: PlatformSettings[K]) => void;
  issueFor: (field: string) => string | undefined;
  disabled: boolean;
};

type Props<K extends SettingsSection> = {
  section: K;
  settings: PlatformSettings;
  canEdit: boolean;
  description: string;
  children: (props: SectionFieldsProps<K>) => ReactNode;
};

export function numberFrom(raw: string) {
  const value = Number(raw.replace(",", "."));
  return raw.trim() === "" ? Number.NaN : value;
}

export function numberText(value: number) {
  return Number.isNaN(value) ? "" : String(value);
}

export default function SectionForm<K extends SettingsSection>({ section, settings, canEdit, description, children }: Props<K>) {
  const [draft, setDraft] = useState<PlatformSettings[K]>(() => structuredClone(settings[section]));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useUpdateSettings(section);
  const issues = validateSettingsSection(section, draft);
  const changes = settingsChanges(section, settings[section], draft);
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <SettingsPanel
      title={SETTINGS_SECTION_LABELS[section]}
      description={description}
      className="bg-card"
      actions={
        <span className="caption-style text-subtle">
          Última alteração por {settings.updatedBy} a {formatDateTimeNumeric(settings.updatedAt)}
        </span>
      }
    >
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">{SETTINGS_SECTION_LABELS[section]}</legend>
        {children({
          draft,
          update: (patch) => setDraft((current) => ({ ...current, ...patch })),
          replace: setDraft,
          issueFor,
          disabled: !canEdit,
        })}
      </fieldset>
      {canEdit ? (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="caption-style text-soft" aria-live="polite">
            {issues.length > 0
              ? issues[0].message
              : changes.length === 0
                ? "Sem alterações por guardar."
                : changes.length === 1
                  ? "1 alteração por guardar."
                  : `${changes.length} alterações por guardar.`}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" size="md" disabled={changes.length === 0} onClick={() => setDraft(structuredClone(settings[section]))}>
              Descartar
            </Button>
            <Button variant="primary" size="md" disabled={changes.length === 0 || issues.length > 0} onClick={() => setConfirmOpen(true)}>
              Guardar alterações
            </Button>
          </span>
        </div>
      ) : (
        <p className="caption-style text-subtle">O seu papel só pode consultar estas definições.</p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) mutation.reset();
        }}
        title={`Guardar ${SETTINGS_SECTION_LABELS[section].toLowerCase()}?`}
        description="As alterações aplicam-se de imediato e ficam registadas na auditoria."
        confirmLabel="Guardar"
        requireReason
        reasonLabel="Motivo da alteração"
        pending={mutation.isPending}
        error={mutationError(mutation.error)}
        onConfirm={(reason) => mutation.mutateAsync({ value: draft, reason }).then(() => setConfirmOpen(false), () => undefined)}
      >
        <ul className="caption-style text-soft flex max-h-[200px] flex-col gap-1 overflow-y-auto">
          {changes.map((change) => (
            <li key={change.field}>
              <span className="text-foreground">{change.field}:</span> {change.from} → {change.to}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </SettingsPanel>
  );
}
