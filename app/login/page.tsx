import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Login from "@/components/login/login";

export const metadata: Metadata = pageMetadata({
  title: "Entrar — Alimenta Angola CRM",
  description: "Inicie sessão no CRM da Alimenta Angola.",
  path: "/login",
});

export default function LoginPage() {
  return <Login />;
}
