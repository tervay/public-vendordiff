"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { EventType, WebhookType } from "@/db/schema";
import { eventLabels, webhookTypeLabels } from "@/lib/format";
import type { FormState, FormValues } from "@/lib/webhook-actions";
import { vendors } from "@/vendors";
import { jsonVersions, LATEST_JSON_VERSION } from "@/webhooks/json";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const defaults: FormValues ={ type: "discord", url: "", jsonVersion: null, vendorSlugs: vendors.map((v) => v.slug), eventTypes: ["new", "restock"] };

const webhookTypes = Object.keys(webhookTypeLabels) as WebhookType[];
const eventTypes = Object.keys(eventLabels) as EventType[];
const versions = Object.keys(jsonVersions).map(Number);

const fieldClass = "rounded-lg border border-hairline bg-surface px-3 py-2";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm text-critical">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-muted">{state.message}</p>;
  return null;
}

export function WebhookForm({ action, webhook: saved = defaults, submitLabel }: { action: Action; webhook?: FormValues; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const webhook = state?.values ?? saved;
  const [type, setType] = useState(webhook.type);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select name="type" defaultValue={webhook.type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
          {webhookTypes.map((type) => (
            <option key={type} value={type}>
              {webhookTypeLabels[type]}
            </option>
          ))}
        </select>
        {type === "json" && (
          <select name="jsonVersion" defaultValue={webhook.jsonVersion ?? LATEST_JSON_VERSION} className={fieldClass}>
            {versions.map((version) => (
              <option key={version} value={version}>
                Schema v{version}
              </option>
            ))}
          </select>
        )}
        <input name="url" type="url" required placeholder="Webhook URL" defaultValue={webhook.url} className={`min-w-0 flex-1 ${fieldClass}`} />
      </div>
      {type === "json" && (
        <p className="text-sm text-muted">
          Each hourly check sends one POST with every matching change.{" "}
          <Link href="/docs/webhooks" className="underline hover:text-foreground">
            See the schema
          </Link>
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Vendors</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {vendors.map((vendor) => (
            <label key={vendor.slug} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="vendors" value={vendor.slug} defaultChecked={webhook.vendorSlugs.includes(vendor.slug)} />
              {vendor.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Changes</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {eventTypes.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="types" value={type} defaultChecked={webhook.eventTypes.includes(type)} />
              {eventLabels[type]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-foreground px-4 py-2 text-background disabled:opacity-50">
          {submitLabel}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function TestButton({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button disabled={pending} className="text-sm text-muted hover:text-foreground disabled:opacity-50">
        {pending ? "Sending…" : "Send test"}
      </button>
      <Status state={state} />
    </form>
  );
}
