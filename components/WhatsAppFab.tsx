"use client";

import { usePathname } from "next/navigation";
import { waLink } from "@/lib/settings";
import { WhatsAppGlyph } from "./Icon";

// Pages with their own WhatsApp actions and bottom bars, where a floating button would
// cover buttons (product buy box, checkout, order pages, compare tray).
const HIDDEN_ON = [/^\/product\//, /^\/checkout/, /^\/order\//, /^\/compare/, /^\/trade-in\//];

/** Floating WhatsApp button. The number comes from /admin/settings. */
export function WhatsAppFab({ whatsapp, storeName = "JDHub" }: { whatsapp: string; storeName?: string }) {
  const path = usePathname();
  if (!whatsapp.replace(/\D/g, "") || HIDDEN_ON.some((r) => r.test(path))) return null;
  return (
    <a
      href={waLink(whatsapp, `Hi ${storeName}, I need help with `)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${storeName} on WhatsApp`}
      className="wa-fab fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-wa text-white shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <WhatsAppGlyph />
    </a>
  );
}
