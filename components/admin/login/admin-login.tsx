import Asset from "@/components/_ui/asset";
import AdminLoginForm from "./admin-login-form";

export default function AdminLogin({ demo }: { demo: boolean }) {
  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Asset
            type="image"
            src="/assets/images/_common/brand/leva-ja-mark.svg"
            alt="AngoLeva"
            width={40}
            height={40}
            fit="contain"
            className="size-12"
          />
          <div className="flex flex-col gap-2">
            <h1 className="h2-style">Painel AngoLeva</h1>
            <p className="caption-style text-subtle">Entre com o seu e-mail de administrador.</p>
          </div>
        </div>
        <div className="border-border bg-card rounded-xl border p-6 shadow-overlay">
          <AdminLoginForm demo={demo} />
        </div>
        <p className="caption-style text-subtle text-center">Acesso restrito à equipa do AngoLeva.</p>
      </div>
    </main>
  );
}
