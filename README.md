# JDHub

Nigeria's graded trade platform: buy, sell and swap phones, accessories, gadgets and cars, with escrow-protected
payment. The storefront follows a samsung.com-style design language; see [BRAND.md](./BRAND.md).

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Structure

- `app/`: routes. `/` home, `/shop`, `/shop/[category]`, `/product/[id]`, `/sell` (instant offer), `/swap`
  (trade-up planner), `/trust` (escrow, grading, IMEI/VIN and scam lookup, hubs), `/vendors`, `/account`
- `components/`: header with mega menu, footer, hero carousel, product card, filters, buy box, estimators, icon set
- `lib/catalog.ts`: categories, grades, listings (shared fields plus a per-category `attrs` object), trade-in pricing

Catalog data, trade-in prices, hub addresses, phone number and email are placeholders. The IMEI/VIN and scam lookups
run client-side demo logic until a verification provider API is connected. Checkout currently hands off to WhatsApp
until escrow payments are integrated.
