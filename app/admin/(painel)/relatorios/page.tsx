import type { Metadata } from "next";
import AdminHeader from "@/components/admin/shell/admin-header";

export const metadata: Metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Relatórios" />
      <div className="p-5">
        <p className="lead-style">Os relatórios ainda não estão disponíveis.</p>
        <p className="caption-style text-subtle max-w-[40em] pt-1">O servidor ainda não gera os relatórios de operação, finanças, prestadores, zonas e contas empresariais.</p>
      </div>
    </section>
  );
}
