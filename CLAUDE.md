@AGENTS.md

# Working on JDHub

JDHub is a Nigerian graded marketplace (buy, sell, swap phones, accessories, gadgets and cars) with an admin
that runs the whole store. Read these before changing code:

- [PROJECT.md](./PROJECT.md): what the product does, who it's for, status and launch checklist.
- [SYSTEM.md](./SYSTEM.md): architecture, data model, auth, integrations, environment variables.
- [DESIGN.md](./DESIGN.md): design language, tokens, components, voice.

## Commands

```bash
npm run dev            # http://localhost:3000 (admin password jdhub-admin without ADMIN_PASSWORD)
npm run typecheck      # next typegen && tsc --noEmit (run typegen after adding routes)
npm run lint
npm run build
npm run test:orders    # also test:notify, test:reviews, test:extras, test:tradein
npm run build && npm run test:e2e   # Playwright against a production build
```

Run typecheck, lint, the unit suites you touched and (for UI or flow changes) the browser tests before pushing.
CI (`.github/workflows/ci.yml`) runs all of them on every push and pull request.

## Next.js 16 rules that bite

- `cacheComponents` is on. Request-time data (cookies, headers, searchParams, uncached store reads, the clock)
  must sit inside `<Suspense>` or a `'use cache'` scope. Call `await connection()` before `Date.now()` in a
  server component. Client components that call `usePathname()`/`useSearchParams()` need a Suspense parent.
- `params` and `searchParams` are Promises. `proxy.ts` replaces middleware.
- `updateTag` only works in Server Actions: use `refreshFromAction` there and `refreshFromRoute` in route handlers.
- Error boundaries receive `retry`, not `reset`.
- Read `node_modules/next/dist/docs/` before using an API you haven't used in this version.

## Rules

- **Server-only code stays on the server.** Never import `lib/store`, `lib/orders`, `lib/auth`,
  `lib/customer-auth` or `lib/messaging` from a client component; pass data down as props.
- **Every admin page and Server Action checks access**: `requireAdmin(perm)` or `sessionWith(perm)`, then
  `audit(session, action, target, detail)` for changes.
- **Never trust the client** for prices, stock, roles or ownership. Checkout re-prices with `priceCart`; order
  and trade-in pages require their secret token; stock moves only through `lib/orders.ts`.
- **Atomic where money or stock is involved**: `reserveStock`, `claimOfferUse`, `rateLimit`, and `withLock` for
  read-modify-write on records.
- **New data** goes through `getDriver()` with a `jd:<feature>:` key prefix, in that feature's own module.
- **Messages** go through `lib/messaging.ts`; escape any user text with `escapeHtml` in email HTML.
- **No fabricated social proof.** Ratings, reviews, seller names and stock claims must come from real data.
- **Secrets never go in the repo.** Keys live in Vercel environment variables. `SUPABASE_SERVICE_ROLE_KEY` is
  server-only and must never be `NEXT_PUBLIC_`. `OTP_DEV_CODES` and `JDHUB_MEMORY_ONLY` are for tests only.
- Don't add npm dependencies without asking the owner.
- Match the surrounding code: naming, comment density, Tailwind tokens from `app/globals.css`.

## Git

Develop on a branch, never directly on `main`. Commit messages explain the why. Open pull requests only when
asked; CI must be green before merging. Vercel deploys `main` to production automatically.
