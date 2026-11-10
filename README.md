# JDHub

Nigeria's graded trade platform: buy, sell and swap phones, accessories, gadgets and cars, with escrow-protected
payment and an admin that runs the whole store. Live at https://jdhubplug.vercel.app/.

| Doc | What's in it |
| --- | --- |
| [PROJECT.md](./PROJECT.md) | Product, features, status, launch checklist |
| [SYSTEM.md](./SYSTEM.md) | Architecture, data, auth, integrations, environment variables, tests |
| [DESIGN.md](./DESIGN.md) | Design language, tokens, logo, components, voice |
| [CLAUDE.md](./CLAUDE.md) | Rules and commands for working on the code |

## Run

```bash
npm install
cp .env.example .env.local   # optional: without keys the store runs in memory
npm run dev                  # http://localhost:3000, admin at /admin (password jdhub-admin)
```

## Check

```bash
npm run typecheck && npm run lint
npm run test:orders          # also test:notify, test:reviews, test:extras, test:tradein
npm run build && npm run test:e2e
```

Product photos are hotlinked from Wikimedia Commons (credited on each product page and at `/credits`); while a
photo loads, or if it fails, the card shows a vector illustration. Prices are a starting point and move with the
exchange rate.
