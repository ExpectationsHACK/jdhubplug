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
- `lib/models.ts`: the 106 models JDHub stocks, with October 2026 Nigerian market prices and a Wikimedia Commons photo each
- `lib/catalog.ts`: categories, grades, trade-in pricing, and the generator that expands models into 212 graded listings

Product photos are hotlinked from Wikimedia Commons (credited on each product page and at `/credits`); if one fails to
load, the card falls back to a vector illustration. Prices are a starting point and move with the exchange rate.
Sellers, ratings, hub addresses, phone number and email are placeholders. The IMEI/VIN and scam lookups
run client-side demo logic until a verification provider API is connected. Checkout currently hands off to WhatsApp
until escrow payments are integrated.
