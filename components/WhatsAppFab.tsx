import { waLink } from "@/lib/settings";
import { WhatsAppGlyph } from "./Icon";

/** Floating WhatsApp button. The number comes from /admin/settings. */
export function WhatsAppFab({ whatsapp, storeName = "JDHub" }: { whatsapp: string; storeName?: string }) {
  if (!whatsapp.replace(/\D/g, "")) return null;
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
