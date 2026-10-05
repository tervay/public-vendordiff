import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { EventBadge, VendorBadge } from "@/components/events";
import { TestButton, WebhookForm } from "@/components/WebhookForm";
import { formatDate, webhookTypeLabels } from "@/lib/format";
import { createWebhook, deleteWebhook, setWebhookEnabled, testWebhook, updateWebhook } from "@/lib/webhook-actions";
import { vendors } from "@/vendors";
import { MAX_WEBHOOKS } from "@/webhooks";

type Webhook = typeof webhooks.$inferSelect;

const buttonClass = "text-sm text-muted hover:text-foreground";

const shortUrl = (url: string) => `${new URL(url).host}/…${url.slice(-4)}`;

function WebhookStatus({ webhook }: { webhook: Webhook }) {
  if (!webhook.enabled) {
    return <p className="text-sm text-muted">{webhook.lastError ? `Turned off after repeated failures: ${webhook.lastError}` : "Off"}</p>;
  }
  if (webhook.lastError) return <p className="text-sm text-critical">Last delivery failed: {webhook.lastError}</p>;
  if (webhook.lastDeliveredAt) return <p className="text-sm text-muted">Last sent {formatDate(webhook.lastDeliveredAt)}</p>;
  return <p className="text-sm text-muted">Nothing sent yet</p>;
}

function WebhookCard({ webhook }: { webhook: Webhook }) {
  const allVendors = webhook.vendorSlugs.length === vendors.length;
  return (
    <li className="space-y-3 rounded-lg border border-hairline p-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate">
          <span className="font-medium">{webhookTypeLabels[webhook.type]}</span> <span className="text-sm text-muted">{shortUrl(webhook.url)}</span>
        </p>
        <WebhookStatus webhook={webhook} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allVendors ? (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-xs">All vendors</span>
        ) : (
          webhook.vendorSlugs.map((slug) => <VendorBadge key={slug} slug={slug} />)
        )}
        {webhook.eventTypes.map((type) => (
          <EventBadge key={type} type={type} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <TestButton action={testWebhook.bind(null, webhook.id)} />
        <form action={setWebhookEnabled.bind(null, webhook.id, !webhook.enabled)}>
          <button className={buttonClass}>{webhook.enabled ? "Turn off" : "Turn on"}</button>
        </form>
        <form action={deleteWebhook.bind(null, webhook.id)}>
          <button className={buttonClass}>Delete</button>
        </form>
      </div>
      <details>
        <summary className={`cursor-pointer ${buttonClass}`}>Edit</summary>
        <div className="pt-4">
          <WebhookForm action={updateWebhook.bind(null, webhook.id)} webhook={webhook} submitLabel="Save" />
        </div>
      </details>
    </li>
  );
}

export async function WebhookList({ userId }: { userId: string }) {
  const rows = await db.select().from(webhooks).where(eq(webhooks.userId, userId)).orderBy(webhooks.id);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Webhooks</h2>
        <p className="text-sm text-muted">Get a message in Slack, Discord or any URL when a change you pick happens. You can have up to {MAX_WEBHOOKS}.</p>
      </div>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} />
          ))}
        </ul>
      )}
      {rows.length < MAX_WEBHOOKS && (
        <div className="space-y-4 rounded-lg border border-hairline p-4">
          <h3 className="font-medium">Add a webhook</h3>
          <WebhookForm action={createWebhook} submitLabel="Add webhook" />
        </div>
      )}
    </section>
  );
}
