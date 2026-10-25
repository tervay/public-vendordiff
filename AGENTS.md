<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FRC Vendor Tracker: design

This is a public site at https://vendordiff.com. It checks FRC vendor catalogs every hour and shows new products, stock changes and price changes. It must cost **less than $5 a month**, and it currently runs entirely on free tiers. Every design choice below protects that budget.

## Stack

- **Next.js 16 App Router** on **Vercel Hobby**, with `cacheComponents` and `partialPrefetching` turned on.
- **Supabase Postgres, free plan.** It is installed through the Vercel Marketplace and runs in us-east-1. The app connects through the transaction pooler (`POSTGRES_URL`, port 6543) using postgres.js with `prepare: false`. Migrations use `POSTGRES_URL_NON_POOLING`.
  - We chose Supabase over Neon because Neon's free plan has a monthly compute-hour limit and suspends the database when it runs out.
- **Drizzle ORM** for the schema, queries and migrations (`drizzle/`).
- **Recharts** for the price chart. Tailwind 4 for styling, using color tokens defined in `src/app/globals.css`.
- **Vitest** for tests, which run against a local Postgres in Docker (`compose.yaml`, port 54329).

## Free-tier limits that shape the design

- **Vercel Hobby cron jobs** can each run at most once a day, with at most 100 jobs per project. Hourly checks therefore use **24 daily jobs** (`vercel.ts`), all calling `/api/cron/check`. Each job starts at some point within its scheduled hour.
- **Vercel Hobby resources:** 4 hours of Active CPU, 1 million function calls and 100 GB of data transfer a month. Pages are cached so that most visitors never reach a function.
- **Supabase free plan:** 500 MB of storage and 5 GB of data transfer a month. The database stores **changes only**, never full catalog snapshots. Hourly cron runs read about 1.4 GB a month, which makes data transfer the tightest limit.

## Vendors and adapters

- The vendor list lives only in code (`src/vendors.ts`). There is no vendors table.
- **Shopify** (`src/adapters/shopify.ts`): queries the Storefront GraphQL API at `{url}/api/2026-10/graphql.json` without an access token, 250 products per page, following the cursor and waiting 0.5s between pages.
  - We use GraphQL instead of `products.json` because only GraphQL reports backorders: `products.json` marks a backordered variant as `available`. GraphQL's `availableForSale` and `currentlyNotInStock` fields give the three stock states. Responses are also about 5 times smaller.
  - GraphQL IDs look like `gid://shopify/ProductVariant/123`. We store only the number, which matches the IDs `products.json` used.
  - The variant title is the `selectedOptions` values joined with " / ". GraphQL's own `title` field is wrong for some CTRE variants.
  - A run fails if any product has more than 250 variants, rather than silently dropping the rest.
  - Stock counts (`quantityAvailable`) need an access token, so we can't read them.
  - A vendor can list Shopify `vendor` values to skip in `ignoredShopifyVendors`. WCP sets `["N/A"]`, because those are hub pages (for example "10DP Gears" or "LimeLight Vision Camera") with no SKU and a placeholder price. The real products are listed separately. Don't skip empty SKUs in general: SDS and Armabot have no SKUs at all.
- **REV** (`src/adapters/rev.ts`): one flat JSON feed with no IDs, so the SKU serves as both the product ID and the variant ID. It reports only "Available" or "Out of Stock", so REV variants are never `backorder`.
- `src/adapters/http.ts` retries on 429 and 5xx responses, honoring `Retry-After` up to 30 seconds.
- `fetchCatalog` drops items with invalid prices and **removes duplicate variant IDs**. AndyMark lists some variants under more than one product, so one product in such a pair can end up with no variants.
- Catalog sizes as of October 2026: AndyMark about 5,400 variants, WCP about 1,950, all vendors together about 10,500.

## Data model (`src/db/schema.ts`)

- **`products`**: one row per vendor product, unique on (`vendor_slug`, `external_id`). Pages look products up by (`vendor_slug`, `id`), because vendors can change a product's handle. Holds the product's URL and image.
- **`variants`**: the **current** state of each variant: price in cents, compare-at (sale) price, `stock` (`in_stock`, `backorder` or `out_of_stock`), `missing_count` and `removed_at`.
- **`events`**: append-only, one row per change, with type `new`, `removed`, `out_of_stock`, `backorder`, `restock`, `price_change` or `rename`. Each row records the price and stock **after** the change, `old_price_cents` for price changes and `old_title` for renames. The feeds and the product history charts are both built from this table.
  - Webhooks read new events in `id` order (see Webhooks).
- **`runs`**: one row per vendor check, with status `ok`, `failed` or `rejected`, a `baseline` flag, and variant and event counts. Rows are kept forever because events reference them.

