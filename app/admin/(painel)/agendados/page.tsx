import type { Metadata } from "next";
import Scheduled from "@/components/admin/scheduled/scheduled";

export const metadata: Metadata = { title: "Agendados" };

export default function AgendadosPage() {
  return <Scheduled />;
}
