import type { Metadata } from "next";
import AdminArea from "@/components/admin/shell/admin-area";
import Toaster from "@/components/_ui/toaster";

export const metadata: Metadata = {
  title: { default: "Painel AngoLeva", template: "%s — Painel AngoLeva" },
  description: "Painel de administração do AngoLeva: pedidos, prestadores, clientes, finanças e suporte.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminArea>
      {children}
      <Toaster />
    </AdminArea>
  );
}
