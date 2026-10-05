import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { chipClass, EventList, feedFilters } from "@/components/events";
import { eventLabels, isEventType } from "@/lib/format";
import { FEED_LIMIT, getEvents } from "@/lib/queries";
import { vendorBySlug, vendors } from "@/vendors";

export const metadata: Metadata = { title: "History" };

type Query = { vendor?: string; type?: string; before?: number };

const historyHref = (query: Query) => {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return params.size > 0 ? `/history?${params}` : "/history";
};

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <HistoryView searchParams={searchParams} />
    </Suspense>
  );
}

async function HistoryView({ searchParams }: Pick<PageProps<"/history">, "searchParams">) {
  const params = await searchParams;
  const vendor = typeof params.vendor === "string" ? vendorBySlug(params.vendor) : undefined;
  const type = isEventType(params.type) ? params.type : undefined;
  const before = Number(params.before) || undefined;
  const events = await getEvents({ vendor: vendor?.slug, type, before, renames: true });
  const last = events.at(-1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{vendor ? `${vendor.name} history` : "History"}</h1>
      <div className="flex flex-wrap gap-2">
        {[undefined, ...vendors].map((v) => (
          <Link key={v?.slug ?? "all"} href={historyHref({ vendor: v?.slug, type })} className={chipClass(v === vendor)}>
            {v?.name ?? "All vendors"}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[...feedFilters, "rename" as const].map((filter) => (
          <Link key={filter ?? "all"} href={historyHref({ vendor: vendor?.slug, type: filter ?? undefined })} className={chipClass((filter ?? undefined) === type)}>
            {filter ? eventLabels[filter] : "All changes"}
          </Link>
        ))}
      </div>
      <EventList events={events} showVendor={!vendor} />
      <nav className="flex justify-between text-sm">
        {before ? <Link href={historyHref({ vendor: vendor?.slug, type })}>← Newest</Link> : <span />}
        {last && events.length === FEED_LIMIT && <Link href={historyHref({ vendor: vendor?.slug, type, before: last.id })}>Older →</Link>}
      </nav>
    </div>
  );
}
