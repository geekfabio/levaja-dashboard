import type { Metadata } from "next";
import AdminArea from "@/components/admin/shell/admin-area";
import Toaster from "@/components/_ui/toaster";

export const metadata: Metadata = {
  title: "Entrar — Painel AngoLeva",
  description: "Inicie sessão no painel de administração do AngoLeva.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminArea>
      {children}
      <Toaster />
    </AdminArea>
  );
}
