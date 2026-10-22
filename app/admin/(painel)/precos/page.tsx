import type { Metadata } from "next";
import Pricing from "@/components/admin/pricing/pricing";

export const metadata: Metadata = { title: "Preços e zonas" };

export default function PrecosPage() {
  return <Pricing />;
}