## Check logic (`src/lib/check.ts`)

`checkVendor(vendor)` never throws. Every outcome is recorded as a run.

1. **Fetch the catalog.** On any error, record a `failed` run and change nothing.
2. **Sanity check.** If the catalog has 0 variants, or fewer than 50% of the last `ok` run's count, record a `rejected` run and change nothing.
3. **Apply the changes in one transaction:**
   - Insert or update **only products and variants that changed**. Unchanged rows are never written, which is why there is no `lastSeenAt` column.
   - **Stock and price changes are separate events**, so a variant whose stock and price both change gets two events.
   - A `rename` event is recorded when a variant's full name ("Product — Variant") changes, so renaming a product gives one event per variant. Renames appear on product pages and `/history`, never in the home or vendor feeds.
   - A stock change's event type is named after the new state: `in_stock` → `restock`, `backorder` → `backorder`, `out_of_stock` → `out_of_stock`. Going from backorder back to in stock is a `restock`.
   - A variant missing from the fetch has its `missing_count` raised by 1. When it reaches 2, the variant is marked `removed`.
   - A variant that comes back after removal gets a new `new` event.
   - Writes are batched, 1,000 rows per statement. A normal run is about 4 SQL statements per vendor.
4. **Baseline.** A vendor's first `ok` run is marked `baseline`. Its `new` events give the charts their starting point, but the feeds skip them.

The result's `dirty` flag tells the cron route which caches to refresh.

## Cron route (`src/app/api/cron/check/route.ts`)

- Requires `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends this header automatically.
- Checks every vendor in parallel. A full run takes about 8 seconds, well within the 300-second function limit.
- Calls `revalidateTag(tag, "max")`, which means the next visitor gets the old page while a fresh one builds:
  - `runs` after every run,
  - `vendor:<slug>` for each vendor that changed,
  - `feed` if any vendor changed.

## Pages and caching

Every query in `src/lib/queries.ts` uses `"use cache: remote"` (Vercel's shared cache), `cacheLife("days")`, and a cache tag (`feed`, `vendor:<slug>` or `runs`). The cron route's tag refreshes keep the data current; the daily lifetime is only a backstop.

| Route | How it's served | Contents |
|---|---|---|
| `/` | Static, from the CDN | Vendor status cards and the latest 100 events. Filter chips work in the browser. |
| `/v/[vendor]` | Static; `generateStaticParams` lists every vendor | Vendor status, a search box and the latest 100 events |
| `/v/[vendor]/[product]` | Built on first visit, then cached | Variant table, price step chart and stock timeline for the selected variant, plus its full list of changes. `[product]` is `<id>-<handle>`; only the ID is used, so links survive renames. Shows the first variant. |
| `/v/[vendor]/[product]/[variant]` | Built on first visit, then cached | One variant's current price and stock, price step chart, stock timeline and changes, without the other variants. `[variant]` is the variant's ID. Feed links and the variant table link here. |
| `/history` | Rendered per request | `?vendor=&type=&before=`. Filters run in the database, with keyset pagination on event `id`. |
| `/search` | Rendered per request | `?vendor=&q=&page=`. Matches product titles or SKUs using `ILIKE`, sped up by `pg_trgm` indexes. 50 results per page. |
| `/docs/webhooks` | Static | JSON webhook behavior, plus an example body and field list for each schema version. The example is built by the formatter itself. |
| `/account` | Rendered per request | The signed-in user's Google picture, name and email, a "Sign out" button, and their webhooks. Sends signed-out visitors to `/`. |

Every page's shell is static, but the navbar's account slot is rendered per request (see Auth).

Conventions:
- Keep `searchParams` off the high-traffic pages. Filtering on `/` and `/v/[vendor]` happens in the browser so those pages stay static.
- Links in feeds use `prefetch={false}`, so links scrolling into view don't trigger page builds.
- Dates are shown in America/New_York time and formatted on the server. Product images load straight from vendor CDNs with a plain `<img>`, which avoids Vercel image-optimization quotas.
- Vendor icons are copied from each vendor's site into `public/vendors/` and referenced by `Vendor.icon`. They are served as static files and shown in the feeds' `VendorBadge`.

## Auth

- **Better Auth** (`src/lib/auth.ts`) with the Drizzle adapter. Google is the only sign-in method.
- Tables: `users`, `sessions`, `accounts` and `verifications`. They use Better Auth's text IDs. Row-level security is on with no policies, so Supabase's Data API can't read session or OAuth tokens. The app connects as the table owner, so RLS doesn't apply to it.
- `src/app/api/auth/[...all]/route.ts` serves Better Auth's endpoints, including Google's callback at `/api/auth/callback/google`.
- `src/lib/auth-actions.ts` holds the `signIn` and `signOut` server actions.
- `AccountNav` reads the session on the server inside a `<Suspense>` boundary in the root layout. **Every full page load is therefore a function call**, even though the page shell comes from the CDN. Client-side navigation keeps the layout, so it doesn't re-render the slot.
- `cookieCache` (5 minutes) means a signed-in visitor reads the database at most once every 5 minutes. Visitors with no session cookie never touch the database.
- Environment variables: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Better Auth throws without a secret, which would break the navbar on every page.
- The Google OAuth client allows only `https://vendordiff.com` and `http://localhost:3000` redirect URIs, so **sign-in doesn't work on preview deployments**.

