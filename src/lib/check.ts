import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { fetchCatalog, type CatalogVariant } from "@/adapters";
import { db } from "@/db";
import { events, products, runs, variants, type EventType } from "@/db/schema";
import type { Vendor } from "@/vendors";

const BATCH_SIZE = 1000;
const REMOVE_AFTER_MISSES = 2;
const MIN_CATALOG_RATIO = 0.5;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StoredVariant = Pick<
  typeof variants.$inferSelect,
  "id" | "externalId" | "productId" | "sku" | "title" | "priceCents" | "compareAtCents" | "available" | "missingCount" | "removedAt"
>;
type PendingEvent = Omit<typeof events.$inferInsert, "variantId" | "runId"> & { externalVariantId: string };

export type RunResult = Pick<typeof runs.$inferSelect, "status" | "variantCount" | "eventCount" | "error"> & { dirty: boolean };

const TRACKED_FIELDS = ["productId", "sku", "title", "priceCents", "compareAtCents", "available", "missingCount"] as const;

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, i) => items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));

const excluded = (columns: Record<string, PgColumn>) =>
  Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)]));

export async function checkVendor(vendor: Vendor, fetcher = fetchCatalog): Promise<RunResult> {
  const startedAt = new Date();
  try {
    const catalog = await fetcher(vendor);
    const previousCount = await lastOkVariantCount(vendor.slug);
    if (catalog.length === 0 || (previousCount !== null && catalog.length < previousCount * MIN_CATALOG_RATIO)) {
      return await recordRun(vendor.slug, startedAt, {
        status: "rejected",
        variantCount: catalog.length,
        eventCount: 0,
        error: `catalog shrank to ${catalog.length} variants from ${previousCount ?? 0}`,
        dirty: false,
      });
    }
    return await applyCatalog(vendor.slug, catalog, previousCount === null, startedAt);
  } catch (error) {
    return recordRun(vendor.slug, startedAt, { status: "failed", variantCount: 0, eventCount: 0, error: String(error), dirty: false });
  }
}

async function lastOkVariantCount(vendorSlug: string) {
  const [last] = await db
    .select({ variantCount: runs.variantCount })
    .from(runs)
    .where(and(eq(runs.vendorSlug, vendorSlug), eq(runs.status, "ok")))
    .orderBy(desc(runs.startedAt))
    .limit(1);
  return last?.variantCount ?? null;
}

async function recordRun(vendorSlug: string, startedAt: Date, result: RunResult) {
  const { status, variantCount, eventCount, error } = result;
  await db.insert(runs).values({ vendorSlug, startedAt, status, variantCount, eventCount, error });
  return result;
}

function applyCatalog(vendorSlug: string, catalog: CatalogVariant[], baseline: boolean, startedAt: Date) {
  return db.transaction(async (tx): Promise<RunResult> => {
    const { productIds, changedProducts } = await syncProducts(tx, vendorSlug, catalog);
    const stored = await tx
      .select({
        id: variants.id,
        externalId: variants.externalId,
        productId: variants.productId,
        sku: variants.sku,
        title: variants.title,
        priceCents: variants.priceCents,
        compareAtCents: variants.compareAtCents,
        available: variants.available,
        missingCount: variants.missingCount,
        removedAt: variants.removedAt,
      })
      .from(variants)
      .where(eq(variants.vendorSlug, vendorSlug));
    const diff = diffVariants(vendorSlug, catalog, new Map(stored.map((v) => [v.externalId, v])), productIds);

    const [run] = await tx
      .insert(runs)
      .values({ vendorSlug, startedAt, status: "ok", baseline, variantCount: catalog.length, eventCount: diff.events.length })
      .returning({ id: runs.id });

    const variantIds = new Map(stored.map((v) => [v.externalId, v.id]));
    for (const batch of chunks(diff.upserts)) {
      const rows = await tx
        .insert(variants)
        .values(batch)
        .onConflictDoUpdate({
          target: [variants.vendorSlug, variants.externalId],
          set: excluded({
            productId: variants.productId,
            sku: variants.sku,
            title: variants.title,
            priceCents: variants.priceCents,
            compareAtCents: variants.compareAtCents,
            available: variants.available,
            missingCount: variants.missingCount,
            removedAt: variants.removedAt,
          }),
        })
        .returning({ id: variants.id, externalId: variants.externalId });
      for (const row of rows) variantIds.set(row.externalId, row.id);
    }

    if (diff.missingIds.length > 0) {
      await tx
        .update(variants)
        .set({
          missingCount: sql`${variants.missingCount} + 1`,
          removedAt: sql`case when ${variants.missingCount} + 1 >= ${REMOVE_AFTER_MISSES} then now() end`,
        })
        .where(inArray(variants.id, diff.missingIds));
    }

    for (const batch of chunks(diff.events)) {
      await tx
        .insert(events)
        .values(batch.map(({ externalVariantId, ...event }) => ({ ...event, variantId: variantIds.get(externalVariantId)!, runId: run.id })));
    }

    return {
      status: "ok",
      variantCount: catalog.length,
      eventCount: diff.events.length,
      error: null,
      dirty: changedProducts > 0 || diff.upserts.length > 0 || diff.events.length > 0,
    };
  });
}

