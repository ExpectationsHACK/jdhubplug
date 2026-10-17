import { ViewTransition } from "react";

/**
 * Subtle route transition: the old page fades out and the new one rises in. Put it
 * in each page, not a layout (layouts persist across navigations, so they never
 * enter or exit). Shared product images morph separately (ProductCard ↔ product page).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}

/** Thin accent bar across the top that fills as the page scrolls (CSS scroll timeline). */
export function ScrollProgress() {
  return <div aria-hidden className="scroll-progress" />;
}
