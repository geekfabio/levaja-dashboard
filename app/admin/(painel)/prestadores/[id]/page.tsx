import type { Metadata } from "next";
import ProviderDetail from "@/components/admin/providers/detail/provider-detail";

export const metadata: Metadata = { title: "Detalhe do prestador" };

export default async function PrestadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderDetail id={id} />;
}
