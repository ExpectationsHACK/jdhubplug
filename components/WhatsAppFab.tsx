import { whatsappLink } from "@/lib/catalog";
import { WhatsAppGlyph } from "./Icon";

export function WhatsAppFab() {
  return (
    <a
      href={whatsappLink("Hi JDHub, I need help with ")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with JDHub on WhatsApp"
      className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-wa text-white shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-transform hover:scale-105"
    >
      <WhatsAppGlyph />
    </a>
  );
}
