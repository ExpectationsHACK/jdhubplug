"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/types";
import { Icon, type IconName } from "../Icon";

// Admin sidebar. Items hidden by role are also enforced server-side on each page.

export const ADMIN_NAV: { href: string; label: string; icon: IconName; roles?: Role[] }[] = [
  { href: "/admin", label: "Dashboard", icon: "globe" },
  { href: "/admin/products", label: "Products", icon: "tag" },
  { href: "/admin/inventory", label: "Inventory", icon: "store" },
  { href: "/admin/orders", label: "Orders", icon: "cart" },
  { href: "/admin/offers", label: "Offers & links", icon: "gift" },
  { href: "/admin/customers", label: "Customers", icon: "user" },
  { href: "/admin/requests", label: "Requests", icon: "chat" },
  { href: "/admin/settings", label: "Settings", icon: "info", roles: ["owner", "manager"] },
  { href: "/admin/staff", label: "Staff", icon: "verified", roles: ["owner"] },
  { href: "/admin/activity", label: "Activity log", icon: "scan", roles: ["owner", "manager"] },
];

export function AdminNav({ role, badges = {} }: { role: Role; badges?: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = ADMIN_NAV.filter((i) => !i.roles || i.roles.includes(role));
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const list = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold transition-colors ${
            active(i.href) ? "bg-ink text-white" : "text-ink-2 hover:bg-stage hover:text-ink"
          }`}
        >
          <Icon name={i.icon} size={18} />
          <span className="flex-1">{i.label}</span>
          {!!badges[i.href] && (
            <span className={`rounded-full px-2 text-[11px] ${active(i.href) ? "bg-white/20" : "bg-accent text-white"}`}>{badges[i.href]}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-stage lg:hidden" aria-label="Open admin menu">
        <Icon name="menu" />
      </button>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-line bg-white p-4 lg:block">
        <Link href="/admin" className="display mb-6 block px-3 pt-2 text-[20px] font-extrabold uppercase tracking-[0.14em]">
          JDHub <span className="text-[11px] tracking-normal text-accent">Admin</span>
        </Link>
        {list}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between px-3 pt-2">
              <span className="display text-[20px] font-extrabold uppercase tracking-[0.14em]">JDHub</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <Icon name="close" />
              </button>
            </div>
            {list}
          </aside>
        </div>
      )}
    </>
  );
}
