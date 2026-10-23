import type { Metadata } from "next";
import Integrations from "@/components/admin/integrations/integrations";

export const metadata: Metadata = { title: "Integrações" };

export default function IntegracoesPage() {
  return <Integrations />;
}
