import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { ROLE_LABEL, requireAdmin, usingDevPassword } from "@/lib/auth";
import { storageStatus } from "@/lib/store";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | JDHub Admin" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <Suspense fallback={<ShellFallback />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const storage = storageStatus();
  return (
    <div className="flex">
      <AdminNav role={session.role} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="lg:hidden" />
          <Link href="/" target="_blank" className="text-[13px] font-bold text-muted hover:text-ink">
            View store ↗
          </Link>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="hidden text-ink-2 sm:inline">
              {session.name} · {ROLE_LABEL[session.role]}
            </span>
            <form action={logoutAction}>
              <button className="rounded-full border border-line px-3 py-1.5 font-bold hover:border-ink">Sign out</button>
            </form>
          </div>
        </header>
        {!storage.persistent && (
          <div className="border-b border-[#f5c06b] bg-[#fff8eb] px-4 py-2.5 text-[13px] text-[#7a4b00] md:px-8">
            <b>Storage isn&apos;t permanent yet.</b> {storage.hint}
          </div>
        )}
        {usingDevPassword() && (
          <div className="border-b border-line bg-[#eef3ff] px-4 py-2 text-[13px] text-accent-deep md:px-8">
            Development mode: signed in with the default password. Set <code>ADMIN_PASSWORD</code> before going live.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex">
      <div className="hidden h-screen w-64 border-r border-line bg-white lg:block" />
      <div className="flex-1 p-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-line" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
