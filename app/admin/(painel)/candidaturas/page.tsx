import type { Metadata } from "next";
import Applications from "@/components/admin/applications/applications";

export const metadata: Metadata = { title: "Candidaturas" };

export default function CandidaturasPage() {
  return <Applications />;
}
