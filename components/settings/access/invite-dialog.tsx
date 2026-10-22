"use client";

import { useState, type FormEvent } from "react";
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
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FormSection from "@/components/_common/form-section";
import { ROLES, ROLE_DESCRIPTIONS, type Role } from "@/data/settings";
import { isEmail } from "@/lib/settings";
import { useSettingsStore } from "@/stores/settings-store";

const EMPTY_FORM = { name: "", email: "", role: "Comercial" as Role };

export default function InviteDialog() {
  const open = useSettingsStore((state) => state.inviteOpen);
  const setOpen = useSettingsStore((state) => state.setInviteOpen);
  const inviteUser = useSettingsStore((state) => state.inviteUser);
  const users = useSettingsStore((state) => state.users);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const email = form.email.trim().toLowerCase();
  const errors = {
    name: form.name.trim() ? undefined : "Indique o nome.",
    email: !isEmail(email)
      ? "E-mail inválido."
      : users.some((user) => user.email.toLowerCase() === email)
        ? "Este e-mail já tem acesso ou um convite pendente."
        : undefined,
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.email) return;
    inviteUser({ name: form.name.trim(), email, role: form.role });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[480px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setSubmitted(false);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Convidar para a equipa</DialogTitle>
            <DialogDescription>
              O convite fica pendente até a pessoa aceitar. Nesta versão nenhum e-mail é
              enviado.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Pessoa">
            <Field
              label="Nome"
              htmlFor="invite-name"
              required
              error={submitted ? errors.name : undefined}
            >
              <Input
                id="invite-name"
                value={form.name}
                autoFocus
                autoComplete="off"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field
              label="E-mail"
              htmlFor="invite-email"
              required
              error={submitted ? errors.email : undefined}
            >
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Perfil" htmlFor="invite-role" hint={ROLE_DESCRIPTIONS[form.role]}>
              <Select
                value={form.role}
                onValueChange={(role) => setForm({ ...form, role: role as Role })}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit">
              Criar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
