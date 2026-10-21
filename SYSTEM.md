# JDHub system

How the app is built and runs. For the product see [PROJECT.md](./PROJECT.md); for the look and feel see
[DESIGN.md](./DESIGN.md).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.4 App Router with `cacheComponents` and Partial Prerendering, React 19.3, TypeScript |
| Styling | Tailwind CSS 4, tokens in `app/globals.css` |
| Hosting | Vercel (production deploys from `main`; daily cron in `vercel.json`) |
| Database | Supabase Postgres via `jd_*` SQL functions; Upstash Redis or in-memory as fallbacks |
| Payments | Paystack (card, bank, USSD), plus bank transfer and WhatsApp |
| Email / SMS | Resend / Termii (`lib/messaging.ts`) |
| Files | Vercel Blob (admin photo uploads) |
| Monitoring | Sentry (errors), PostHog (analytics, consent-gated) |
| Tests | tsx unit suites on the memory store; Playwright browser tests; GitHub Actions CI |

## Layout

```
app/
  layout.tsx                 html, fonts, metadata
  (store)/                   storefront: header, footer, cart, consent banner, compare tray
  admin/login/               admin sign-in (public)
  admin/(panel)/             admin; layout checks the session
  api/                       paystack callback/webhook, cron sweep, admin exports/import/upload/backup
  o/[code]/route.ts          offer special links
components/                  storefront UI; admin/*, cart/*, checkout/*, reviews/*, wishlist/*, compare/*,
                             stock-alerts/*, tradein/*, legal/*, consent/*, motion/*
lib/
  types.ts                   domain types
  store/                     persistence (driver.ts + repository index.ts)    SERVER ONLY
  orders.ts, order-status.ts order lifecycle and stock movement               SERVER ONLY / isomorphic
  pricing.ts                 cart and offer pricing                          isomorphic
  data.ts, revalidate.ts     cached storefront reads and cache refresh       SERVER ONLY
  auth.ts, session.ts        admin auth, roles, signed cookies               SERVER ONLY
  customer-auth.ts, otp.ts   shopper accounts, one-time codes                SERVER ONLY
  messaging.ts, notify/      email/SMS delivery, order messages              SERVER ONLY
  reviews*.ts, wishlist.ts, stock-alerts.ts, tradein*.ts, legal*.ts, consent.ts, paystack.ts
  catalog.ts, models.ts, reference.ts, photos.ts   seed catalog and reference data
proxy.ts                     sends signed-out visitors away from /admin
supabase/migrations/         Postgres schema and functions
e2e/, scripts/test-*.mts     browser and unit tests
```

## Data

### Storage drivers (`lib/store/driver.ts`)

A small key-value interface (get/set/setNx/del/incr, hashes, lists, plus atomic `reserve`/`release` for stock).
`getDriver()` picks, in order:

1. **Supabase** when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set. Calls `jd_*` functions over REST with the
   service-role key. Tables `jd_kv`, `jd_hash`, `jd_list` have row-level security on, and the functions are
   executable by `service_role` only. Stock reservation is one transaction with row locks.
2. **Upstash Redis** when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set (Lua for reserve/release).
3. **Memory**: snapshotted to `.data/` in local development, in memory only on Vercel, and in memory only when
   `JDHUB_MEMORY_ONLY=1` (tests). Data is lost on restart.

The first read seeds the catalog from `lib/models.ts`.

### Keys

| Key | Holds |
| --- | --- |
| `jd:products`, `jd:stock`, `jd:sold` | Products (hash), atomic stock and sold counters |
| `jd:orders`, `jd:seq:order` | Orders, order number sequence |
| `jd:offers`, `jd:offerstats` | Offers; `{code}:views/orders/paid/revenue` counters |
| `jd:customers`, `jd:customer:by` | Shopper accounts; phone/email → id index |
| `jd:otp:*`, `jd:rl:*` | Hashed sign-in codes; rate-limit windows (expire) |
| `jd:leads`, `jd:tradein:acct` | Requests and trade-ins; full payout account numbers (admin only) |
| `jd:staff`, `jd:settings`, `jd:audit`, `jd:session-epoch` | Staff, settings, activity log (capped), session revocation |
| `jd:notify:*` | Message settings and logs (global and per order) |
| `jd:reviews:*` | Reviews, one-per-order-line index, per-model aggregates, settings |
| `jd:wishlist:*`, `jd:stockalert:*` | Saved items per customer; back-in-stock alerts |
| `jd:legal`, `jd:dsr*` | Legal details; data subject requests |
| `jd:lock:*` | Short-lived locks (`withLock`) |

### Integrity rules

- **Stock** is an atomic counter and moves only through `lib/orders.ts`:
  - `placeOrder` reserves every line atomically, so two buyers can never both get the last unit.
  - `transitionOrder` restores stock exactly once on cancel or refund.
  - `sweepExpiredOrders` cancels unpaid orders after `settings.reservationMinutes`.
  - Admin edits use `setStock`/`adjustStock`, or `saveProducts({ keepStock: true })` when stock isn't being changed.
- **Offers**: `claimOfferUse` increments atomically before stock is reserved and gives the use back if over the
  limit. Unpaid orders hold a use until they expire or are cancelled. `paid` counts separately.
- **Prices** are always recomputed on the server (`priceCart`) from live data.
- **Records** that are read, changed and written back use `withLock` (orders, customers, leads, alerts).
- **Rate limits** are one atomic counter per window:

  | Action | Limit |
  | --- | --- |
  | Admin login | 10 per IP and 30 per account per 15 min |
  | Requesting codes | 20 per IP per hour, 5 per identifier per 15 min |
  | Checking codes | 5 attempts per code, serialised per identifier |
  | Checkout | 10 per IP and 6 per phone per hour |
  | Order tracking | 20 per IP and 10 per phone per 15 min |

