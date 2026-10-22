import type { Metadata } from "next";
import RequestDetail from "@/components/admin/requests/detail/request-detail";

export const metadata: Metadata = { title: "Detalhe do pedido" };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
