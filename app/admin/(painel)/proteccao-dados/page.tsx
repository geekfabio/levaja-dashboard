import type { Metadata } from "next";
import Privacy from "@/components/admin/privacy/privacy";

export const metadata: Metadata = { title: "Protecção de dados" };

export default function ProteccaoDadosPage() {
  return <Privacy />;
}
