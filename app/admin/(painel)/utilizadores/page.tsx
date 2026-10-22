import type { Metadata } from "next";
import Users from "@/components/admin/users/users";

export const metadata: Metadata = { title: "Utilizadores do painel" };

export default function UtilizadoresPage() {
  return <Users />;
}
