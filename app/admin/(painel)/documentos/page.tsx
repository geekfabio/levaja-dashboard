import type { Metadata } from "next";
import Documents from "@/components/admin/documents/documents";

export const metadata: Metadata = { title: "Validação de documentos" };

export default function DocumentosPage() {
  return <Documents />;
}
