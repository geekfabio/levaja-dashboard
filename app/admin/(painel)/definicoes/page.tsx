import type { Metadata } from "next";
import AdminSettings from "@/components/admin/settings/admin-settings";

export const metadata: Metadata = { title: "Definições" };

export default function DefinicoesPage() {
  return <AdminSettings />;
}
