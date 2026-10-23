import type { Metadata } from "next";
import Reports from "@/components/admin/reports/reports";

export const metadata: Metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return <Reports />;
}
