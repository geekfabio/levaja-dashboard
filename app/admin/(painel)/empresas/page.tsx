import type { Metadata } from "next";
import Business from "@/components/admin/business/business";

export const metadata: Metadata = { title: "Contas empresariais" };

export default function EmpresasPage() {
  return <Business />;
}
