import { and, desc, eq, exists, ilike, lt, min, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { events, products, runs, variants, type EventType } from "@/db/schema";

export const FEED_LIMIT = 100;
export const SEARCH_PAGE_SIZE = 50;

const scopeTag = (vendor?: string) => (vendor ? `vendor:${vendor}` : "feed");

export async function getLatestRuns() {
  "use cache: remote";
  cacheLife("days");
  cacheTag("runs");
  return db
    .selectDistinctOn([runs.vendorSlug], { vendorSlug: runs.vendorSlug, startedAt: runs.startedAt, status: runs.status })
    .from(runs)
    .orderBy(runs.vendorSlug, desc(runs.startedAt));
}

export async function getEvents({ vendor, type, before }: { vendor?: string; type?: EventType; before?: number }) {
  "use cache: remote";
  cacheLife("days");
  cacheTag(scopeTag(vendor));
  return db
    .select({
      id: events.id,
      type: events.type,
      occurredAt: events.occurredAt,
      oldPriceCents: events.oldPriceCents,
      priceCents: events.priceCents,
      vendorSlug: events.vendorSlug,
      variantId: events.variantId,
      variantTitle: variants.title,
      sku: variants.sku,
      productTitle: products.title,
      productId: products.id,
      handle: products.handle,
      imageUrl: products.imageUrl,
    })
    .from(events)
    .innerJoin(runs, eq(runs.id, events.runId))
    .innerJoin(variants, eq(variants.id, events.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(
      and(
        eq(runs.baseline, false),
        ne(events.type, "rename"),
        vendor ? eq(events.vendorSlug, vendor) : undefined,
        type ? eq(events.type, type) : undefined,
        before ? lt(events.id, before) : undefined,
      ),
    )
    .orderBy(desc(events.id))
    .limit(FEED_LIMIT);
}

export type FeedEvent = Awaited<ReturnType<typeof getEvents>>[number];

export async function getProduct(vendor: string, id: number) {
  "use cache: remote";
  cacheLife("days");
  cacheTag(scopeTag(vendor));
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.vendorSlug, vendor), eq(products.id, id)));
  if (!product) return null;

  const [productVariants, history] = await Promise.all([
    db
      .select({
        id: variants.id,
        title: variants.title,
        sku: variants.sku,
        priceCents: variants.priceCents,
        compareAtCents: variants.compareAtCents,
        stock: variants.stock,
        removedAt: variants.removedAt,
      })
      .from(variants)
      .where(eq(variants.productId, product.id))
      .orderBy(variants.id),
    db
      .select({
        id: events.id,
        variantId: events.variantId,
        type: events.type,
        occurredAt: events.occurredAt,
        oldPriceCents: events.oldPriceCents,
        oldTitle: events.oldTitle,
        priceCents: events.priceCents,
        stock: events.stock,
      })
      .from(events)
      .innerJoin(variants, eq(variants.id, events.variantId))
      .where(eq(variants.productId, product.id))
      .orderBy(events.id),
  ]);
  return { product, variants: productVariants, history, asOf: new Date() };
}

export type ProductData = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function searchProducts(vendor: string | undefined, query: string, page: number) {
  "use cache: remote";
  cacheLife("days");
  cacheTag(scopeTag(vendor));
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const skuMatch = alias(variants, "sku_match");
  return db
    .select({
      vendorSlug: products.vendorSlug,
      productId: products.id,
      handle: products.handle,
      title: products.title,
      imageUrl: products.imageUrl,
      minPriceCents: min(variants.priceCents),
      activeCount: sql<number>`count(*) filter (where ${variants.removedAt} is null)`.mapWith(Number),
      inStockCount: sql<number>`count(*) filter (where ${variants.removedAt} is null and ${variants.stock} = 'in_stock')`.mapWith(Number),
    })
    .from(products)
    .innerJoin(variants, eq(variants.productId, products.id))
    .where(
      and(
        vendor ? eq(products.vendorSlug, vendor) : undefined,
        query
          ? or(
              ilike(products.title, pattern),
              exists(db.select({ one: sql`1` }).from(skuMatch).where(and(eq(skuMatch.productId, products.id), ilike(skuMatch.sku, pattern)))),
            )
          : undefined,
      ),
    )
    .groupBy(products.id)
    .orderBy(products.title, products.id)
    .limit(SEARCH_PAGE_SIZE + 1)
    .offset(page * SEARCH_PAGE_SIZE);
}
