import type { Metadata } from "next";
import Communications from "@/components/admin/communications/communications";

export const metadata: Metadata = { title: "Comunicações" };

export default function ComunicacoesPage() {
  return <Communications />;
}
