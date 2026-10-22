import type { Metadata } from "next";
import Refunds from "@/components/admin/refunds/refunds";

export const metadata: Metadata = { title: "Reembolsos" };

export default function ReembolsosPage() {
  return <Refunds />;
}
