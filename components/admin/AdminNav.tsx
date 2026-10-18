"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/types";
import { AdminIcon, type AdminIconName } from "./core/icons";

// Admin sidebar. Items hidden by role are also enforced server-side on each page.
// On large screens it is a sticky sidebar; below `lg` it is a slide-in drawer opened
// from a fixed menu button that sits in the top-left corner of the admin header.

export type NavGroup = "Overview" | "Catalog" | "Sales" | "Admin";

export const ADMIN_NAV: { href: string; label: string; icon: AdminIconName; group: NavGroup; roles?: Role[] }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", group: "Overview" },
  { href: "/admin/products", label: "Products", icon: "box", group: "Catalog" },
  { href: "/admin/inventory", label: "Inventory", icon: "layers", group: "Catalog" },
  { href: "/admin/offers", label: "Offers & links", icon: "link", group: "Catalog" },
  { href: "/admin/alerts", label: "Stock alerts", icon: "bell", group: "Catalog" },
  { href: "/admin/orders", label: "Orders", icon: "receipt", group: "Sales" },
  { href: "/admin/customers", label: "Customers", icon: "users", group: "Sales" },
  { href: "/admin/requests", label: "Requests", icon: "inbox", group: "Sales" },
  { href: "/admin/reviews", label: "Reviews", icon: "star", group: "Sales" },
  // Support staff see settings read-only (delivery fees, hubs and bank details help them answer buyers).
  { href: "/admin/settings", label: "Settings", icon: "settings", group: "Admin" },
  { href: "/admin/notifications", label: "Notifications", icon: "megaphone", group: "Admin" },
  { href: "/admin/staff", label: "Staff", icon: "shieldUser", group: "Admin", roles: ["owner"] },
  { href: "/admin/activity", label: "Activity log", icon: "activity", group: "Admin", roles: ["owner", "manager"] },
];

const GROUPS: NavGroup[] = ["Overview", "Catalog", "Sales", "Admin"];

/** What each badge counts, for screen readers. */
const BADGE_HINT: Record<string, string> = {
  "/admin/orders": "need attention",
  "/admin/requests": "new",
  "/admin/inventory": "low on stock",
  "/admin/reviews": "awaiting approval",
};

type Badges = Record<string, number>;

export function AdminNav({
  role,
  badges = {},
  storeLabel,
}: {
  role: Role;
  /** Counts shown next to items, keyed by href. A promise streams in without blocking the shell. */
  badges?: Badges | Promise<Badges>;
  /** Short storage/status line shown at the foot of the sidebar. */
  storeLabel?: { text: string; ok: boolean };
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const items = ADMIN_NAV.filter((i) => !i.roles || i.roles.includes(role));
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

  // Drawer: Escape closes, Tab stays inside, focus moves in and back out, and the page
  // behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtn.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !drawer.current) return;
      const focusable = [...drawer.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    menuBtn.current?.focus();
  };

  const list = (onNavigate?: () => void) => (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {GROUPS.map((g) => {
        const groupItems = items.filter((i) => i.group === g);
        if (!groupItems.length) return null;
        return (
          <div key={g}>
            {g !== "Overview" && <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{g}</p>}
            <ul className="flex flex-col gap-0.5">
              {groupItems.map((i) => {
                const on = active(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={on ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold outline-none transition-[background-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-accent ${
                        on ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]" : "text-ink-2 hover:bg-stage hover:text-ink"
                      }`}
                    >
                      <AdminIcon
                        name={i.icon}
                        size={19}
                        className={`shrink-0 transition-transform duration-200 motion-safe:group-hover:scale-110 ${on ? "" : "text-muted group-hover:text-ink"}`}
                      />
                      <span className="flex-1 truncate">{i.label}</span>
                      <Suspense fallback={null}>
                        <NavBadge badges={badges} href={i.href} on={on} />
                      </Suspense>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/admin" className="flex items-baseline gap-2 rounded-lg px-3 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <span className="display text-[20px] font-extrabold uppercase tracking-[0.14em]">JDHub</span>
      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">Admin</span>
    </Link>
  );

  const foot = storeLabel && (
    <p className="mt-6 flex items-center gap-2 rounded-xl bg-stage px-3 py-2.5 text-[12px] text-ink-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${storeLabel.ok ? "bg-ok" : "bg-[#f59e0b]"}`} aria-hidden />
      <span className="truncate">{storeLabel.text}</span>
    </p>
  );

  return (
    <>
      <button
        ref={menuBtn}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-2 top-2 z-40 grid h-10 w-10 place-items-center rounded-full outline-none transition-colors hover:bg-stage focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        aria-label="Open admin menu"
        aria-expanded={open}
        aria-controls="admin-drawer"
      >
        <AdminIcon name="menu" size={22} />
      </button>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-3 pb-4 pt-4 lg:flex">
        <div className="mb-7">{brand}</div>
        <div className="flex-1">{list()}</div>
        {foot}
      </aside>

      {/* Mobile drawer stays mounted so it can slide; `inert` keeps it out of the tab order when closed. */}
      <div className="lg:hidden" inert={!open}>
        <div
          aria-hidden
          onClick={close}
          className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          ref={drawer}
          id="admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col overflow-y-auto bg-white px-3 pb-4 pt-4 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-7 flex items-center justify-between">
            {brand}
            <button
              ref={closeBtn}
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="grid h-10 w-10 place-items-center rounded-full outline-none hover:bg-stage focus-visible:ring-2 focus-visible:ring-accent"
            >
              <AdminIcon name="close" />
            </button>
          </div>
          <div className="flex-1">{list(() => setOpen(false))}</div>
          {foot}
        </aside>
      </div>
    </>
  );
}

function NavBadge({ badges, href, on }: { badges: Badges | Promise<Badges>; href: string; on: boolean }) {
  // Promises from the server arrive as thenables, so check the shape rather than `instanceof`.
  const resolved = typeof (badges as Promise<Badges>).then === "function" ? use(badges as Promise<Badges>) : (badges as Badges);
  const n = resolved[href] ?? 0;
  if (!n) return null;
  return (
    <span
      className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums motion-safe:animate-[fade-in_.3s_ease_both] ${
        on ? "bg-white/20 text-white" : "bg-accent text-white"
      }`}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {BADGE_HINT[href] ?? ""}</span>
    </span>
  );
}
