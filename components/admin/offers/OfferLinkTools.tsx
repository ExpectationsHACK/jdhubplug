"use client";

import { useRef, useState } from "react";
import { Icon, WhatsAppGlyph } from "@/components/Icon";

/** Copy text to the clipboard with a short "Copied" confirmation. */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard API blocked (http, iframe): fall back to a hidden textarea.
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {copied ? <Icon name="check" size={15} strokeWidth={2.25} className="text-ok" /> : <CopyGlyph />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

function CopyGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </svg>
  );
}

function QrGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </svg>
  );
}

/**
 * Special-link toolbox for one offer: the link with copy, a WhatsApp share and a QR
 * code (rendered server-side) that downloads as SVG or PNG.
 */
export function OfferLinkTools({
  url,
  code,
  shareText,
  qrSvg,
}: {
  url: string;
  code: string;
  shareText: string;
  qrSvg: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const svgHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;

  const downloadPng = () => {
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jdhub-offer-${code}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    };
    img.src = svgHref;
  };

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-[#fafbfc] py-1.5 pl-3 pr-1.5">
        <Icon name="globe" size={15} className="shrink-0 text-muted" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink-2 hover:text-ink hover:underline" title={url}>
          {url.replace(/^https?:\/\//, "")}
        </a>
        <CopyButton text={url} label="Copy" className="shrink-0" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-wa px-3 py-1.5 text-[13px] font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <WhatsAppGlyph size={15} /> Share
        </a>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <QrGlyph /> QR code
        </button>
      </div>

      <dialog
        ref={dialog}
        aria-label={`QR code for ${code}`}
        className="m-auto w-[min(92vw,380px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold">Scan to open the offer</p>
              <p className="mt-0.5 break-all font-mono text-[12px] text-muted">{url.replace(/^https?:\/\//, "")}</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full p-1.5 hover:bg-stage" aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
          {/* SVG generated server-side by the qrcode package from our own URL. */}
          <div className="mx-auto mt-4 w-full max-w-[280px] rounded-xl border border-line p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-3 text-center text-[12px] text-muted">Print it on flyers, receipts and shop displays. Every scan counts as a view.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={svgHref} download={`jdhub-offer-${code}.svg`} className="btn btn-outline">
              SVG
            </a>
            <button type="button" onClick={downloadPng} className="btn btn-primary">
              PNG
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
