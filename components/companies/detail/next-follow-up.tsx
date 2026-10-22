"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
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
import type { Company } from "@/data/companies";
import { FOLLOW_UP_TYPES, type FollowUpType } from "@/data/follow-ups";
import { useToday } from "@/hooks/use-today";
import { formatDateLong } from "@/lib/format";
import { addDays, followUpDueLabel } from "@/lib/follow-up";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";
import { CALENDAR_PROVIDERS } from "@/data/calendar-sync";
import Asset from "@/components/_ui/asset";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

export default function NextFollowUp({ company }: { company: Company }) {
  const scheduleFollowUp = useCompaniesStore((state) => state.scheduleFollowUp);
  const startActivity = useActivitiesStore((state) => state.startActivity);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [type, setType] = useState<FollowUpType>("Chamada");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const followUp = company.nextFollowUp;
  const synced = useCalendarSyncStore((state) => state.synced);
  const syncedProviders = CALENDAR_PROVIDERS.filter((provider) =>
    synced.some((event) => event.uid === `followup-${company.id}` && event.provider === provider.id),
  );

  function openForm() {
    setDate(followUp?.date ?? addDays(today, 1));
    setType(followUp?.type ?? "Chamada");
    setNote(followUp?.note ?? "");
    setError(undefined);
    setEditing(true);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError("Indique a data.");
      return;
    }
    scheduleFollowUp(company.id, {
      date,
      type,
      note: note.trim(),
      owner: followUp?.owner ?? company.owner,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save} noValidate className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data" htmlFor="follow-up-date" required error={error}>
            <Input
              id="follow-up-date"
              type="date"
              min={today}
              value={date}
              autoFocus
              onChange={(event) => {
                setDate(event.target.value);
                setError(undefined);
              }}
              className="tabular-nums"
            />
          </Field>
          <Field label="Como" htmlFor="follow-up-type">
            <Select value={type} onValueChange={(value) => setType(value as FollowUpType)}>
              <SelectTrigger id="follow-up-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Motivo" htmlFor="follow-up-note">
          <Input
            id="follow-up-note"
            value={note}
            placeholder="Ex.: confirmar encomenda da próxima semana"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="subtle" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Agendar
          </Button>
        </div>
      </form>
    );
  }

  if (!followUp) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="caption-style text-subtle">Sem próximo contacto agendado.</span>
        <Button variant="secondary" size="sm" onClick={openForm}>
          Agendar contacto
        </Button>
      </div>
    );
  }

  const overdue = followUp.date < today;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={overdue ? "red" : followUp.date === today ? "amber" : "blue"} size="sm">
          {followUpDueLabel(followUp.date, today)}
        </Tag>
        <span className="lead-style font-medium">
          {followUp.type} · {formatDateLong(followUp.date)}
        </span>
      </div>
      {followUp.note && <p className="lead-style text-soft">{followUp.note}</p>}
      <span className="caption-style text-subtle flex flex-wrap items-center gap-1.5">
        Responsável: {followUp.owner}
        {syncedProviders.length > 0 && (
          <>
            {" · no calendário"}
            {syncedProviders.map((provider) => (
              <Asset key={provider.id} type="image" src={provider.logo} alt={provider.name} width={1} height={1} fit="contain" className="size-3.5" />
            ))}
          </>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            startActivity({
              companyId: company.id,
              type: followUp.type === "Visita" || followUp.type === "Reunião" || followUp.type === "E-mail" ? followUp.type : "Chamada",
              followUpNote: followUp.note || undefined,
            })
          }
        >
          Registar contacto
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Adiar
              <ChevronIcon aria-hidden className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[
              { label: "Amanhã", days: 1 },
              { label: "Daqui a 3 dias", days: 3 },
              { label: "Daqui a 1 semana", days: 7 },
            ].map((option) => (
              <DropdownMenuItem
                key={option.days}
                onSelect={() => scheduleFollowUp(company.id, { ...followUp, date: addDays(today, option.days) })}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={openForm}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => scheduleFollowUp(company.id, null)}>
          Remover
        </Button>
      </div>
    </div>
  );
}
