import { eventLabels, formatPrice, variantName } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

export const SITE_URL = "https://vendordiff.com";

export const eventUrl = (event: FeedEvent) => `${SITE_URL}/v/${event.vendorSlug}/${event.productId}-${event.handle}/${event.variantId}`;

export const eventName = (event: FeedEvent) => variantName(event.productTitle, event.variantTitle);

export const eventLabel = (event: FeedEvent) => eventLabels[event.type];

export const vendorName = (event: FeedEvent) => vendorBySlug(event.vendorSlug)?.name ?? event.vendorSlug;

export function eventDetail(event: FeedEvent, strike: (text: string) => string) {
  if (event.type === "rename") return `was ${event.oldTitle}`;
  if (event.type === "price_change" && event.oldPriceCents !== null) {
    return `${strike(formatPrice(event.oldPriceCents))} → ${formatPrice(event.priceCents)}`;
  }
  return formatPrice(event.priceCents);
}
