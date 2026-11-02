import AdminLogin from "@/components/admin/login/admin-login";
import { dataSource } from "@/data/leva-ja";

export default function LoginPage() {
  return <AdminLogin demo={dataSource() === "mock"} />;
}
