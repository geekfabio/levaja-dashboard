import type { Metadata } from "next";
import Requests from "@/components/admin/requests/requests";

export const metadata: Metadata = { title: "Pedidos" };

export default function PedidosPage() {
  return <Requests />;
}