### Caching

Storefront reads (`lib/data.ts`, `lib/legal-store.ts`) are `'use cache'` functions tagged `catalog`, `settings`,
`offers`, `reviews` and `legal`. After a change, refresh them with `refreshFromAction(TAGS.x)` in Server Actions or
`refreshFromRoute(...)` in route handlers. Per-user data is never cached.

## Order lifecycle (`lib/order-status.ts`)

```
pending (awaiting payment) → paid (in escrow) → processing → shipped / ready at hub → delivered → completed
pending → cancelled (manual, or expired: stock released)
paid / processing / shipped / delivered / completed → refunded (stock restored)
```

Each real transition sends the matching customer message once (`lib/notify/orders.ts`, via `after()`). Paystack
payments are confirmed by the signed webhook (`/api/paystack/webhook`, HMAC-SHA512, amount and currency
checked, idempotent) and by the return callback. The callback only links to the order when the caller already
holds its token.

## Authentication

Two independent systems with separate cookies and signing keys:

- **Admin** (`lib/auth.ts`, cookie `jd_admin`, 12 h):
  - The owner signs in with `ADMIN_PASSWORD`; staff (manager, support) have PBKDF2-hashed passwords.
  - Every page, Server Action and admin route re-checks with `requireAdmin(perm)` / `sessionWith(perm)`.
  - Permissions: `products:write`, `inventory:write`, `orders:write`, `offers:write`, `leads:write`,
    `settings:write`, `staff:manage`, `danger`. Managers have all but the last two; support has `orders:write`
    and `leads:write`.
  - Sessions end when the password or role changes (credential fingerprint) or after "Sign out everyone"
    (session epoch).
- **Shoppers** (`lib/customer-auth.ts`, cookie `jd_customer`, 30 days):
  - Passwordless: a 6-digit code by email or SMS, stored hashed, expiring in 10 minutes.
  - An account's phone or email comes only from a verified code. Details typed at checkout are kept as
    unverified contacts for prefill.
  - Blocked shoppers are treated as signed out.
  - Codes are shown on screen only in development, or with `OTP_DEV_CODES=1` off Vercel (tests).
- **Tokens:** order pages (`/order/{id}?t=`) and trade-in pages (`/trade-in/{id}?t=`) need a random secret token.
  Redirect targets go through `lib/safe-path.ts`.

## Messages (`lib/messaging.ts`, `lib/notify/`)

- Resend for email (`RESEND_API_KEY`, `EMAIL_FROM`), Termii for SMS (`TERMII_API_KEY`, `TERMII_SENDER_ID`).
- Without a provider, sends are logged as "skipped", never as sent.
- **Senders:** sign-in codes, order messages, the new-order alert to the store, back-in-stock alerts and trade-in
  updates.
- **Controls:** toggles per event and channel in `/admin/notifications`.
- **Logs:** a capped global log, plus a per-order history.

## Privacy and consent

- **Analytics:** PostHog isn't even downloaded until a visitor accepts analytics (`lib/consent.ts`,
  `lib/posthog-client.ts`). It is proxied through `/ingest` and admin pages are never tracked. Server events
  (`order_placed`, `order_paid`, …) are sent only for orders from consenting visitors.
- **Errors:** Sentry reports from browser, server and edge through the `/monitoring` tunnel. Phones, emails,
  cookies, bodies and order tokens are scrubbed (`lib/sentry-scrub.ts`).
- **Shopper data:** shoppers can download their data (`/account/data`) or ask for deletion. Admins anonymise
  accounts from `/admin/privacy`.

## Environment variables

| Variable | Needed for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only) | Permanent storage |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis storage (alternative) |
| `ADMIN_PASSWORD`, `ADMIN_EMAIL` (optional), `AUTH_SECRET` | Admin sign-in, session signing |
| `CRON_SECRET` | Protects `/api/cron/sweep` (required in production) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, email links, Paystack callbacks (falls back to the Vercel domain) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL` | SMS |
| `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Card payments |
| `BLOB_READ_WRITE_TOKEN` | Photo uploads in the admin |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Error tracking, source maps |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics |
| `OTP_DEV_CODES`, `JDHUB_MEMORY_ONLY` | **Tests only.** Never set on Vercel |

See `.env.example`. The admin dashboard's **System health** card shows which are missing, without revealing values.

## Scheduled work

`vercel.json` runs `/api/cron/sweep` daily at 03:00 UTC. It releases expired unpaid orders and sends pending
back-in-stock alerts. Expired orders are also swept whenever someone checks out.

## Testing and CI

| Command | Covers |
| --- | --- |
| `npm run test:orders` | Stock reservation, restock once, expiry, atomic offer limits |
| `npm run test:notify` | Templates, escaping, one message per transition |
| `npm run test:reviews` | Eligibility, duplicates, aggregates |
| `npm run test:extras` | Wishlist merge, alert dedupe and single send |
| `npm run test:tradein` | Stage transitions, tokens, single-use swap credit |
| `npm run build && npm run test:e2e` | 24 Playwright tests: storefront, cart, checkout, tracking, sign-in, admin, blocking, consent, legal, wishlist, compare, trade-ins, security checks |

`.github/workflows/ci.yml` runs lint, typecheck, the unit suites, the build and the browser tests on every push and
pull request.
