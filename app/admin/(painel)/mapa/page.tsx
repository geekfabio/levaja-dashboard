import type { Metadata } from "next";
import OperationalMap from "@/components/admin/map/operational-map";

export const metadata: Metadata = { title: "Mapa operacional" };

export default function MapaPage() {
  return <OperationalMap />;
}
