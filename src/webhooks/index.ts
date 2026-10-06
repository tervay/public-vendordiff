import { fetchWithRetry } from "@/adapters/http";
import type { WebhookType } from "@/db/schema";
import type { FeedEvent } from "@/lib/queries";
import { discord } from "./discord";
import { plaintext } from "./plaintext";
import { slack } from "./slack";

export const MAX_WEBHOOKS = 3;

export type Formatter = {
  contentType: string;
  urlHint: string;
  validUrl: (url: URL) => boolean;
  event: (event: FeedEvent) => string;
  group: (events: FeedEvent[]) => string;
  text: (text: string) => string;
};

export const formatters: Record<WebhookType, Formatter> = { slack, discord, plaintext };

export const isWebhookType = (value: unknown): value is WebhookType => typeof value === "string" && Object.hasOwn(formatters, value);

export function parseWebhookUrl(type: WebhookType, raw: string) {
  const url = URL.parse(raw.trim());
  return url && formatters[type].validUrl(url) ? url.href : null;
}

export const postWebhook = (webhook: { type: WebhookType; url: string }, body: string) =>
  fetchWithRetry(
    webhook.url,
    { method: "POST", headers: { "content-type": formatters[webhook.type].contentType }, body, redirect: "error" },
    `${webhook.type} webhook`,
  );
