import type { Metadata } from "next";
import AdminLogin from "@/components/admin/login/admin-login";
import { dataSource } from "@/data/leva-ja";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Inicie sessão no painel de administração do Leva Já.",
};

export default function AdminLoginPage() {
  return <AdminLogin demo={dataSource() === "mock"} />;
}
