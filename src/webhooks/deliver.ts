import { and, desc, eq, gt, max } from "drizzle-orm";
import { sleep } from "@/adapters/http";
import { db } from "@/db";
import { events, products, runs, variants, webhooks } from "@/db/schema";
import { feedColumns, type FeedEvent } from "@/lib/queries";
import { formatters, postWebhook } from ".";
import { SITE_URL } from "./message";

const MAX_POSTS = 20;
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

async function deliver(webhook: Webhook, pending: FeedEvent[], pauseMs: number, deadline: number) {
  const newer = pending.filter((event) => event.id > webhook.lastEventId);
  if (newer.length === 0) return { sent: 0, error: null };
  const lastId = newer.at(-1)!.id;
  const matching = newer.filter((event) => webhook.vendorSlugs.includes(event.vendorSlug) && webhook.eventTypes.includes(event.type));
  const formatter = formatters[webhook.type];
  const messages = matching.slice(0, MAX_POSTS).map((event) => ({ cursor: event.id, body: formatter.event(event) }));
  if (matching.length > MAX_POSTS) {
    messages.push({ cursor: lastId, body: formatter.text(`and ${matching.length - MAX_POSTS} more changes: ${SITE_URL}/history`) });
  }

  let cursor = webhook.lastEventId;
  let sent = 0;
  let error: string | null = null;
  for (const message of messages) {
    if (Date.now() > deadline) break;
    if (sent > 0) await sleep(pauseMs);
    try {
      await postWebhook(webhook, message.body);
    } catch (e) {
      error = String(e);
      break;
    }
    cursor = message.cursor;
    sent++;
  }
  if (sent === messages.length) cursor = lastId;

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
