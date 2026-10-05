import Link from "next/link";
import { EventFeed } from "@/components/EventFeed";
import { VendorStatus } from "@/components/VendorStatus";
import { getEvents, getLatestRuns } from "@/lib/queries";
import { vendors } from "@/vendors";

export default function Home() {
  return (
    <div className="space-y-10">
      <VendorGrid />
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Latest changes</h1>
          <Link href="/history" className="text-sm text-muted hover:underline">
            Full history →
          </Link>
        </div>
        <RecentEvents />
      </section>
    </div>
  );
}

async function VendorGrid() {
  const latestRuns = await getLatestRuns();
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {vendors.map((vendor) => (
        <Link key={vendor.slug} href={`/v/${vendor.slug}`} className="rounded-lg border border-hairline bg-surface p-3 hover:border-subtle">
          <div className="font-medium">{vendor.name}</div>
          <VendorStatus run={latestRuns.find((run) => run.vendorSlug === vendor.slug)} />
        </Link>
      ))}
    </section>
  );
}

async function RecentEvents() {
  return <EventFeed events={await getEvents({})} showVendor />;
}
