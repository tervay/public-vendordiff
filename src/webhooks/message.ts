import type { EventType } from "@/db/schema";
import { eventLabels, formatPrice, variantName } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

export const SITE_URL = "https://vendordiff.com";

const MAX_NAME_CHARS = 200;
const MAX_GROUP_LINES = 30;

const truncate = (text: string) => (text.length > MAX_NAME_CHARS ? `${text.slice(0, MAX_NAME_CHARS - 1)}…` : text);

export const eventUrl = (event: FeedEvent) => `${SITE_URL}/v/${event.vendorSlug}/${event.productId}-${event.handle}/${event.variantId}`;

export const vendorHistoryUrl = (event: FeedEvent) => `${SITE_URL}/history?vendor=${event.vendorSlug}`;

export const eventName = (event: FeedEvent) => truncate(variantName(event.productTitle, event.variantTitle));

export const groupTitle = (events: FeedEvent[]) => `${vendorName(events[0])}: ${events.length} changes`;

export function packLines(lines: string[], chunkChars: number, maxChunks: number) {
  const chunks: string[] = [];
  let shown = 0;
  for (const line of lines.slice(0, MAX_GROUP_LINES)) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 1 + line.length <= chunkChars) chunks[chunks.length - 1] = `${last}\n${line}`;
    else if (chunks.length < maxChunks) chunks.push(line);
    else break;
    shown++;
  }
  return { chunks, hidden: lines.length - shown };
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
