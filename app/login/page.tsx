import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Login from "@/components/login/login";

export const metadata: Metadata = pageMetadata({
  title: "Entrar — Leva Já CRM",
  description: "Inicie sessão no CRM do Leva Já.",
  path: "/login",
});

export default function LoginPage() {
  return <Login />;
}
