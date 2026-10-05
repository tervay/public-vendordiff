"use client";

import { useState } from "react";
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

function StockLabel({ variant }: { variant: Variant }) {
  if (variant.removedAt) return <span className="text-subtle">Removed</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${stockColors[variant.stock]}`} />
      {stockLabels[variant.stock]}
    </span>
  );
}

function VariantPrice({ variant }: { variant: Variant }) {
  const onSale = variant.compareAtCents !== null && variant.compareAtCents > variant.priceCents;
  return (
    <>
      {onSale && <span className="mr-1 text-subtle line-through">{formatPrice(variant.compareAtCents!)}</span>}
      {formatPrice(variant.priceCents)}
    </>
  );
}

export function ProductHistory({ variants, history, asOf }: Omit<ProductData, "product">) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((v) => v.id === selectedId);
  if (!selected) return <p className="text-muted">This product has no variants listed.</p>;
  const variantHistory = history.filter((event) => event.variantId === selected.id);

  return (
    <div className="space-y-10">
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
              <tr key={variant.id} className={variant.id === selected.id ? "bg-hairline/60" : undefined}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setSelectedId(variant.id)} className="text-left hover:underline">
                    {variant.title || "Default"}
                  </button>
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{selected.title ? `History: ${selected.title}` : "History"}</h2>
        <HistoryCharts points={toPoints(variantHistory, selected, asOf)} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Changes</h3>
        <ol className="divide-y divide-hairline text-sm">
          {variantHistory.toReversed().map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-muted">{formatDate(new Date(event.occurredAt))}</span>
              <span className="flex items-center gap-3 tabular-nums">
                <PriceText {...event} />
                <EventBadge type={event.type} />
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
