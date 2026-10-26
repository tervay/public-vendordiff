import type { EventType } from "@/db/schema";
import { eventLabels, formatPrice, variantName } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

export const SITE_URL = "https://vendordiff.com";

const MAX_NAME_CHARS = 200;
const MAX_GROUP_LINES = 15;

const truncate = (text: string) => (text.length > MAX_NAME_CHARS ? `${text.slice(0, MAX_NAME_CHARS - 1)}…` : text);

const productUrl = (event: FeedEvent) => `${SITE_URL}/v/${event.vendorSlug}/${event.productId}-${event.handle}`;

export const eventUrl = (event: FeedEvent) => `${productUrl(event)}/${event.variantId}`;

export const vendorHistoryUrl = (event: FeedEvent) => `${SITE_URL}/history?vendor=${event.vendorSlug}`;

const searchUrl = (vendor: string, q: string) => `${SITE_URL}/search?${new URLSearchParams({ vendor, q })}`;

export const eventName = (event: FeedEvent) => truncate(variantName(event.productTitle, event.variantTitle));

export const groupTitle = (events: FeedEvent[]) => `${vendorName(events[0])}: ${events.length} changes`;

export type Row = { events: FeedEvent[]; name: string; url: string };

const baseTitle = (event: FeedEvent) => event.productTitle.split(" - ")[0];

const listingKey = (event: FeedEvent) => (vendorBySlug(event.vendorSlug)?.combinedListings ? baseTitle(event) : event.productId);

const productCount = (events: FeedEvent[]) => new Set(events.map((event) => event.productId)).size;

function toRow(events: FeedEvent[]): Row {
  const [first] = events;
  if (events.length === 1) return { events, name: eventName(first), url: eventUrl(first) };
  if (productCount(events) === 1) return { events, name: truncate(first.productTitle), url: productUrl(first) };
  return { events, name: truncate(baseTitle(first)), url: searchUrl(first.vendorSlug, baseTitle(first)) };
}

const groupRows = (events: FeedEvent[]) => [...Map.groupBy(events, (event) => `${event.type}:${listingKey(event)}`).values()].map(toRow);

export function packLines(events: FeedEvent[], line: (row: Row) => string, chunkChars: number, maxChunks: number) {
  const chunks: string[] = [];
  let hidden = events.length;
  for (const row of groupRows(events).slice(0, MAX_GROUP_LINES)) {
    const text = line(row);
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 1 + text.length <= chunkChars) chunks[chunks.length - 1] = `${last}\n${text}`;
    else if (chunks.length < maxChunks) chunks.push(text);
    else break;
    hidden -= row.events.length;
  }
  return { chunks, hidden };
}

const eventEmojis: Record<EventType, string> = {
  new: "🆕",
  restock: "✅",
  out_of_stock: "❌",
  backorder: "⏳",
  price_change: "💲",
  removed: "🗑️",
  rename: "✏️",
};

export const eventEmoji = (event: FeedEvent) => eventEmojis[event.type];

export const eventLabel = (event: FeedEvent) => `${eventEmoji(event)} ${eventLabels[event.type]}`;

export const vendorName = (event: FeedEvent) => vendorBySlug(event.vendorSlug)?.name ?? event.vendorSlug;

export type Markup = { strike: (text: string) => string; bold: (text: string) => string };

export const plain: Markup = { strike: (text) => text, bold: (text) => text };

const formatChange = (ratio: number) =>
  new Intl.NumberFormat("en-US", { style: "percent", signDisplay: "always", maximumFractionDigits: Math.abs(ratio) < 0.1 ? 1 : 0 }).format(ratio);

export function eventDetail(event: FeedEvent, { strike, bold }: Markup) {
  if (event.type === "rename") return `was ${truncate(event.oldTitle ?? "")}`;
  if (event.type === "price_change" && event.oldPriceCents) {
    const change = formatChange(event.priceCents / event.oldPriceCents - 1);
    return `${strike(formatPrice(event.oldPriceCents))} → ${bold(formatPrice(event.priceCents))} (${change})`;
  }
  return formatPrice(event.priceCents);
}

function range(values: number[], format: (value: number) => string, separator = "–") {
  const [low, high] = [Math.min(...values), Math.max(...values)];
  return low === high ? format(low) : `${format(low)}${separator}${format(high)}`;
}

export function rowDetail({ events }: Row, markup: Markup) {
  if (events.length === 1) return eventDetail(events[0], markup);
  const products = productCount(events);
  const count = `${events.length} variants${products > 1 ? ` in ${products} products` : ""}`;
  const prices = range(
    events.map((event) => event.priceCents),
    formatPrice,
  );
  switch (events[0].type) {
    case "rename":
      return count;
    case "price_change": {
      const changes = range(
        events.map((event) => event.priceCents / event.oldPriceCents! - 1),
        formatChange,
        " to ",
      );
      return `${count} · ${markup.bold(prices)} (${changes})`;
    }
    default:
      return `${count} · ${prices}`;
  }
}
