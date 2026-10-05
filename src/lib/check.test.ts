import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { CatalogVariant } from "@/adapters";
import { db } from "@/db";
import { events, products, runs, variants } from "@/db/schema";
import type { Vendor } from "@/vendors";
import { checkVendor } from "./check";

const vendor: Vendor = { slug: "test", name: "Test", platform: "shopify", url: "https://example.com", icon: "/vendors/test.png" };

const item = (id: string, overrides: Partial<CatalogVariant> = {}): CatalogVariant => ({
  externalProductId: `p-${id}`,
  externalVariantId: id,
  productTitle: `Product ${id}`,
  variantTitle: "",
  handle: `product-${id}`,
  productUrl: `https://example.com/products/product-${id}`,
  sku: `SKU-${id}`,
  priceCents: 1000,
  compareAtCents: null,
  stock: "in_stock",
  imageUrl: null,
  ...overrides,
});

const baseline = [item("a"), item("b"), item("c")];

const run = (catalog: CatalogVariant[]) => checkVendor(vendor, async () => catalog);

const latestEvents = () =>
  db
    .select({ type: events.type, externalId: variants.externalId, oldPriceCents: events.oldPriceCents, priceCents: events.priceCents })
    .from(events)
    .innerJoin(variants, eq(variants.id, events.variantId))
    .where(eq(events.runId, sql`(select max(id) from runs)`))
    .orderBy(events.id);

beforeEach(async () => {
  await db.execute(sql`truncate events, variants, products, runs restart identity cascade`);
});

describe("checkVendor", () => {
  it("seeds the first run as a baseline of new events", async () => {
    expect(await run(baseline)).toMatchObject({ status: "ok", variantCount: 3, eventCount: 3, dirty: true });
    const [firstRun] = await db.select().from(runs);
    expect(firstRun.baseline).toBe(true);
    expect((await latestEvents()).map((e) => e.type)).toEqual(["new", "new", "new"]);
  });

  it("writes nothing when the catalog is unchanged", async () => {
    await run(baseline);
    expect(await run(baseline)).toMatchObject({ status: "ok", eventCount: 0, dirty: false });
    const [, secondRun] = await db.select().from(runs).orderBy(runs.id);
    expect(secondRun.baseline).toBe(false);
  });

  it("records stock and price changes as separate events", async () => {
    await run([item("a"), item("b", { stock: "out_of_stock" }), item("c", { stock: "out_of_stock" }), item("d")]);
    await run([item("a", { stock: "out_of_stock" }), item("b"), item("c", { priceCents: 1200 }), item("d", { priceCents: 900 })]);
    expect(await latestEvents()).toEqual([
      { type: "out_of_stock", externalId: "a", oldPriceCents: null, priceCents: 1000 },
      { type: "restock", externalId: "b", oldPriceCents: null, priceCents: 1000 },
      { type: "restock", externalId: "c", oldPriceCents: null, priceCents: 1200 },
      { type: "price_change", externalId: "c", oldPriceCents: 1000, priceCents: 1200 },
      { type: "price_change", externalId: "d", oldPriceCents: 1000, priceCents: 900 },
    ]);
  });

  it("records moves into and out of backorder", async () => {
    await run([item("a"), item("b", { stock: "backorder" }), item("c", { stock: "backorder" }), item("d", { stock: "out_of_stock" })]);
    await run([item("a", { stock: "backorder" }), item("b"), item("c", { stock: "out_of_stock" }), item("d", { stock: "backorder" })]);
    expect((await latestEvents()).map(({ type, externalId }) => [externalId, type])).toEqual([
      ["a", "backorder"],
      ["b", "restock"],
      ["c", "out_of_stock"],
      ["d", "backorder"],
    ]);
  });

  it("removes a variant after two missed runs and re-adds it when it returns", async () => {
    await run(baseline);
    await run([item("a"), item("b")]);
    expect(await latestEvents()).toEqual([]);
    await run([item("a"), item("b")]);
    expect(await latestEvents()).toEqual([{ type: "removed", externalId: "c", oldPriceCents: null, priceCents: 1000 }]);
    await run(baseline);
    expect(await latestEvents()).toEqual([{ type: "new", externalId: "c", oldPriceCents: 1000, priceCents: 1000 }]);
  });

  it("forgives a variant that misses only one run", async () => {
    await run(baseline);
    await run([item("a"), item("b")]);
    expect(await run(baseline)).toMatchObject({ eventCount: 0, dirty: true });
    const [c] = await db.select().from(variants).where(eq(variants.externalId, "c"));
    expect(c).toMatchObject({ missingCount: 0, removedAt: null });
  });

  it("updates product details without creating events", async () => {
    await run(baseline);
    expect(await run([item("a", { imageUrl: "https://example.com/a.png" }), item("b"), item("c")])).toMatchObject({ eventCount: 0, dirty: true });
    const [a] = await db.select().from(products).where(eq(products.externalId, "p-a"));
    expect(a.imageUrl).toBe("https://example.com/a.png");
  });

  it("records product and variant renames with the old name", async () => {
    await run([item("a"), item("b", { externalProductId: "p-a", productTitle: "Product a", variantTitle: "Red" }), item("c", { variantTitle: "Small" })]);
    await run([item("a", { productTitle: "Renamed" }), item("b", { externalProductId: "p-a", productTitle: "Renamed", variantTitle: "Red" }), item("c", { variantTitle: "Large" })]);
    const renames = await db
      .select({ externalId: variants.externalId, oldTitle: events.oldTitle })
      .from(events)
      .innerJoin(variants, eq(variants.id, events.variantId))
      .where(eq(events.type, "rename"))
      .orderBy(events.id);
    expect(renames).toEqual([
      { externalId: "a", oldTitle: "Product a" },
      { externalId: "b", oldTitle: "Product a — Red" },
      { externalId: "c", oldTitle: "Product c — Small" },
    ]);
    const [a] = await db.select().from(products).where(eq(products.externalId, "p-a"));
    expect(a.title).toBe("Renamed");
  });

  it("rejects an empty or shrunken catalog without touching variants", async () => {
    expect(await run([])).toMatchObject({ status: "rejected" });
    await run(baseline);
    expect(await run([])).toMatchObject({ status: "rejected" });
    expect(await run([item("a")])).toMatchObject({ status: "rejected" });
    expect(await latestEvents()).toEqual([]);
    const stored = await db.select({ missingCount: variants.missingCount }).from(variants);
    expect(stored.map((v) => v.missingCount)).toEqual([0, 0, 0]);
  });

  it("records a failed run when the fetch throws", async () => {
    await run(baseline);
    const failing = () => Promise.reject(new Error("boom"));
    expect(await checkVendor(vendor, failing)).toMatchObject({ status: "failed", error: "Error: boom", dirty: false });
    expect(await run(baseline)).toMatchObject({ status: "ok", eventCount: 0 });
  });
});
