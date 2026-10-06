"use server";

import { and, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isEventType } from "@/lib/format";
import { vendorBySlug } from "@/vendors";
import { formatterFor, formatters, isWebhookType, MAX_WEBHOOKS, parseWebhookUrl, postWebhook } from "@/webhooks";
import { latestEventId, newestEvent } from "@/webhooks/deliver";
import { isJsonVersion } from "@/webhooks/json";

export type FormValues = { type: string; url: string; jsonVersion: number | null; vendorSlugs: string[]; eventTypes: string[] };
export type FormState = { error?: string; message?: string; values?: FormValues } | null;

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session.user.id;
}

const owned = (userId: string, id: number) => and(eq(webhooks.userId, userId), eq(webhooks.id, id));

function parseForm(formData: FormData) {
  const submitted = {
    type: String(formData.get("type")),
    url: String(formData.get("url") ?? ""),
    jsonVersion: Number(formData.get("jsonVersion")) || null,
    vendorSlugs: formData.getAll("vendors").map(String),
    eventTypes: formData.getAll("types").map(String),
  };
  const invalid = (error: string) => ({ error, values: submitted });
  const { type } = submitted;
  if (!isWebhookType(type)) return invalid("Choose a webhook type.");
  const url = parseWebhookUrl(type, submitted.url);
  if (!url) return invalid(formatters[type].urlHint);
  const jsonVersion = type === "json" ? submitted.jsonVersion : null;
  if (type === "json" && !(jsonVersion && isJsonVersion(jsonVersion))) return invalid("Choose a schema version.");
  const vendorSlugs = submitted.vendorSlugs.filter((slug) => vendorBySlug(slug));
  if (vendorSlugs.length === 0) return invalid("Choose at least one vendor.");
  const eventTypes = submitted.eventTypes.filter(isEventType);
  if (eventTypes.length === 0) return invalid("Choose at least one change type.");
  return { values: { type, url, jsonVersion, vendorSlugs, eventTypes } };
}

export async function createWebhook(_: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseForm(formData);
  if ("error" in parsed) return parsed;
  const [existing] = await db.select({ count: count() }).from(webhooks).where(eq(webhooks.userId, userId));
  if (existing.count >= MAX_WEBHOOKS) return { error: `You can have up to ${MAX_WEBHOOKS} webhooks.` };
  await db.insert(webhooks).values({ ...parsed.values, userId, lastEventId: await latestEventId() });
  refresh();
  return null;
}

export async function updateWebhook(id: number, _: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseForm(formData);
  if ("error" in parsed) return parsed;
  await db.update(webhooks).set(parsed.values).where(owned(userId, id));
  refresh();
  return { message: "Saved." };
}

export async function deleteWebhook(id: number) {
  const userId = await requireUserId();
  await db.delete(webhooks).where(owned(userId, id));
  refresh();
}

export async function setWebhookEnabled(id: number, enabled: boolean) {
  const userId = await requireUserId();
  const reset = enabled && { lastEventId: await latestEventId(), failureCount: 0, lastError: null };
  await db
    .update(webhooks)
    .set({ enabled, ...reset })
    .where(owned(userId, id));
  refresh();
}

export async function testWebhook(id: number): Promise<FormState> {
  const userId = await requireUserId();
  const [webhook] = await db.select().from(webhooks).where(owned(userId, id));
  if (!webhook) return { error: "Webhook not found." };
  const latest = await newestEvent();
  const formatter = formatterFor(webhook);
  try {
    await postWebhook(webhook, latest ? formatter.event(latest) : formatter.text("Test message from VendorDiff."));
    return { message: "Test sent." };
  } catch (e) {
    return { error: String(e) };
  }
}
