import { AdminPage, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardPage() {
  await requireAdmin();
  return (
    <AdminPage>
      <PageHeader title="Dashboard" description="Overview coming up." />
    </AdminPage>
  );
}
