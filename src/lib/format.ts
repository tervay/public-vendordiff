import type { EventType, StockStatus, WebhookType } from "@/db/schema";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

export const formatPrice = (cents: number) => currency.format(cents / 100);
export const formatDate = (date: Date | number) => `${dateTime.format(date)} ET`;
export const formatShortDate = (date: Date | number) => shortDate.format(date);

export const eventLabels: Record<EventType, string> = {
  new: "New",
  restock: "Restocked",
  out_of_stock: "Out of stock",
  backorder: "Backordered",
  price_change: "Price change",
  removed: "Removed",
  rename: "Renamed",
};

export const stockLabels: Record<StockStatus, string> = {
  in_stock: "In stock",
  backorder: "Backordered",
  out_of_stock: "Out of stock",
};

export const webhookTypeLabels: Record<WebhookType, string> = {
  slack: "Slack",
  discord: "Discord",
  plaintext: "Plain text",
};

export const isEventType =(value: unknown): value is EventType => typeof value === "string" && Object.hasOwn(eventLabels, value);

export const variantName = (productTitle: string, variantTitle: string) =>
  variantTitle ? `${productTitle} — ${variantTitle}` : productTitle;
