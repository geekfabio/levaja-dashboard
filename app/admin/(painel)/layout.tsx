import AdminShell from "@/components/admin/shell/admin-shell";

export default function PainelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
