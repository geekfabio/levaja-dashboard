import type { Metadata } from "next";
import Support from "@/components/admin/support/support";

export const metadata: Metadata = { title: "Suporte" };

export default function SuportePage() {
  return <Support />;
}
