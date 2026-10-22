"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";

type Mode = "login" | "recover";
type Status = "idle" | "loading" | "success";

async function submitLogin(email: string, password: string) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { email, password };
}

async function submitRecovery(email: string) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { email };
}

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Indique o seu e-mail.");
      return;
    }
    if (mode === "login" && !password) {
      setError("Indique a sua palavra-passe.");
      return;
    }

    setError(null);
    setStatus("loading");

    if (mode === "login") {
      await submitLogin(email.trim(), password);
    } else {
      await submitRecovery(email.trim());
    }

    setStatus("success");
  }

  if (mode === "recover" && status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <p className="p-style text-soft">
          Se existir uma conta com o e-mail <strong>{email}</strong>, vai
          receber uma mensagem com as instruções para repor a palavra-passe.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => switchMode("login")}
        >
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" htmlFor="login-email" required>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="nome@alimentaangola.co.ao"
          autoFocus
        />
      </Field>

      {mode === "login" && (
        <Field
          label="Palavra-passe"
          htmlFor="login-password"
          required
          error={error ?? undefined}
          trailing={
            <button
              type="button"
              onClick={() => switchMode("recover")}
              className="caption-style text-subtle hover:text-soft cursor-pointer underline decoration-from-font underline-offset-2"
            >
              Esqueceu-se da palavra-passe?
            </button>
          }
        >
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
          />
        </Field>
      )}

      {mode === "recover" && error && (
        <span role="alert" className="caption-style text-danger block">
          {error}
        </span>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={status === "loading"}
        className="mt-2 justify-center"
      >
        {status === "loading"
          ? "A processar…"
          : mode === "login"
            ? "Entrar"
            : "Enviar recuperação"}
      </Button>

      {mode === "recover" && (
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="caption-style text-subtle hover:text-soft mx-auto cursor-pointer underline decoration-from-font underline-offset-2"
        >
          Voltar ao login
        </button>
      )}
    </form>
  );
}
