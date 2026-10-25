import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogVariant } from "@/adapters";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { checkVendor } from "@/lib/check";
import type { Vendor } from "@/vendors";
import { deliverWebhooks, latestEventId } from "./deliver";

const vendor: Vendor = { slug: "test", name: "Test", platform: "shopify", url: "https://example.com", icon: "/vendors/test.png" };

const item = (id: string, overrides: Partial<CatalogVariant> = {}): CatalogVariant => ({
  externalProductId: `p-${id}`,
  externalVariantId: id,
  productTitle: `Product ${id}`,
  variantTitle: "",
  handle: `product-${id}`,
  productUrl: `https://example.com/products/product-${id}`,
  sku: null,
  priceCents: 1000,
  compareAtCents: null,
  stock: "in_stock",
  imageUrl: null,
  ...overrides,
});

const ids = (count: number) => Array.from({ length: count }, (_, i) => `v${i}`);
const run = (catalog: CatalogVariant[], slug = vendor.slug) => checkVendor({ ...vendor, slug }, async () => catalog);
const inStock = (count: number, slug?: string) => run(ids(count).map((id) => item(id)), slug);
const outOfStock = (count: number, slug?: string) => run(ids(count).map((id) => item(id, { stock: "out_of_stock" })), slug);
const deliver = () => deliverWebhooks({ pauseMs: 0 });

let posts: string[];
let failing: (attempt: number) => boolean;

async function addWebhook(overrides: Partial<typeof webhooks.$inferInsert> = {}) {
  const [webhook] = await db
    .insert(webhooks)
    .values({
      userId: "user",
      type: "plaintext",
      url: "https://example.com/hook",
      vendorSlugs: ["test"],
      eventTypes: ["out_of_stock"],
      lastEventId: await latestEventId(),
      ...overrides,
    })
    .returning();
  return webhook;
}

const stored = async (id: number) => (await db.select().from(webhooks).where(eq(webhooks.id, id)))[0];

