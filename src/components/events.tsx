import Link from "next/link";
import type { EventType, StockStatus } from "@/db/schema";
import { eventLabels, formatDate, formatPrice, variantName } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

const badgeStyles: Record<EventType, string> = {
  new: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  restock: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  out_of_stock: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  backorder: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  price_change: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  removed: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  rename: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

export const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${active ? "border-foreground bg-foreground text-background" : "border-hairline hover:border-subtle"}`;

export const feedFilters: (EventType | null)[] = [null, "new", "restock", "out_of_stock", "backorder", "price_change", "removed"];

export const stockColors: Record<StockStatus, string> = { in_stock: "bg-good", backorder: "bg-warning", out_of_stock: "bg-critical" };

export function EventBadge({ type }: { type: EventType }) {
  return <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${badgeStyles[type]}`}>{eventLabels[type]}</span>;
}

export function PriceText({ type, oldPriceCents, priceCents }: { type: EventType; oldPriceCents: number | null; priceCents: number }) {
  if (type !== "price_change" || oldPriceCents === null) return <span>{formatPrice(priceCents)}</span>;
  const direction = priceCents > oldPriceCents ? "▲" : "▼";
  return (
    <span>
      <span className="text-subtle line-through">{formatPrice(oldPriceCents)}</span> {formatPrice(priceCents)} {direction}
    </span>
  );
}

export function Thumbnail({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="size-12 shrink-0 rounded bg-white object-contain" />
  ) : (
    <div className="size-12 shrink-0 rounded bg-hairline" />
  );
}

export function EventRow({ event, showVendor }: { event: FeedEvent; showVendor: boolean }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Thumbnail src={event.imageUrl} />
      <div className="min-w-0 flex-1">
        <Link href={`/v/${event.vendorSlug}/${event.productId}-${event.handle}/${event.variantId}`} prefetch={false} className="block truncate font-medium hover:underline">
          {variantName(event.productTitle, event.variantTitle)}
        </Link>
        <div className="truncate text-sm text-muted">
          {[showVendor && vendorBySlug(event.vendorSlug)?.name, event.sku, formatDate(event.occurredAt)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-sm tabular-nums">
        <EventBadge type={event.type} />
        <PriceText {...event} />
      </div>
    </li>
  );
}

export function EventList({ events, showVendor }: { events: FeedEvent[]; showVendor: boolean }) {
  if (events.length === 0) return <p className="py-6 text-muted">No changes recorded yet.</p>;
  return (
    <ul className="divide-y divide-hairline">
      {events.map((event) => (
        <EventRow key={event.id} event={event} showVendor={showVendor} />
      ))}
    </ul>
  );
}
