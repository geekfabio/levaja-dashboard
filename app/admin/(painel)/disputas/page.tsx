import type { Metadata } from "next";
import Disputes from "@/components/admin/disputes/disputes";

export const metadata: Metadata = { title: "Disputas" };

export default function DisputasPage() {
  return <Disputes />;
}
