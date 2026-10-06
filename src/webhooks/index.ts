import { fetchWithRetry } from "@/adapters/http";
import type { WebhookType } from "@/db/schema";
import type { FeedEvent } from "@/lib/queries";
import { discord } from "./discord";
import { jsonVersions, LATEST_JSON_VERSION } from "./json";
import { plaintext } from "./plaintext";
import { slack } from "./slack";

export const MAX_WEBHOOKS = 3;

export type Formatter = {
  contentType: string;
  urlHint: string;
  validUrl: (url: URL) => boolean;
  batchSize?: number;
  event: (event: FeedEvent) => string;
  group: (events: FeedEvent[]) => string;
  text: (text: string) => string;
};

export const formatters: Record<WebhookType, Formatter> = { slack, discord, plaintext, json: jsonVersions[LATEST_JSON_VERSION] };

type WebhookFormat = { type: WebhookType; jsonVersion: number | null };

export const formatterFor = ({ type, jsonVersion }: WebhookFormat) =>
  type === "json" && jsonVersion !== null ? jsonVersions[jsonVersion] : formatters[type];

export const isWebhookType = (value: unknown): value is WebhookType => typeof value === "string" && Object.hasOwn(formatters, value);

export function parseWebhookUrl(type: WebhookType, raw: string) {
  const url = URL.parse(raw.trim());
  return url && formatters[type].validUrl(url) ? url.href : null;
}

export const postWebhook = (webhook: WebhookFormat & { url: string }, body: string) =>
  fetchWithRetry(
    webhook.url,
    { method: "POST", headers: { "content-type": formatterFor(webhook).contentType }, body, redirect: "error" },
    `${webhook.type} webhook`,
  );
