import type { Metadata } from "next";
import Billing from "@/components/admin/billing/billing";

export const metadata: Metadata = { title: "Facturação" };

export default function FacturacaoPage() {
  return <Billing />;
}
