import type { EventType } from "@/db/schema";
import { eventLabels, formatPrice, variantName } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

export const SITE_URL = "https://vendordiff.com";

export const eventUrl = (event: FeedEvent) => `${SITE_URL}/v/${event.vendorSlug}/${event.productId}-${event.handle}/${event.variantId}`;

export const eventName = (event: FeedEvent) => variantName(event.productTitle, event.variantTitle);

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
  if (event.type === "rename") return `was ${event.oldTitle}`;
  if (event.type === "price_change" && event.oldPriceCents) {
    const change = formatChange(event.priceCents / event.oldPriceCents - 1);
    return `${strike(formatPrice(event.oldPriceCents))} → ${bold(formatPrice(event.priceCents))} (${change})`;
  }
  return formatPrice(event.priceCents);
}