beforeEach(async () => {
  await db.execute(sql`truncate events, variants, products, runs, webhooks, users restart identity cascade`);
  await db.execute(sql`insert into users (id, name, email) values ('user', 'User', 'user@example.com')`);
  posts = [];
  failing = () => false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      posts.push(String(init.body));
      return new Response(null, { status: failing(posts.length) ? 400 : 204 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deliverWebhooks", () => {
  it("posts matching changes once and skips baseline events", async () => {
    const webhook = await addWebhook({ lastEventId: 0 });
    await inStock(3);
    await run([item("v0", { stock: "out_of_stock" }), item("v1", { priceCents: 1200 }), item("v2")]);
    expect(await deliver()).toEqual({ sent: 1, failed: 0 });
    expect(posts).toEqual(["❌ Out of stock: test Product v0, $10.00\nhttps://vendordiff.com/v/test/1-product-v0/1"]);
    expect(await stored(webhook.id)).toMatchObject({ lastEventId: await latestEventId(), failureCount: 0, lastError: null });
    expect(await deliver()).toEqual({ sent: 0, failed: 0 });
  });

  it("advances past changes for other vendors without posting", async () => {
    await inStock(2);
    const webhook = await addWebhook({ vendorSlugs: ["other"] });
    await outOfStock(2);
    expect(await deliver()).toEqual({ sent: 0, failed: 0 });
    expect((await stored(webhook.id)).lastEventId).toBe(await latestEventId());
  });

  it("groups 3 or more changes at one vendor into one message", async () => {
    await inStock(3);
    await inStock(2, "other");
    await addWebhook({ vendorSlugs: ["test", "other"] });
    await outOfStock(3);
    await outOfStock(2, "other");
    expect(await deliver()).toEqual({ sent: 3, failed: 0 });
    expect(posts[0].split("\n").slice(0, 2)).toEqual(["test: 3 changes", "❌ Out of stock: Product v0, $10.00 https://vendordiff.com/v/test/1-product-v0/1"]);
    expect(posts.slice(1).map((post) => post.split(",")[0])).toEqual(["❌ Out of stock: other Product v0", "❌ Out of stock: other Product v1"]);
  });

  it("skips changes under the minimum price, using the higher of the old and new price", async () => {
    await inStock(2);
    const webhook = await addWebhook({ eventTypes: ["out_of_stock", "price_change"], minPriceCents: 1500 });
    await run([item("v0", { stock: "out_of_stock" }), item("v1", { priceCents: 2000 })]);
    await run([item("v0", { stock: "out_of_stock" }), item("v1", { priceCents: 1200 })]);
    expect(await deliver()).toEqual({ sent: 2, failed: 0 });
    expect(posts.map((post) => post.split("\n")[0])).toEqual([
      "💲 Price change: test Product v1, $10.00 → $20.00 (+100%)",
      "💲 Price change: test Product v1, $20.00 → $12.00 (-40%)",
    ]);
    expect((await stored(webhook.id)).lastEventId).toBe(await latestEventId());
  });

  it("sends every change in one JSON body", async () => {
    await inStock(3);
    await inStock(2, "other");
    const webhook = await addWebhook({ type: "json", jsonVersion: 1, vendorSlugs: ["test", "other"] });
    await outOfStock(3);
    await outOfStock(2, "other");
    expect(await deliver()).toEqual({ sent: 1, failed: 0 });
    const body = JSON.parse(posts[0]);
    expect(body.version).toBe(1);
    expect(body.events.map((event: { vendor: { slug: string } }) => event.vendor.slug)).toEqual(["test", "test", "test", "other", "other"]);
    expect((await stored(webhook.id)).lastEventId).toBe(await latestEventId());
  });

  it("lists at most 15 changes in a group", async () => {
    await inStock(20);
    await addWebhook();
    await outOfStock(20);
    expect(await deliver()).toEqual({ sent: 1, failed: 0 });
    const lines = posts[0].split("\n");
    expect(lines).toHaveLength(17);
    expect(lines.at(-1)).toBe("and 5 more: https://vendordiff.com/history?vendor=test");
  });

  it("posts at most 20 messages and then a summary", async () => {
    const slugs = ids(11);
    for (const slug of slugs) await inStock(2, slug);
    await addWebhook({ vendorSlugs: slugs });
    for (const slug of slugs) await outOfStock(2, slug);
    expect(await deliver()).toEqual({ sent: 21, failed: 0 });
    expect(posts.at(-1)).toBe("and 2 more changes: https://vendordiff.com/history");
    expect(await deliver()).toEqual({ sent: 0, failed: 0 });
  });

  it("resumes after the last successful post when one fails", async () => {
    await inStock(2);
    const webhook = await addWebhook();
    await outOfStock(2);
    failing = (attempt) => attempt === 2;
    expect(await deliver()).toEqual({ sent: 1, failed: 1 });
    expect(await stored(webhook.id)).toMatchObject({ lastEventId: webhook.lastEventId + 1, failureCount: 1, lastError: "Error: POST plaintext webhook failed: 400" });
    failing = () => false;
    posts = [];
    expect(await deliver()).toEqual({ sent: 1, failed: 0 });
    expect(posts.map((post) => post.split(",")[0])).toEqual(["❌ Out of stock: test Product v1"]);
    expect(await stored(webhook.id)).toMatchObject({ lastEventId: await latestEventId(), failureCount: 0, lastError: null });
  });

  it("turns a webhook off after 24 failed runs in a row", async () => {
    await inStock(1);
    const webhook = await addWebhook({ failureCount: 23 });
    await outOfStock(1);
    failing = () => true;
    expect(await deliver()).toEqual({ sent: 0, failed: 1 });
    expect(await stored(webhook.id)).toMatchObject({ enabled: false, failureCount: 24 });
    expect(await deliver()).toEqual({ sent: 0, failed: 0 });
  });
});
