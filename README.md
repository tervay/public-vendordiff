# FRC Vendor Tracker

A public site that tracks stock and price changes across FRC vendors. Every vendor is checked hourly by Vercel Cron, and only changes are stored in Postgres.

## Local development

You need Docker and Node 24.

```bash
npm install
npm run db:up
POSTGRES_URL_NON_POOLING=postgres://postgres:postgres@localhost:54329/postgres npm run db:migrate
npm run dev
```

`vercel env pull` writes the production Supabase credentials to `.env.local`. To keep `next dev` on the local database, create `.env.development.local`, which takes priority during development:

```
POSTGRES_URL=postgres://postgres:postgres@localhost:54329/postgres
CRON_SECRET=dev-secret
```

`npm run db:migrate` does not read `.env.development.local`. It always targets the database in `.env.local`.

To run a check by hand:

```bash
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/check
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs the check tests against the `vendordiff_test` database in the same container |
| `npm run fetch-catalogs` | Fetches every vendor and prints product and variant counts, without touching the database |
| `npm run db:generate` | Creates a migration after you change `src/db/schema.ts` |
| `npm run db:migrate` | Applies migrations to the database in `POSTGRES_URL_NON_POOLING`, or `POSTGRES_URL` if that is unset |

## Deploying

1. Create a Vercel project from this repository on the Hobby plan.
2. Add Supabase from the Vercel Marketplace. This sets `POSTGRES_URL` (the transaction pooler) and `POSTGRES_URL_NON_POOLING`.
3. Add a `CRON_SECRET` environment variable with a long random value. Vercel Cron sends it automatically.
4. Run `vercel env pull .env.local`, then `npm run db:migrate`. This creates the `pg_trgm` extension and the tables.
5. Deploy. `vercel.ts` registers 24 daily cron jobs, one per hour, because Hobby allows each job to run only once a day. Each run checks every vendor in parallel.

The first successful run for each vendor is a baseline. It records every variant but stays out of the feeds.

## Adding a vendor

Add an entry to `src/vendors.ts`. Shopify stores need only their base URL. Another platform needs a new adapter in `src/adapters/` that returns `CatalogVariant[]`.
