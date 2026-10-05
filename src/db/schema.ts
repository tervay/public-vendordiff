import { sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const eventType = pgEnum("event_type", ["new", "removed", "out_of_stock", "restock", "price_change", "backorder", "rename"]);
export const runStatus = pgEnum("run_status", ["ok", "failed", "rejected"]);
export const stockStatus = pgEnum("stock_status", ["in_stock", "backorder", "out_of_stock"]);

export type EventType = (typeof eventType.enumValues)[number];
export type StockStatus = (typeof stockStatus.enumValues)[number];

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    vendorSlug: text("vendor_slug").notNull(),
    externalId: text("external_id").notNull(),
    handle: text("handle").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_vendor_external_idx").on(t.vendorSlug, t.externalId),
    index("products_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: integer("product_id").notNull().references(() => products.id),
    vendorSlug: text("vendor_slug").notNull(),
    externalId: text("external_id").notNull(),
    sku: text("sku"),
    title: text("title").notNull(),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    stock: stockStatus("stock").notNull(),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
    missingCount: integer("missing_count").notNull().default(0),
    removedAt: timestamptz("removed_at"),
  },
  (t) => [
    uniqueIndex("variants_vendor_external_idx").on(t.vendorSlug, t.externalId),
    index("variants_product_idx").on(t.productId),
    index("variants_sku_trgm_idx").using("gin", sql`${t.sku} gin_trgm_ops`),
  ],
);

export const runs = pgTable(
  "runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    vendorSlug: text("vendor_slug").notNull(),
    startedAt: timestamptz("started_at").notNull(),
    status: runStatus("status").notNull(),
    baseline: boolean("baseline").notNull().default(false),
    variantCount: integer("variant_count").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("runs_vendor_started_idx").on(t.vendorSlug, t.startedAt)],
);

export const events = pgTable(
  "events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    variantId: integer("variant_id").notNull().references(() => variants.id),
    vendorSlug: text("vendor_slug").notNull(),
    runId: integer("run_id").notNull().references(() => runs.id),
    type: eventType("type").notNull(),
    oldPriceCents: integer("old_price_cents"),
    oldTitle: text("old_title"),
    priceCents: integer("price_cents").notNull(),
    stock: stockStatus("stock").notNull(),
    occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("events_vendor_id_idx").on(t.vendorSlug, t.id),
    index("events_type_id_idx").on(t.type, t.id),
    index("events_variant_id_idx").on(t.variantId, t.id),
  ],
);
