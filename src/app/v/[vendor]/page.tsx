import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventFeed } from "@/components/EventFeed";
import { VendorStatus } from "@/components/VendorStatus";
import { getEvents, getLatestRuns } from "@/lib/queries";
import { vendorBySlug, vendors } from "@/vendors";

export function generateStaticParams() {
  return vendors.map((vendor) => ({ vendor: vendor.slug }));
}

export default function VendorPage({ params }: PageProps<"/v/[vendor]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <VendorView params={params} />
    </Suspense>
  );
}

async function VendorView({ params }: Pick<PageProps<"/v/[vendor]">, "params">) {
  const vendor = vendorBySlug((await params).vendor);
  if (!vendor) notFound();
  const [events, latestRuns] = await Promise.all([getEvents({ vendor: vendor.slug }), getLatestRuns()]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{vendor.name}</h1>
        <VendorStatus run={latestRuns.find((run) => run.vendorSlug === vendor.slug)} />
      </header>
      <Form action="/search" className="flex gap-2">
        <input type="hidden" name="vendor" value={vendor.slug} />
        <input
          name="q"
          placeholder={`Search ${vendor.name} products or SKUs`}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-background">
          Search
        </button>
      </Form>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Latest changes</h2>
          <Link href={`/history?vendor=${vendor.slug}`} className="text-sm text-muted hover:underline">
            Full history →
          </Link>
        </div>
        <EventFeed events={events} showVendor={false} />
      </section>
    </div>
  );
}
