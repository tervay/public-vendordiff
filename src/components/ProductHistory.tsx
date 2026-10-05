import Link from "next/link";
import { formatDate, formatPrice, stockLabels } from "@/lib/format";
import type { ProductData } from "@/lib/queries";
import { EventBadge, PriceText, stockColors } from "./events";
import { HistoryCharts, type HistoryPoint } from "./HistoryCharts";

type Variant = ProductData["variants"][number];

const toPoints = (history: ProductData["history"], variant: Variant, asOf: Date) => {
  const byTime = new Map<number, HistoryPoint>();
  for (const event of history) {
    const t = new Date(event.occurredAt).getTime();
    byTime.set(t, { t, priceCents: event.priceCents, stock: event.stock });
  }
  const now = new Date(asOf).getTime();
  byTime.set(now, { t: now, priceCents: variant.priceCents, stock: variant.removedAt ? "out_of_stock" : variant.stock });
  return [...byTime.values()];
};

export function StockLabel({ variant }: { variant: Variant }) {
  if (variant.removedAt) return <span className="text-subtle">Removed</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${stockColors[variant.stock]}`} />
      {stockLabels[variant.stock]}
    </span>
  );
}

export function VariantPrice({ variant }: { variant: Variant }) {
  const onSale = variant.compareAtCents !== null && variant.compareAtCents > variant.priceCents;
  return (
    <>
      {onSale && <span className="mr-1 text-subtle line-through">{formatPrice(variant.compareAtCents!)}</span>}
      {formatPrice(variant.priceCents)}
    </>
  );
}

export function VariantTable({ variants, selectedId, basePath }: { variants: Variant[]; selectedId: number; basePath: string }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-left text-subtle">
          <tr>
            <th className="px-3 py-2 font-medium">Variant</th>
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {variants.map((variant) => (
            <tr key={variant.id} className={variant.id === selectedId ? "bg-hairline/60" : undefined}>
              <td className="px-3 py-2">
                <Link href={`${basePath}/${variant.id}`} prefetch={false} className="hover:underline">
                  {variant.title || "Default"}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted">{variant.sku}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <VariantPrice variant={variant} />
              </td>
              <td className="px-3 py-2">
                <StockLabel variant={variant} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VariantHistory({ variant, history, asOf, title }: { variant: Variant; history: ProductData["history"]; asOf: Date; title?: string }) {
  const variantHistory = history.filter((event) => event.variantId === variant.id);

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{title ? `History: ${title}` : "History"}</h2>
        <HistoryCharts points={toPoints(variantHistory, variant, asOf)} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Changes</h3>
        <ol className="divide-y divide-hairline text-sm">
          {variantHistory.toReversed().map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 py-2">
              <span className="shrink-0 text-muted">{formatDate(new Date(event.occurredAt))}</span>
              <span className="flex min-w-0 items-center gap-3 tabular-nums">
                {event.type === "rename" ? <span className="truncate text-muted">was {event.oldTitle}</span> : <PriceText {...event} />}
                <EventBadge type={event.type} />
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
