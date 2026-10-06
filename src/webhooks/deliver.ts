import { and, desc, eq, gt, max } from "drizzle-orm";
import { sleep } from "@/adapters/http";
import { db } from "@/db";
import { events, products, runs, variants, webhooks } from "@/db/schema";
import { feedColumns, type FeedEvent } from "@/lib/queries";
import { formatters, postWebhook, type Formatter } from ".";
import { SITE_URL } from "./message";

const MAX_POSTS = 20;
const GROUP_MIN = 3;
const DISABLE_AFTER_FAILURES = 24;
const DEADLINE_MS = 90_000;

type Webhook = typeof webhooks.$inferSelect;

export async function latestEventId() {
  const [row] = await db.select({ id: max(events.id) }).from(events);
  return row.id ?? 0;
}

const feedEvents = () =>
  db
    .select(feedColumns)
    .from(events)
    .innerJoin(runs, eq(runs.id, events.runId))
    .innerJoin(variants, eq(variants.id, events.variantId))
    .innerJoin(products, eq(products.id, variants.productId));

const eventsAfter = (id: number) =>
  feedEvents()
    .where(and(gt(events.id, id), eq(runs.baseline, false)))
    .orderBy(events.id);

export async function newestEvent() {
  const [event] = await feedEvents().where(eq(runs.baseline, false)).orderBy(desc(events.id)).limit(1);
  return event;
}

export async function deliverWebhooks({ pauseMs = 1000 } = {}) {
  const enabled = await db.select().from(webhooks).where(eq(webhooks.enabled, true));
  if (enabled.length === 0) return { sent: 0, failed: 0 };
  const pending = await eventsAfter(Math.min(...enabled.map((webhook) => webhook.lastEventId)));
  const deadline = Date.now() + DEADLINE_MS;
  const results = await Promise.all(enabled.map((webhook) => deliver(webhook, pending, pauseMs, deadline)));
  return { sent: results.reduce((total, result) => total + result.sent, 0), failed: results.filter((result) => result.error).length };
}

function buildMessages(formatter: Formatter, events: FeedEvent[]) {
  const messages = [...Map.groupBy(events, (event) => event.vendorSlug).values()].flatMap((group) =>
    group.length >= GROUP_MIN
      ? [{ firstId: group[0].id, count: group.length, body: formatter.group(group) }]
      : group.map((event) => ({ firstId: event.id, count: 1, body: formatter.event(event) })),
  );
  return messages.sort((a, b) => a.firstId - b.firstId);
}

async function deliver(webhook: Webhook, pending: FeedEvent[], pauseMs: number, deadline: number) {
  const newer = pending.filter((event) => event.id > webhook.lastEventId);
  if (newer.length === 0) return { sent: 0, error: null };
  const lastId = newer.at(-1)!.id;
  const matching = newer.filter((event) => webhook.vendorSlugs.includes(event.vendorSlug) && webhook.eventTypes.includes(event.type));
  const all = buildMessages(formatters[webhook.type], matching);
  const messages = all.slice(0, MAX_POSTS);
  const skipped = all.slice(MAX_POSTS);
  if (skipped.length > 0) {
    const count = skipped.reduce((total, message) => total + message.count, 0);
    messages.push({ firstId: skipped[0].firstId, count, body: formatters[webhook.type].text(`and ${count} more changes: ${SITE_URL}/history`) });
  }

  let cursor = messages.length > 0 ? messages[0].firstId - 1 : lastId;
  let sent = 0;
  let error: string | null = null;
  for (const [i, message] of messages.entries()) {
    if (Date.now() > deadline) break;
    if (sent > 0) await sleep(pauseMs);
    try {
      await postWebhook(webhook, message.body);
    } catch (e) {
      error = String(e);
      break;
    }
    cursor = i + 1 < messages.length ? messages[i + 1].firstId - 1 : lastId;
    sent++;
  }

  const failureCount = error ? webhook.failureCount + 1 : 0;
  await db
    .update(webhooks)
    .set({
      lastEventId: cursor,
      failureCount,
      lastError: error,
      ...(sent > 0 && { lastDeliveredAt: new Date() }),
      ...(failureCount >= DISABLE_AFTER_FAILURES && { enabled: false }),
    })
    .where(eq(webhooks.id, webhook.id));
  return { sent, error };
}
