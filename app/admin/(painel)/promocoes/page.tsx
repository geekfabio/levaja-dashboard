import type { Metadata } from "next";
import Promotions from "@/components/admin/promotions/promotions";

export const metadata: Metadata = { title: "Promoções" };

export default function PromocoesPage() {
  return <Promotions />;
}
