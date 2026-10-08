# JDHub Design Language

JDHub's storefront follows the same design grammar as samsung.com: a monochrome, product-first, tile-based retail
experience. It uses JDHub's own wordmark, colours, copy and open-source fonts. Samsung's trademarks, logo,
proprietary typefaces (SamsungOne / Samsung Sharp Sans) and imagery are **not** used.

## Principles

1. **Product is the hero.** Devices sit on light-grey "stages" (`#f4f4f4`) with generous whitespace. No clutter, no
   competing colour.
2. **Monochrome first.** Black type and black pill CTAs on white. Colour appears only in product art, one accent blue
   for active and focus states, and sale red for offers.
3. **Tiles, not boxes.** Every surface is a 20px-radius tile. Cards, banners and explore modules all share the shape.
4. **Short, confident copy.** Headline, one line of support, two buttons.

## Tokens (`app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#000000` | Headlines, body, primary buttons |
| `--ink-2` | `#313131` | Secondary copy |
| `--muted` | `#757575` | Meta text, inactive tabs |
| `--line` | `#dddddd` | Borders, dividers |
| `--stage` | `#f4f4f4` | Product backdrops, cards |
| `--footer` | `#f7f7f7` | Footer |
| `--accent` | `#1a5cff` | Selected chips, verified badge, focus rings, eyebrows |
| `--accent-deep` | `#0b2a8a` | Deep-blue hero gradients |
| `--sale` | `#e5004b` | "Hot deal" badges, warnings |
| `--wa` | `#25d366` | WhatsApp button only |

Radius: tiles `20px`, chips/fields `12px`, buttons `9999px` (pill).

## Typography

- **Display: Montserrat 700/800.** A wide geometric sans that stands in for Samsung Sharp Sans. Used for headlines,
  section titles and big prices (`.display`). Tight leading (1.15), slight negative tracking.
- **Body: Inter.** A neutral, highly legible sans that stands in for SamsungOne. 14–18px, regular weight. Bold (700)
  for labels, product names and buttons.
- Scale: hero 52/34px · section 40/28px · card title 16px · body 14–16px · meta 12–13px.
- **Wordmark:** "JDHUB" in Montserrat ExtraBold, uppercase, `0.14em` tracking (`components/Logo.tsx`).

## Iconography (`components/Icon.tsx`)

Thin outline icons on a 24px grid with a **1.5px stroke** and round caps and joins. They have no fills and are
monochrome (`currentColor`). Large feature icons drop to a 1.25px stroke. The only filled mark is the WhatsApp glyph.
Quick-link icons sit in 64px grey circles that invert to black on hover.

## Components

- **Buttons** (`.btn`): `btn-primary` (black), `btn-outline` (black border), `btn-white` / `btn-ghost-white` for dark
  backgrounds. Pair them as *secondary outline on the left, primary filled on the right* ("Learn more" · "Buy now").
- **Text link** (`.link-cta`): bold, underlined, with a trailing chevron ("Shop all phones ›").
- **Tabs** (`.tab`): bold text tabs with a 2px black underline on the active one.
- **Chips** (`.chip`): option selectors (storage, colour, grade). The selected chip gets a 2px accent border.
- **Hero carousel:** full-bleed slides with an eyebrow, a two-line headline, a support line and two pill buttons,
  plus dot indicators, a pause control and auto-advance.
- **Global nav:** wordmark · categories · divider · Sell / Swap / Trust · utility icons. Hovering a category opens a
  mega menu (brands on the left, featured products on the right). Above the nav sits a dismissible black promo strip.
- **Product card:** grey tile with a badge, a save heart, product art, grade pill, verified mark, name, spec, rating,
  location and price, ending in a full-width "Buy now".
- **Footer:** five dense link columns on `#f7f7f7`, then the wordmark, region, legal links and fine print.

## Page flow

Home: hero carousel → quick links → **Shop** (category tabs) → **Explore** (editorial tiles) → brand promises →
grading strip → category row → Trade-Up banner → footer.

Category and shop pages: breadcrumbs → centred title → filters sidebar (bottom sheet on mobile) with results count,
sort and grid. Product page: sticky gallery on the left; on the right, buy box with grade, options, care plan, seller,
total and CTAs; then specs, trust tiles and "You may also like". On mobile, a sticky total bar sits at the bottom.

## Voice

Samsung's register (short, declarative, benefit-first) applied to JDHub's promise of **trust**.

- Headlines are sentence case with a full stop and two beats: *"Sell in minutes. Get paid in 48 hours."*
  *"Trade up. Pay only the difference."* *"Four grades. Zero guesswork."*
- Product names are title case and exact: *iPhone 15 Pro Max*, *Galaxy S24 Ultra*.
- CTAs are two or three words: *Buy now · Learn more · Get an instant offer · Start a swap · Shop all*.
- Lead with what the buyer gets (escrow, grading, a payout time), never with what JDHub is.
- Use naira with the ₦ sign and no decimals: ₦1,185,000.
- Fine print sits below CTAs at 11–12px in muted grey.

Signature lines: *Trade with certainty.* · *Nobody has to go first.* · *Drive away with certainty.*
