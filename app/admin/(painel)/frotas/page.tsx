import type { Metadata } from "next";
import Fleets from "@/components/admin/fleets/fleets";

export const metadata: Metadata = { title: "Frotas" };

export default function FrotasPage() {
  return <Fleets />;
}