## Webhooks

- Users add webhooks on `/account`, up to 3 each (`MAX_WEBHOOKS`). Each webhook has a type (`slack`, `discord`, `plaintext` or `json`), a URL, a list of vendors, a list of change types and a minimum price (`min_price_cents`, 0 for none). It gets every change that matches both lists and whose price is at or above the minimum. For a price change, the higher of the old and new price counts.
- **`webhooks`** table: `last_event_id` is the webhook's cursor. A new webhook starts at the current `max(events.id)`, so it never receives older changes. RLS is on with no policies, because the URLs are secrets.
- Each type is one file in `src/webhooks/` that exports a `Formatter`: `validUrl`, `event` (the body for one change), `group` (the body for several changes at one vendor) and `text` (the body for a plain message). To add a type, add an enum value, a migration and a formatter.
  - **Slack:** Block Kit, with the product image as the section's accessory. Tested in October 2026: incoming webhooks accept a message even when its image URL is broken. URLs must be `https://hooks.slack.com/services/…`.
  - **Discord:** one embed per message, with `allowed_mentions: { parse: [] }`, so product titles can't ping anyone. URLs must be `https://discord.com/api/webhooks/…` or `https://discordapp.com/api/webhooks/…`.
  - **Plaintext:** a `text/plain` body. URLs must use `https` and a domain name; `localhost` and IP-address hosts are rejected.
  - **JSON** (`src/webhooks/json.ts`): versioned. Users pick a schema version, which is stored in `webhooks.json_version` (null for other types), and the webhook keeps that version. `formatterFor(webhook)` picks the formatter for the version from `jsonVersions`. **Never change an existing version's body.** To change the format, add a new version and document it on `/docs/webhooks`. Version 1 is `{ version, events: [...] }` with nested snake_case fields; plain messages are `{ version, events: [], message }`. URL rules are the same as plaintext.
  - A formatter with `batchSize` (JSON uses 1,000) skips vendor grouping: each run sends every matching change in one `group()` body, split into chunks of up to `batchSize`.
- `deliverWebhooks()` (`src/webhooks/deliver.ts`) runs at the end of every cron run:
  - It reads enabled webhooks, then every non-baseline event after the smallest cursor: 2 queries in total.
  - Each webhook posts **one message per change**, 1 second apart. When one vendor has **3 or more** matching changes in a run, they go into one grouped message instead ("AndyMark: 12 changes", one line each). A group lists at most 15 changes, then "and N more" linking to `/history?vendor=`.
  - Grouped messages are packed to fit each platform's limits: Slack allows 50 blocks per message and 3,000 characters per section; Discord allows 4,096 characters per embed description. Names are cut to 200 characters.
  - At most 20 messages per webhook per run. Any extra changes become one "and N more changes" message linking to `/history`.
  - A failed post stops that webhook for the run. Messages are sent in order of their first event, and the cursor moves to just before the first event of the next unsent message, so the rest are retried next hour. Delivery is at least once.
  - After 24 failed runs in a row, the webhook is turned off and keeps its `last_error`. Turning it back on moves the cursor to the newest event.
  - Posts stop starting 90 seconds after delivery begins. This keeps the cron function under 300 seconds even when endpoints are slow.
  - Requests use `fetchWithRetry` from `src/adapters/http.ts` with `redirect: "error"`. Error messages name the webhook type, never the URL.
- The **Send test** button posts the newest real change, so users can see the real format.

## Environments

- `vercel env pull` writes the **production** Supabase credentials to `.env.local`.
- `.env.development.local` points `next dev` at the local Docker database and takes priority over `.env.local` during development.
- `npm run db:migrate` reads `.env.local`, so it targets **production** unless you set `POSTGRES_URL_NON_POOLING` yourself.
- Preview deployments share the production database, but only production runs the cron jobs.

## Not built yet

- Grouping AndyMark's combined listings into one product.
- Inventory counts. Public Shopify data only says whether something is in stock, backordered or out of stock.
