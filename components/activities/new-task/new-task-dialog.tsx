"use client";

import { useCompaniesStore } from "@/stores/companies-store";
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
import { OWNERS } from "@/data/companies";
import type { Task } from "@/data/tasks";
import { useActivitiesStore } from "@/stores/activities-store";
import CheckSquareIcon from "@/public/assets/images/companies/table/check-square.svg";

const NO_COMPANY = "none";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type FormState = {
  title: string;
  companyId: string;
  assignee: string;
  dueDate: string;
  reminderDate: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  companyId: NO_COMPANY,
  assignee: OWNERS[0].name,
  dueDate: today(),
  reminderDate: "",
  notes: "",
};

export default function NewTaskDialog() {
  const companies = useCompaniesStore((state) => state.companies);
  const open = useActivitiesStore((state) => state.newTaskOpen);
  const setOpen = useActivitiesStore((state) => state.setNewTaskOpen);
  const addTask = useActivitiesStore((state) => state.addTask);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setTitleError("Indique o título da tarefa.");
      titleRef.current?.focus();
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);

    const task: Task = {
      id: `task-${Date.now()}`,
      title,
      companyId: company?.id,
      companyName: company?.name,
      assignee: form.assignee,
      dueDate: form.dueDate || today(),
      reminderDate: form.reminderDate || undefined,
      status: "Por Fazer",
      notes: form.notes.trim() || undefined,
    };

    addTask(task);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[520px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setTitleError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            <DialogDescription>
              Crie uma tarefa com responsável e prazo. Aparece no quadro em
              &ldquo;Por Fazer&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Tarefa">
            <Field
              label="Título"
              htmlFor="task-title"
              required
              error={titleError ?? undefined}
            >
              <Input
                ref={titleRef}
                id="task-title"
                value={form.title}
                onChange={(event) => {
                  update("title", event.target.value);
                  if (titleError) setTitleError(null);
                }}
                placeholder="Resumo da tarefa"
                aria-invalid={titleError ? true : undefined}
                className="aria-invalid:border-danger"
                autoFocus
              />
            </Field>

            <Field label="Cliente" htmlFor="task-company">
              <Select
                value={form.companyId}
                onValueChange={(value) => update("companyId", value)}
              >
                <SelectTrigger id="task-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>Sem cliente associado</SelectItem>
                  {companies.filter((company) => !company.archived).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Responsável" htmlFor="task-assignee">
              <Select
                value={form.assignee}
                onValueChange={(value) => update("assignee", value)}
              >
                <SelectTrigger id="task-assignee">
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prazo" htmlFor="task-due">
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => update("dueDate", event.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Lembrete" htmlFor="task-reminder">
                <Input
                  id="task-reminder"
                  type="date"
                  value={form.reminderDate}
                  onChange={(event) => update("reminderDate", event.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>

            <Field label="Notas" htmlFor="task-notes">
              <Textarea
                id="task-notes"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Detalhe a tarefa (opcional)"
                rows={3}
              />
            </Field>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              <CheckSquareIcon aria-hidden className="size-3" />
              Criar Tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
