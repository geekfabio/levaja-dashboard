import type { Metadata } from "next";
import Providers from "@/components/admin/providers/providers";

export const metadata: Metadata = { title: "Prestadores" };

export default function PrestadoresPage() {
  return <Providers />;
}
