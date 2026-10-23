import type { Metadata } from "next";
import Finance from "@/components/admin/finance/finance";

export const metadata: Metadata = { title: "Finanças" };

export default function FinancasPage() {
  return <Finance />;
}
