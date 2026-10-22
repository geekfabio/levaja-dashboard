import type { Metadata } from "next";
import Clients from "@/components/admin/clients/clients";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientesPage() {
  return <Clients />;
}
