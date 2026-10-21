# JDHub: project overview

**Nigeria's graded trade platform.** Buy, sell and swap phones, accessories, gadgets and cars, with one grading
standard, inspection on everything, and escrow-protected payment. Live at https://jdhubplug.vercel.app/
(deployed from `main` by Vercel).

Signature line: *Trade with certainty.*

## Who it serves

| Audience | What they do |
| --- | --- |
| Buyers | Browse graded listings, save, compare, buy with Paystack, bank transfer or WhatsApp; track orders; review purchases |
| Sellers | Get an instant offer, book an inspection, accept the final offer, get paid (bank transfer, cash or swap credit) |
| Swappers | Trade in a device for credit towards a new one |
| Store team | Run the whole business from `/admin`: catalog, stock, orders, offers, trade-ins, customers, messages, legal |

## Features

### Storefront

- Home, shop and category pages with filters and sort; product pages with grade, specs, seller and buy box.
- Catalog of 212 graded listings built from 106 models (`lib/models.ts`) with Nigerian prices and Wikimedia
  Commons photos (credited at `/credits`); vector illustrations stand in while photos load.
- Cart with fly-to-cart animation, checkout (hub pickup or delivery; Paystack, bank transfer or WhatsApp),
  order page with live status, order tracking by number and phone.
- Passwordless accounts (one-time code by email or SMS); sign-in is required at checkout by default.
- Wishlist (synced to the account), compare up to 4 products, "notify me when it's back".
- Verified-purchase reviews (only after delivery).
- Offers with special links (`/o/{code}`) and usage limits.
- Sell estimator and swap planner; each request gets a status page (`/trade-in/{id}?t=…`).
- Trust page (escrow, grading, hubs), legal pages (Privacy, Terms, Returns & warranty, Cookies), cookie consent.

### Admin (`/admin`)

| Area | What it does |
| --- | --- |
| Dashboard | Sales, orders to act on, low stock (restockable items only), setup checklist, system health |
| Products, inventory | Edit listings and prices, photos, bulk import/export, stock adjustments |
| Offers & links | Create discounts with special links, limits and schedules; views, orders, paid uses and revenue |
| Stock alerts | Demand by model from "notify me" requests; send alerts |
| Orders | Status flow, payments, notes, invoices, message history, resend updates |
| Customers | Buyers by phone, shopper accounts, block / unblock |
| Requests | Sell/swap pipeline from lead to inspection, offer and payout; contact and vendor requests |
| Reviews | Moderate, reply, auto-publish toggle |
| Settings | Store details, delivery fees, hubs, bank details, checkout rules, backups, sign out everyone |
| Notifications | Per-event email/SMS toggles, template previews, test email, message log |
| Privacy & legal | Company details, return/warranty days, data requests, anonymise a customer |
| Staff, activity log | Owner/manager/support roles; every change is audited |

## Status

All features above are merged to `main` and covered by CI (lint, types, 5 unit suites, 24 browser tests).
Not yet verified against the live services (Supabase, Resend, Termii, Paystack), because they need the
production keys.

## Launch checklist

1. **Storage:** run `supabase/migrations/0001_jdhub_store.sql` in Supabase, then set `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Without them, orders and edits are lost on restart.
2. **Security:** set `ADMIN_PASSWORD`, `AUTH_SECRET` and `CRON_SECRET`. Rotate any key that has been shared in chat.
3. **Domain:** set `NEXT_PUBLIC_SITE_URL` (used in links, sitemap, emails and Paystack callbacks).
4. **Email:** verify the sending domain in Resend; set `RESEND_API_KEY` and `EMAIL_FROM`. Optional SMS: Termii key and
   an approved sender ID.
5. **Payments:** Paystack live keys (`PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`) and the webhook URL
   `/api/paystack/webhook`.
6. **Monitoring:** `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_AUTH_TOKEN` for readable traces), `NEXT_PUBLIC_POSTHOG_KEY`.
7. **Store details** in Admin → Settings: WhatsApp, phone, email, hubs, bank details.
8. **Legal:** fill in Admin → Privacy & legal and have a Nigerian lawyer review the four legal pages (NDPA 2023).
9. Check Admin → Dashboard → System health shows no problems; place a test order end to end.

## Still to do

- Real product photography for listings (consistent studio shots instead of Commons photos).
- A verification provider for IMEI/VIN checks (the Trust page only checks the format today).
- Accessibility audit with an automated scanner and real-device testing.
- Vendor (third-party seller) accounts: `/vendors` is an early-access sign-up only.
