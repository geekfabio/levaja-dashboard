import Asset from "@/components/_ui/asset";
import LoginForm from "./login-form";

export default function Login() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[384px] flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Asset
            type="image"
            src="/assets/images/_common/brand/alimenta-angola-logo.png"
            alt="Alimenta Angola"
            width={96}
            height={64}
            fit="contain"
            className="size-12"
          />
          <div className="flex flex-col gap-1">
            <h1 className="h2-style">Alimenta Angola CRM</h1>
            <p className="caption-style text-subtle">
              Entre com a sua conta para aceder à carteira de clientes.
            </p>
          </div>
        </div>

        <div className="border-border bg-card rounded-xl border p-6 shadow-overlay">
          <LoginForm />
        </div>

        <p className="caption-style text-subtle text-center">
          Acesso restrito à equipa da Alimenta Angola.
        </p>
      </div>
    </main>
  );
}
