import type { Metadata } from "next";
import { eventLabels } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { jsonV1 } from "@/webhooks/json";

export const metadata: Metadata = { title: "JSON webhooks" };

const sample: FeedEvent = {
  id: 1234,
  type: "price_change",
  occurredAt: new Date("2026-10-05T16:00:00Z"),
  oldPriceCents: 1000,
  oldTitle: null,
  priceCents: 1200,
  vendorSlug: "wcp",
  variantId: 7,
  variantTitle: "12T",
  sku: "WCP-0001",
  productTitle: "Gear",
  productId: 3,
  handle: "gear",
  imageUrl: "https://cdn.example.com/gear.png",
};

const pretty = (body: string) => JSON.stringify(JSON.parse(body), null, 2);

const v1Fields: [string, string][] = [
  ["version", "Always 1."],
  ["events", "The changes, oldest first. Empty when the body is a message."],
  ["message", "Only in plain messages, such as “and 1,200 more changes”."],
  ["events[].id", "Unique and increasing. Use it to drop duplicates."],
  ["events[].type", Object.keys(eventLabels).join(", ")],
  ["events[].occurred_at", "When the check found the change, in ISO 8601 UTC."],
  ["events[].url", "The variant’s page on VendorDiff."],
  ["events[].vendor", "slug and name."],
  ["events[].product", "id, title and image_url (can be null)."],
  ["events[].variant", "id, title (can be empty) and sku (can be null)."],
  ["events[].price_cents", "The price after the change, in US cents."],
  ["events[].old_price_cents", "The price before the change. Set only for price_change."],
  ["events[].old_title", "The full name before the change. Set only for rename."],
];

const codeClass = "font-mono text-sm";

export default function WebhookDocsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">JSON webhooks</h1>
      <ul className="list-disc space-y-1 pl-5">
        <li>Each hourly check sends one POST with every change that matches your vendors, change types and minimum price.</li>
        <li>A check with more than 1,000 changes sends them in several POSTs of up to 1,000 each.</li>
        <li>
          Bodies use <code className={codeClass}>content-type: application/json</code>.
        </li>
        <li>
          A change can arrive more than once, for example after a failed POST. Use <code className={codeClass}>id</code> to drop duplicates.
        </li>
        <li>Send test posts the newest real change.</li>
        <li>Your webhook keeps the schema version you picked. New versions never change the format of an existing webhook.</li>
      </ul>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Schema v1</h2>
        <pre className={`overflow-x-auto rounded-lg border border-hairline bg-surface p-4 ${codeClass}`}>{pretty(jsonV1.group([sample]))}</pre>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-hairline">
              {v1Fields.map(([field, description]) => (
                <tr key={field}>
                  <td className={`px-3 py-2 align-top whitespace-nowrap ${codeClass}`}>{field}</td>
                  <td className="px-3 py-2">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
