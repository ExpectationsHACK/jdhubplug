import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { initials } from "@/components/admin/core/format";
import { AdminIcon } from "@/components/admin/core/icons";
import { assertStaffStillValid, getNavBadges } from "@/components/admin/core/shell-data";
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
      <a
        href="#admin-main"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Suspense fallback={<ShellFallback />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  await assertStaffStillValid(session);
  const storage = storageStatus();
  // Not awaited: the sidebar renders immediately and the counts stream in.
  const badges = getNavBadges();

  return (
    <div className="flex">
      <AdminNav role={session.role} badges={badges} storeLabel={{ text: storage.label, ok: storage.persistent }} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/85 pl-14 pr-4 backdrop-blur-md backdrop-saturate-150 md:pr-8 lg:pl-8">
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <AdminIcon name="store" size={16} />
            View store
            <AdminIcon name="external" size={13} />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="hidden items-center gap-2 sm:flex">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                {initials(session.name)}
              </span>
              <span className="leading-tight">
                <span className="block font-bold text-ink">{session.name}</span>
                {session.name !== ROLE_LABEL[session.role] && <span className="block text-[11px] text-muted">{ROLE_LABEL[session.role]}</span>}
              </span>
            </span>
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-bold outline-none transition-colors hover:border-ink focus-visible:ring-2 focus-visible:ring-accent">
                <AdminIcon name="logout" size={15} />
                Sign out
              </button>
            </form>
          </div>
        </header>
        {!storage.persistent && (
          <div role="status" className="border-b border-[#f5c06b] bg-[#fff8eb] px-4 py-2.5 text-[13px] text-[#7a4b00] md:px-8">
            <b>Storage isn&apos;t permanent yet.</b> {storage.hint}
          </div>
        )}
        {usingDevPassword() && (
          <div className="border-b border-line bg-[#eef3ff] px-4 py-2 text-[13px] text-accent-deep md:px-8">
            Development mode: signed in with the default password. Set <code>ADMIN_PASSWORD</code> before going live.
          </div>
        )}
        <main id="admin-main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex" aria-busy="true" aria-label="Loading admin">
      <div className="hidden h-screen w-64 shrink-0 border-r border-line bg-white p-4 lg:block">
        <div className="mx-3 mt-2 h-6 w-28 animate-pulse rounded-md bg-stage" />
        <div className="mt-9 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-stage/70" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-14 border-b border-line bg-white" />
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-line" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
