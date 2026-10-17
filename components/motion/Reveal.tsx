import { Fragment, type CSSProperties, type ElementType, type ReactNode } from "react";

// Scroll reveals driven entirely by CSS scroll timelines (see `.reveal` and
// `.reveal-words` in globals.css). No JavaScript, nothing stays hidden when the
// browser lacks scroll-driven animations, and nothing moves under reduced motion.

/** Fades and lifts its content in as it scrolls into view. `index` staggers siblings. */
export function Reveal({
  as: Tag = "div",
  index = 0,
  className = "",
  style,
  children,
  id,
}: {
  as?: ElementType;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag id={id} className={`reveal ${className}`} style={{ ...style, "--i": index } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Heading whose words rise in one after another as it enters the viewport. */
export function RevealText({
  as: Tag = "h2",
  text,
  className = "",
  id,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  id?: string;
}) {
  const words = text.split(" ");
  return (
    <Tag className={`reveal-words ${className}`} id={id}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="reveal-word" style={{ "--i": i } as CSSProperties}>
            <span>{w}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
