"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatPrice, formatShortDate } from "@/lib/format";

export type HistoryPoint = { t: number; priceCents: number; inStock: boolean };

const axisTick = { fill: "var(--subtle)", fontSize: 12 };
const priceDomain: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor((min * 0.9) / 100) * 100,
  (max) => Math.ceil((max * 1.1) / 100) * 100,
];

export function HistoryCharts({ points }: { points: HistoryPoint[] }) {
  const segments = points.slice(0, -1).map((point, i) => ({ start: point.t, end: points[i + 1].t, inStock: point.inStock }));
  return (
    <div className="space-y-6">
      <figure>
        <figcaption className="mb-2 text-sm font-medium">Price</figcaption>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatShortDate}
              tick={axisTick}
              stroke="var(--hairline)"
              tickLine={false}
            />
            <YAxis tickFormatter={formatPrice} tick={axisTick} width={72} domain={priceDomain} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [formatPrice(Number(value)), "Price"]}
              labelFormatter={(t) => formatDate(Number(t))}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}
              itemStyle={{ color: "var(--foreground)" }}
              labelStyle={{ color: "var(--muted)" }}
              cursor={{ stroke: "var(--subtle)" }}
            />
            <Line dataKey="priceCents" type="stepAfter" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </figure>
      <figure>
        <figcaption className="mb-2 flex items-center gap-4 text-sm">
          <span className="font-medium">Stock</span>
          <span className="flex items-center gap-1 text-muted">
            <span className="size-2.5 rounded-sm bg-good" /> In stock
          </span>
          <span className="flex items-center gap-1 text-muted">
            <span className="size-2.5 rounded-sm bg-critical" /> Out of stock
          </span>
        </figcaption>
        <div className="flex h-6 gap-0.5">
          {segments.map((segment) => (
            <div
              key={segment.start}
              title={`${segment.inStock ? "In stock" : "Out of stock"}: ${formatDate(segment.start)} – ${formatDate(segment.end)}`}
              style={{ flexGrow: segment.end - segment.start }}
              className={`min-w-0.5 basis-0 rounded-sm ${segment.inStock ? "bg-good" : "bg-critical"}`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-subtle tabular-nums">
          <span>{formatShortDate(points[0].t)}</span>
          <span>{formatShortDate(points[points.length - 1].t)}</span>
        </div>
      </figure>
    </div>
  );
}
