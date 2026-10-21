import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Markdown-lite for legal text, including clauses typed by admins. Never injects
// HTML: everything becomes React text nodes, so tags render as literal text.
//
//   blank line     new paragraph
//   "## Heading"   sub-heading
//   "- item"       bullet list
//   **bold**       bold
//   [label](url)   link; only /paths, #anchors, https://, mailto: and tel: are allowed

const SAFE_HREF = /^(\/(?!\/)|#|https:\/\/|mailto:|tel:)/i;

/** Inline formatting: **bold** and [label](href). */
export function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key} className="font-bold text-ink">{m[1]}</strong>);
    } else {
      const [label, href] = [m[2], m[3]];
      if (!SAFE_HREF.test(href)) out.push(label);
      else if (href.startsWith("/") || href.startsWith("#")) {
        out.push(
          <Link key={key} href={href} className="font-bold text-accent underline underline-offset-2">
            {label}
          </Link>,
        );
      } else {
        const external = href.startsWith("https://");
        out.push(
          <a key={key} href={href} className="font-bold text-accent underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {label}
          </a>,
        );
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed text-ink-2 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim());
        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return (
            <h3 key={bi} className="pt-2 text-[17px] font-bold text-ink">
              {inline(lines[0].slice(3), `h${bi}`)}
            </h3>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={bi} className="list-disc space-y-2 pl-5 marker:text-muted">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `p${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
