import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityTable } from "@/components/admin/core/ActivityTable";
import { requestNow } from "@/components/admin/core/clock";
import { NoAccess } from "@/components/admin/core/SettingsTabs";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/store";

export const metadata: Metadata = { title: "Activity log" };

export default function ActivityPage() {
  return (
    <AdminPage>
      <PageHeader title="Activity log" description="Who changed what, and when. The latest 500 entries are shown; the log keeps the most recent 1,000." />
      <Suspense fallback={<ActivitySkeleton />}>
        <ActivityBody />
      </Suspense>
    </AdminPage>
  );
}

async function ActivityBody() {
  const session = await requireAdmin();
  if (session.role !== "owner" && session.role !== "manager") {
    return <NoAccess body="The activity log is available to the owner and managers." />;
  }
  const entries = await listAudit(500);
  return <ActivityTable entries={entries} now={await requestNow()} />;
}

function ActivitySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity">
      <div className="mb-4 h-11 w-full max-w-sm animate-pulse rounded-xl bg-white" />
      <div className="space-y-px overflow-hidden rounded-2xl border border-line bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-[#fafbfc]" />
        ))}
      </div>
    </div>
  );
}
