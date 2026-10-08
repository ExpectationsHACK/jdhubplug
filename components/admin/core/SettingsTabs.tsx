import Link from "next/link";
import { AdminIcon, type AdminIconName } from "./icons";

const TABS: { id: "general" | "data"; href: string; label: string; icon: AdminIconName; ownerOnly?: boolean }[] = [
  { id: "general", href: "/admin/settings", label: "Store settings", icon: "settings" },
  { id: "data", href: "/admin/settings/data", label: "Data & backups", icon: "database", ownerOnly: true },
];

/** Section links at the top of the settings area. */
export function SettingsTabs({ active, isOwner }: { active: "general" | "data"; isOwner: boolean }) {
  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Settings sections" className="no-scrollbar -mx-4 mb-8 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`relative inline-flex items-center gap-2 whitespace-nowrap rounded-t-md pb-3 pt-1 text-[14px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  on ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ink" : "text-muted hover:text-ink"
                }`}
              >
                <AdminIcon name={t.icon} size={16} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NoAccess({ title = "You don't have access to this page", body }: { title?: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stage">
        <AdminIcon name="lock" size={22} />
      </span>
      <p className="mt-4 text-[16px] font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">{body}</p>
      <Link href="/admin" className="btn btn-outline mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}
