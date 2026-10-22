"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import FormSection from "@/components/_common/form-section";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { COMPANIES, OWNERS } from "@/data/companies";
import { useSettingsStore } from "@/stores/settings-store";
import { ACTIVITY_TYPES, type Activity, type ActivityType } from "@/data/activities";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { FOLLOW_UP_TYPES, type FollowUpType } from "@/data/follow-ups";
import { formatDateShort } from "@/lib/format";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type FormState = {
  type: ActivityType;
  companyId: string;
  contactName: string;
  owner: string;
  zone: string;
  date: string;
  note: string;
  nextDate: string;
  nextType: FollowUpType;
};

const EMPTY_FORM: FormState = {
  type: ACTIVITY_TYPES[0],
  companyId: COMPANIES[0].id,
  contactName: "",
  owner: OWNERS[0].name,
  zone: "",
  date: today(),
  note: "",
  nextDate: "",
  nextType: "Chamada",
};

export default function NewActivityDialog() {
  const open = useActivitiesStore((state) => state.newActivityOpen);
  const setOpen = useActivitiesStore((state) => state.setNewActivityOpen);
  const addActivity = useActivitiesStore((state) => state.addActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const removeActivity = useActivitiesStore((state) => state.removeActivity);
  const editingId = useActivitiesStore((state) => state.editingActivityId);
  const editing = useActivitiesStore((state) =>
    state.activities.find((item) => item.id === state.editingActivityId),
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (open && editing && loadedFor !== editing.id) {
    setLoadedFor(editing.id);
    setForm({
      type: editing.type,
      companyId: editing.companyId,
      contactName: editing.contactName ?? "",
      owner: editing.owner,
      zone: editing.zone,
      date: editing.date,
      note: editing.note,
      nextDate: "",
      nextType: "Chamada",
    });
  }
  const prefill = useActivitiesStore((state) => state.prefill);
  const prefillCompany = useCompaniesStore((state) =>
    state.companies.find((company) => company.id === prefill?.companyId),
  );
  const prefillKey = prefill ? `prefill-${prefill.companyId}-${prefill.type}` : null;
  if (open && !editing && prefill && prefillCompany && loadedFor !== prefillKey) {
    setLoadedFor(prefillKey);
    setForm({
      ...EMPTY_FORM,
      type: prefill.type,
      companyId: prefill.companyId,
      owner: prefillCompany.nextFollowUp?.owner ?? prefillCompany.owner,
      zone: prefillCompany.zone,
      date: today(),
    });
  }
  const scheduleFollowUp = useCompaniesStore((state) => state.scheduleFollowUp);
  const zones = useSettingsStore((state) => state.zones);
  const companies = useCompaniesStore((state) => state.companies);
  const zone = form.zone || zones[0]?.name || "";
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const pendingFollowUp = companies.find((item) => item.id === form.companyId)?.nextFollowUp;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = form.note.trim();
    if (!note) {
      setNoteError("Descreva o registo.");
      noteRef.current?.focus();
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    if (!company) return;

    if (editingId) {
      updateActivity(editingId, {
        type: form.type,
        companyId: company.id,
        companyName: company.name,
        contactName: form.contactName.trim() || undefined,
        owner: form.owner,
        zone,
        date: form.date || today(),
        note,
      });
      return;
    }

    const activity: Activity = {
      id: `act-${Date.now()}`,
      type: form.type,
      companyId: company.id,
      companyName: company.name,
      contactName: form.contactName.trim() || undefined,
      owner: form.owner,
      zone,
      date: form.date || today(),
      note,
    };

    addActivity(activity);
    if (form.nextDate) {
      scheduleFollowUp(
        company.id,
        { date: form.nextDate, type: form.nextType, note: "", owner: form.owner },
        { silent: true },
      );
    } else if (company.nextFollowUp && company.nextFollowUp.date <= activity.date) {
      scheduleFollowUp(company.id, null, { silent: true });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[520px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setLoadedFor(null);
          setNoteError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Registo" : "Novo Registo"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Corrija os dados do registo. A alteração fica no registo de auditoria."
                : "Regista uma visita, chamada ou outra interação. Aparece na lista e no calendário de imediato."}
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Interação">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" htmlFor="activity-type">
                <Select
                  value={form.type}
                  onValueChange={(value) => update("type", value as ActivityType)}
                >
                  <SelectTrigger id="activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" htmlFor="activity-date">
                <Input
                  id="activity-date"
                  type="date"
                  value={form.date}
                  onChange={(event) => update("date", event.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>

            <Field label="Cliente" htmlFor="activity-company">
              <Select
                value={form.companyId}
                onValueChange={(value) => update("companyId", value)}
              >
                <SelectTrigger id="activity-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter((company) => !company.archived || company.id === form.companyId).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contacto" htmlFor="activity-contact">
                <Input
                  id="activity-contact"
                  value={form.contactName}
                  onChange={(event) => update("contactName", event.target.value)}
                  placeholder="Nome do contacto"
                  autoComplete="off"
                />
              </Field>
              <Field label="Zona" htmlFor="activity-zone">
                <Select
                  value={zone}
                  onValueChange={(value) =>
                    update("zone", value)
                  }
                >
                  <SelectTrigger id="activity-zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Gestor" htmlFor="activity-owner">
              <Select
                value={form.owner}
                onValueChange={(value) => update("owner", value)}
              >
                <SelectTrigger id="activity-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERS.map((owner) => (
                    <SelectItem key={owner.name} value={owner.name}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Nota"
              htmlFor="activity-note"
              required
              error={noteError ?? undefined}
            >
              <Textarea
                ref={noteRef}
                id="activity-note"
                value={form.note}
                onChange={(event) => {
                  update("note", event.target.value);
                  if (noteError) setNoteError(null);
                }}
                placeholder="Descreva a interação"
                aria-invalid={noteError ? true : undefined}
                className="aria-invalid:border-danger"
                rows={3}
                autoFocus
              />
            </Field>
          </FormSection>

          {!editingId && (
            <FormSection title="Próximo passo">
              {prefill?.followUpNote && (
                <p className="caption-style text-subtle">Motivo do seguimento: {prefill.followUpNote}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Voltar a contactar a"
                  htmlFor="activity-next-date"
                  hint="Opcional. Aparece em Follow-up nesse dia."
                >
                  <Input
                    id="activity-next-date"
                    type="date"
                    min={today()}
                    value={form.nextDate}
                    onChange={(event) => update("nextDate", event.target.value)}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Como" htmlFor="activity-next-type">
                  <Select value={form.nextType} onValueChange={(value) => update("nextType", value as FollowUpType)}>
                    <SelectTrigger id="activity-next-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOLLOW_UP_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {pendingFollowUp && !form.nextDate && (
                <p className="caption-style text-soft">
                  Este registo dá por concluído o contacto agendado ({pendingFollowUp.type.toLowerCase()} a{" "}
                  {formatDateShort(pendingFollowUp.date)}).
                </p>
              )}
            </FormSection>
          )}

          <DialogFooter>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto"
                onClick={() => removeActivity(editingId)}
              >
                Eliminar
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              {!editingId && <PlusIcon aria-hidden className="size-3" />}
              {editingId ? "Guardar alterações" : "Criar Registo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