async function syncProducts(tx: Tx, vendorSlug: string, catalog: CatalogVariant[]) {
  const stored = await tx.select().from(products).where(eq(products.vendorSlug, vendorSlug));
  const storedByExternalId = new Map(stored.map((p) => [p.externalId, p]));
  const incoming = new Map(
    catalog.map((item) => [
      item.externalProductId,
      { vendorSlug, externalId: item.externalProductId, handle: item.handle, title: item.productTitle, url: item.productUrl, imageUrl: item.imageUrl },
    ]),
  );
  const changed = [...incoming.values()].filter((p) => {
    const old = storedByExternalId.get(p.externalId);
    return !old || old.handle !== p.handle || old.title !== p.title || old.url !== p.url || old.imageUrl !== p.imageUrl;
  });

  const productIds = new Map(stored.map((p) => [p.externalId, p.id]));
  for (const batch of chunks(changed)) {
    const rows = await tx
      .insert(products)
      .values(batch)
      .onConflictDoUpdate({
        target: [products.vendorSlug, products.externalId],
        set: excluded({ handle: products.handle, title: products.title, url: products.url, imageUrl: products.imageUrl }),
      })
      .returning({ id: products.id, externalId: products.externalId });
    for (const row of rows) productIds.set(row.externalId, row.id);
  }
  return { productIds, changedProducts: changed.length };
}

function diffVariants(
  vendorSlug: string,
  catalog: CatalogVariant[],
  stored: Map<string, StoredVariant>,
  productIds: Map<string, number>,
) {
  const upserts: (typeof variants.$inferInsert)[] = [];
  const pending: PendingEvent[] = [];
  const seen = new Set<string>();

  for (const item of catalog) {
    seen.add(item.externalVariantId);
    const old = stored.get(item.externalVariantId);
    const row = {
      vendorSlug,
      externalId: item.externalVariantId,
      productId: productIds.get(item.externalProductId)!,
      sku: item.sku,
      title: item.variantTitle,
      priceCents: item.priceCents,
      compareAtCents: item.compareAtCents,
      available: item.available,
      missingCount: 0,
      removedAt: null,
    };
    const record = (type: EventType, oldPriceCents: number | null = null) =>
      pending.push({ externalVariantId: item.externalVariantId, vendorSlug, type, oldPriceCents, priceCents: item.priceCents, available: item.available });

    if (!old || old.removedAt) {
      record("new", old?.priceCents ?? null);
      upserts.push(row);
      continue;
    }
    if (old.available !== item.available) record(item.available ? "restock" : "out_of_stock");
    if (old.priceCents !== item.priceCents) record("price_change", old.priceCents);
    if (TRACKED_FIELDS.some((field) => old[field] !== row[field])) upserts.push(row);
  }

  const missing = [...stored.values()].filter((v) => !v.removedAt && !seen.has(v.externalId));
  for (const v of missing.filter((v) => v.missingCount + 1 >= REMOVE_AFTER_MISSES)) {
    pending.push({ externalVariantId: v.externalId, vendorSlug, type: "removed", oldPriceCents: null, priceCents: v.priceCents, available: false });
  }

  return { upserts, missingIds: missing.map((v) => v.id), events: pending };
}
