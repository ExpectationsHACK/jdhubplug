# JDHub design language

JDHub's storefront follows the design grammar of samsung.com: a monochrome, product-first, tile-based retail
experience. It uses JDHub's own wordmark, colours, copy and open-source fonts. Samsung's trademarks, logo,
proprietary typefaces (SamsungOne / Samsung Sharp Sans) and imagery are **not** used.

## Principles

1. **Product is the hero.** Devices sit on light-grey "stages" (`#f4f4f4`) with generous whitespace.
2. **Monochrome first.** Black type and black pill CTAs on white. Colour appears only in product art, one accent
   blue for active and focus states, sale red for offers and warnings, green for success and WhatsApp.
3. **Tiles, not boxes.** Every surface is a 20px-radius tile. Cards, banners and explore modules share the shape.
4. **Short, confident copy.** Headline, one line of support, two buttons.
5. **Honest by design.** Ratings, badges, stock and seller details only show when real data backs them.

## Tokens (`app/globals.css`, exposed to Tailwind via `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#000000` | Headlines, body, primary buttons |
| `--ink-2` | `#313131` | Secondary copy |
| `--muted` | `#757575` | Meta text, inactive tabs |
| `--line` | `#dddddd` | Borders, dividers |
| `--stage` | `#f4f4f4` | Product backdrops, cards |
| `--canvas` | `#ffffff` | Page background |
| `--footer` | `#f7f7f7` | Footer |
| `--accent` | `#1a5cff` | Selected chips, verified badge, focus rings, eyebrows, logo hub dot |
| `--accent-deep` | `#0b2a8a` | Deep-blue hero gradients |
| `--sale` | `#e5004b` | "Hot deal" badges, errors, destructive actions |
| `--ok` | `#0a8a4a` | Success, in stock |
| `--wa` | `#25d366` | WhatsApp button only |

Use them as Tailwind classes (`text-ink`, `bg-stage`, `border-line`, `rounded-tile`). Radius: tiles `20px`,
chips and fields `12px`, buttons `9999px` (pill).

## Typography

- **Display: Montserrat 700/800** (`.display`): headlines, section titles, big prices. Leading 1.15, slight
  negative tracking.
- **Body: Inter**, 14–18px regular; 700 for labels, product names and buttons.
- Scale: hero 52/34px · section 40/28px · card title 16px · body 14–16px · meta 12–13px.
- **Wordmark:** "JDHUB" in Montserrat ExtraBold, uppercase, `0.14em` tracking (`components/Logo.tsx`).

## Logo

A **JD ligature on a rounded black tile** (`components/brand/JDMark.tsx`, `public/brand/`). The J and D share one
stroke, and a **blue hub dot** (`#1a5cff`) sits inside the D: where buyers, sellers and swappers meet.

- 64×64 grid, 7-unit stroke, legible from a 16px favicon up. Header lockup: 32px mark + 10px gap + wordmark.
- Variants: `dark` (default), `light` (for dark backgrounds), `bare` (glyph only, inherits colour).
- Clear space: at least the tile's corner radius. Don't recolour the dot, stretch the tile, or drop the stem.
- Files: `jd-mark.svg`, `jd-mark-light.svg`, `favicon.ico`, `apple-icon.png`, `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`.

## Iconography (`components/Icon.tsx`, admin: `components/admin/core/icons.tsx`)

Outline icons on a 24px grid, **1.5px stroke**, round caps and joins, no fills, `currentColor`. Large feature
icons use 1.25px. The only filled mark is the WhatsApp glyph.

## Components

- **Buttons** (`.btn`): `btn-primary` (black), `btn-outline`, `btn-white` / `btn-ghost-white` on dark. Pair
  *secondary outline left, primary filled right* ("Add to cart" · "Buy now").
- **Text link** (`.link-cta`): bold, underlined, trailing chevron.
- **Tabs** (`.tab`), **chips** (`.chip`, selected = 2px accent border), **fields** (`.field`).
- **Global nav:** wordmark · categories · divider · Sell / Swap / Trust · search, wishlist, cart, account. A
  dismissible black promo strip sits above (two lines at most on phones).
- **Product card:** grey tile with an honest badge, wishlist heart, photo (illustration while loading), grade pill,
  name, spec, real star rating only when reviews exist, location, price, "Add to cart" and a compare toggle.
- **Buy box:** brand, name, spec, rating link, save and compare, price and stock, grade explainer, seller tile,
  quantity, "Add to cart" · "Buy now", WhatsApp and swap actions, escrow note. Sold out shows "Notify me".
- **Compare tray** pinned to the bottom while products are selected; **compare table** highlights differences.
- **Cookie banner:** bottom sheet with Accept / Reject / Manage; reopened from "Cookie settings" in the footer.
- **Floating WhatsApp button** on browsing pages only; hidden where it would cover buy or checkout buttons.
- **Footer:** link columns on `#f7f7f7`, wordmark, legal links, fine print.

## Motion (`components/motion/`)

Reveal on scroll, product tilt, magnetic buttons, spotlight, product orbit, counters, marquee, page transitions,
fly-to-cart. Every animation respects `prefers-reduced-motion`. Motion supports the product; it never blocks
input or delays content.

## Admin

Calm, dense and functional: white cards on a light-grey canvas, a left sidebar grouped Overview / Catalog / Sales /
Admin with count badges, the same type and tokens as the store. Build pages from `components/admin/ui.tsx`
(AdminPage, PageHeader, StatCard, Badge, EmptyState, tables) and `components/admin/orders/Dialog.tsx` for confirms.
Destructive actions are red and ask for confirmation (typed for the most dangerous).

## Accessibility

- Visible focus rings (2px accent outline) on every interactive element.
- Tap targets at least 24px (most are 44px+); icon buttons have `aria-label`s; images have alt text.
- One `h1` per page; landmarks (banner, main, contentinfo, navigation); dialogs use the native `<dialog>`.
- No horizontal scroll at phone width; layouts are checked at 412px and 1366px.

## Voice

Samsung's register (short, declarative, benefit-first) applied to JDHub's promise of **trust**.

- Headlines in sentence case with a full stop, two beats: *"Sell in minutes. Get paid in 48 hours."*
  *"Trade up. Pay only the difference."* *"Four grades. Zero guesswork."*
- Product names title case and exact: *iPhone 15 Pro Max*, *Galaxy S24 Ultra*.
- CTAs are two or three words: *Buy now · Learn more · Get an instant offer · Start a swap*.
- Lead with what the buyer gets (escrow, grading, payout time), never with what JDHub is.
- Naira with the ₦ sign and no decimals: ₦1,185,000.
- Fine print 11–12px in muted grey, below CTAs.

Signature lines: *Trade with certainty.* · *Nobody has to go first.* · *Drive away with certainty.*
