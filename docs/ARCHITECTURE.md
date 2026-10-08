# JDHub architecture

Next.js 16 (App Router, `cacheComponents` + Partial Prefetching), React 19.3, Tailwind 4.
Read the bundled docs in `node_modules/next/dist/docs/` before using an API you haven't
used in this version.

## Layout

```
app/
  layout.tsx                 html/body/fonts only
  (store)/                   storefront: header, footer, cart (layout.tsx)
  admin/login/               sign-in (public)
  admin/(panel)/             signed-in admin; layout checks the session
  api/                       route handlers (webhooks, cron, exports, uploads)
  o/[code]/route.ts          offer special links
components/                  storefront UI; components/admin/* admin UI; components/cart/* cart
lib/
  types.ts                   domain types (Product, Order, Offer, Lead, Settings, ...)
  store/                     persistence (Redis or memory) — SERVER ONLY
  orders.ts                  order lifecycle + all order stock movement — SERVER ONLY
  pricing.ts                 offer + cart pricing (isomorphic)
  data.ts                    cached storefront reads (tagged) — SERVER ONLY
  revalidate.ts              refreshFromAction / refreshFromRoute
  auth.ts / session.ts       admin auth, roles, permissions
  catalog.ts / models.ts     reference data + seed catalog generator
  photos.ts                  image URL helpers
  settings.ts                default settings + waLink()
proxy.ts                     redirects signed-out visitors away from /admin
```

## Data rules

- **Storage.** `lib/store` talks to Upstash Redis when `KV_REST_API_URL`/`KV_REST_API_TOKEN`
  are set, otherwise to memory (snapshotted to `.data/` in development). The first read
  seeds the catalog from `lib/models.ts`.
- **Storefront reads** go through `lib/data.ts` (`getCatalog`, `getCatalogProduct`,
  `getStoreSettings`, `getPublicOffer`). They are `'use cache'` functions tagged
  `catalog` / `settings` / `offers`. Never import `lib/store` from a client component;
  pass data down as props.
- **After a mutation**, refresh the storefront: `refreshFromAction(TAGS.catalog, ...)`
  inside Server Actions, `refreshFromRoute(...)` inside Route Handlers.
- **Stock.** Product stock is an atomic counter. Orders move stock only through
  `lib/orders.ts`: `placeOrder` reserves all lines atomically (two buyers can never get the
  last unit), `transitionOrder` restores stock exactly once on cancel/refund, and
  `sweepExpiredOrders` cancels unpaid orders after `settings.reservationMinutes`. Admin
  edits use `setStock` / `adjustStock`, or `saveProducts` (writes absolute stock unless
  `{ keepStock: true }`). Use `keepStock: true` when an edit doesn't touch stock, so it
  can't overwrite a purchase that happened meanwhile.
- **Prices are never trusted from the client.** Checkout re-prices with `priceCart`
  against live store data.

## Next.js 16 rules that bite

- With `cacheComponents`, anything request-specific (cookies, headers, searchParams,
  uncached store reads, `Date.now()`/`new Date()` during render) must sit inside a
  `<Suspense>` boundary or a `'use cache'` scope. Use `await connection()` (from
  `next/server`) before reading the clock in a server component.
- `params`/`searchParams` are Promises.
- `updateTag` only works in Server Actions; use `refreshFromRoute` in Route Handlers.
- `middleware.ts` is now `proxy.ts`.

## Admin

- Every admin page and Server Action starts with `const s = await requireAdmin(perm?)`.
  Permissions: `products:write`, `inventory:write`, `orders:write`, `offers:write`,
  `leads:write`, `settings:write`, `staff:manage`, `danger`. Roles: owner > manager > support.
- Log changes with `audit(s, "product.update", id, "price 450000 → 430000")`.
- Use the primitives in `components/admin/ui.tsx` (AdminPage, PageHeader, Card, StatCard,
  Badge, Table, Field, EmptyState, inputCls…).
- The owner signs in with `ADMIN_PASSWORD`; staff accounts are created in /admin/staff.
  In development without `ADMIN_PASSWORD` the password is `jdhub-admin`.

## Cart and checkout

- `components/cart/CartProvider.tsx` keeps the cart in localStorage. `useCart()` gives
  `items, count, add(product, qty, fromEl), setQty, remove, clear, open, close,
  offerCode, setOfferCode`.
- `<AddToCartButton product={p} />` handles sold-out/maxed states and launches the
  fly-to-cart animation from the nearest `[data-product-card]` image.
- `<CartButton />` in the header is the fly-to-cart target (`data-cart-target`).

## Offers

An offer has a code; its special link is `/o/{code}`. The link records a view, stores the
code for checkout and lands on `/offer/{code}`. `lib/pricing.ts` decides whether an offer
is live (`offerState`) and which products it covers (`offerAppliesTo`).

## Verifying changes

```
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
npm run build
npm run test:orders # stock/offer/order lifecycle tests
```
