import type { Metadata } from "next";
import AuditLog from "@/components/admin/audit/audit-log";

export const metadata: Metadata = { title: "Auditoria" };

export default function AuditoriaPage() {
  return <AuditLog />;
}
