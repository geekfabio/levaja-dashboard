import type { Metadata } from "next";
import ClientDetail from "@/components/admin/clients/detail/client-detail";

export const metadata: Metadata = { title: "Detalhe do cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetail id={id} />;
}
