import type { Metadata } from "next";
import Overview from "@/components/admin/overview/overview";

export const metadata: Metadata = { title: "Visão geral" };

export default function AdminHomePage() {
  return <Overview />;
}
