"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { errorMessage, repositories } from "@/data/leva-ja";
import { safeNextRoute } from "@/lib/leva-ja/navigation";
import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { toast } from "@/stores/toast-store";
import type { AdminRole } from "@/types/leva-ja";

type Step = "email" | "code";

export const DEMO_ACCOUNTS: { email: string; role: AdminRole }[] = [
  { email: "admin@levaja.ao", role: "admin" },
  { email: "operacoes@levaja.ao", role: "operations" },
  { email: "suporte@levaja.ao", role: "support" },
  { email: "financas@levaja.ao", role: "finance" },
];

function nextParam() {
  return new URLSearchParams(window.location.search).get("next");
}

export default function AdminLoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const status = useAdminSessionStore((state) => state.status);
  const session = useAdminSessionStore((state) => state.session);
  const load = useAdminSessionStore((state) => state.load);
  const login = useAdminSessionStore((state) => state.login);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "loading") load();
  }, [status, load]);

  useEffect(() => {
    if (status === "authenticated" && session && !pending) router.replace(safeNextRoute(nextParam(), session.user.role));
  }, [status, session, pending, router]);

  async function requestCode(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    const value = (override ?? email).trim();
    if (!value) {
      setError("Indique o seu e-mail.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await repositories().auth.requestCode(value);
      setEmail(value);
      setSentTo(result.sentTo);
      setStep("code");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("O código tem 6 dígitos.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await login(email, code);
      toast({ title: `Bem-vindo, ${created.user.name.split(" ")[0]}`, description: ROLE_LABELS[created.user.role], tone: "success" });
      router.replace(safeNextRoute(nextParam(), created.user.role));
    } catch (failure) {
      setError(errorMessage(failure));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "email" ? (
        <form onSubmit={(event) => requestCode(event)} noValidate className="flex flex-col gap-4">
          <Field label="E-mail" htmlFor="admin-email" required error={error ?? undefined}>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="nome@levaja.ao"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="md" disabled={pending} className="justify-center">
            {pending ? "A enviar…" : "Receber código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="flex flex-col gap-4">
          <p className="caption-style text-soft">
            Enviámos um código de 6 dígitos para <strong className="text-foreground font-medium">{sentTo}</strong>.
          </p>
          <Field label="Código de acesso" htmlFor="admin-code" required error={error ?? undefined}>
            <Input
              id="admin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-code-error" : undefined}
              className="tracking-[0.4em] tabular-nums"
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ""));
                if (error) setError(null);
              }}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="md" disabled={pending} className="justify-center">
            {pending ? "A verificar…" : "Entrar"}
          </Button>
          <Button
            variant="link"
            size="none"
            className="caption-style mx-auto"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Usar outro e-mail
          </Button>
        </form>
      )}

      {demo && (
        <div className="border-border flex flex-col gap-3 border-t pt-5">
          <p className="caption-style text-subtle">
            Contas de demonstração (código <strong className="text-foreground font-medium tabular-nums">123456</strong>):
          </p>
          <ul className="flex flex-col gap-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <Button
                  variant="item"
                  size="md"
                  className="justify-between"
                  disabled={pending}
                  onClick={() => {
                    setCode("");
                    requestCode(undefined, account.email);
                  }}
                >
                  <span className="truncate">{account.email}</span>
                  <span className="caption-style text-subtle shrink-0">{ROLE_LABELS[account.role]}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
