import type { FeedEvent } from "@/lib/queries";
import type { Formatter } from ".";
import { eventUrl, vendorName } from "./message";
import { plaintext } from "./plaintext";

const v1Event = (event: FeedEvent) => ({
  id: event.id,
  type: event.type,
  occurred_at: event.occurredAt.toISOString(),
  url: eventUrl(event),
  vendor: { slug: event.vendorSlug, name: vendorName(event) },
  product: { id: event.productId, title: event.productTitle, image_url: event.imageUrl },
  variant: { id: event.variantId, title: event.variantTitle, sku: event.sku },
  price_cents: event.priceCents,
  old_price_cents: event.oldPriceCents,
  old_title: event.oldTitle,
});

const v1 = (events: FeedEvent[]) => JSON.stringify({ version: 1, events: events.map(v1Event) });

export const jsonV1: Formatter = {
  contentType: "application/json",
  urlHint: plaintext.urlHint,
  validUrl: plaintext.validUrl,
  batchSize: 1000,
  event: (event) => v1([event]),
  group: v1,
  text: (message) => JSON.stringify({ version: 1, events: [], message }),
};

export const jsonVersions: Record<number, Formatter> = { 1: jsonV1 };

export const LATEST_JSON_VERSION = 1;

export const isJsonVersion = (value: number) => Object.hasOwn(jsonVersions, value);
