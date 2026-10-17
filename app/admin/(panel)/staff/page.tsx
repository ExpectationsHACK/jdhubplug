import type { Metadata } from "next";
import { Suspense } from "react";
import { requestNow } from "@/components/admin/core/clock";
import { AdminIcon } from "@/components/admin/core/icons";
import { NoAccess } from "@/components/admin/core/SettingsTabs";
import { StaffManager, type SafeStaff } from "@/components/admin/core/StaffManager";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ROLE_LABEL, can, requireAdmin, type Permission } from "@/lib/auth";
import { listStaff } from "@/lib/store";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Staff" };

const PERMISSIONS: { perm: Permission | "activity"; label: string }[] = [
  { perm: "orders:write", label: "Manage orders and confirm payments" },
  { perm: "leads:write", label: "Handle sell, swap and contact requests" },
  { perm: "products:write", label: "Add and edit products and prices" },
  { perm: "inventory:write", label: "Adjust stock levels" },
  { perm: "offers:write", label: "Create offers and special links" },
  { perm: "settings:write", label: "Change store settings" },
  { perm: "activity", label: "See the activity log" },
  { perm: "staff:manage", label: "Add and remove staff" },
  { perm: "danger", label: "Backups, restore and catalog reset" },
];

const ROLES: Role[] = ["owner", "manager", "support"];

const allowed = (role: Role, perm: Permission | "activity") => (perm === "activity" ? role !== "support" : can(role, perm));

export default function StaffPage() {
  return (
    <AdminPage>
      <PageHeader title="Staff" description="Give your team their own sign-in. Every change they make is recorded in the activity log." />
      <Suspense fallback={<div aria-busy="true" className="h-80 animate-pulse rounded-2xl bg-white" />}>
        <StaffBody />
      </Suspense>
    </AdminPage>
  );
}

async function StaffBody() {
  const session = await requireAdmin();
  if (!can(session.role, "staff:manage")) {
    return <NoAccess body="Only the store owner can add or change staff accounts." />;
  }
  const now = await requestNow();
  // Never send password hashes or salts to the browser.
  const staff: SafeStaff[] = (await listStaff()).map(({ id, name, email, role, active, createdAt, lastLoginAt }) => ({
    id,
    name,
    email,
    role,
    active,
    createdAt,
    lastLoginAt,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <StaffManager staff={staff} now={now} />

      <section aria-labelledby="roles-title" className="h-fit rounded-2xl border border-line bg-white p-4 md:p-5">
        <h2 id="roles-title" className="text-[16px] font-bold">
          What each role can do
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">Everyone can see the dashboard, orders, customers and settings.</p>
        <div className="-mx-4 mt-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[340px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.04em] text-muted">
                <th scope="col" className="px-4 pb-2 text-left font-bold md:px-5">
                  Permission
                </th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="px-2 pb-2 text-center font-bold last:pr-4 md:last:pr-5">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.perm} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink-2 md:px-5">
                    {p.label}
                  </th>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-2.5 text-center last:pr-4 md:last:pr-5">
                      {allowed(r, p.perm) ? (
                        <AdminIcon name="check" size={16} strokeWidth={2} className="mx-auto text-ok" label="Yes" />
                      ) : (
                        <AdminIcon name="minus" size={16} className="mx-auto text-[#c4c4c4]" label="No" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-stage px-3 py-2.5 text-[12px] text-ink-2">
          <AdminIcon name="info" size={15} className="mt-px shrink-0" />
          Deactivate someone to pause their access without losing their history. Changing a role asks them to sign in again.
        </p>
      </section>
    </div>
  );
}
