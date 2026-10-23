import type { Metadata } from "next";
import Claims from "@/components/admin/claims/claims";

export const metadata: Metadata = { title: "Sinistros" };

export default function SinistrosPage() {
  return <Claims />;
}
