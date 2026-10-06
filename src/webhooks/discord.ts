import type { EventType } from "@/db/schema";
import type { Formatter } from ".";
import { eventDetail, eventLabel, eventName, eventUrl, vendorName, type Markup } from "./message";

const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com"]);

const colors: Record<EventType, number> = {
  new: 0x0ea5e9,
  restock: 0x22c55e,
  out_of_stock: 0xef4444,
  backorder: 0xf97316,
  price_change: 0xf59e0b,
  removed: 0x71717a,
  rename: 0x8b5cf6,
};

const noMentions = { parse: [] };

const markup: Markup = { strike: (text) => `~~${text}~~`, bold: (text) => `**${text}**` };

export const discord: Formatter = {
  contentType: "application/json",
  urlHint: "Use a Discord webhook URL (https://discord.com/api/webhooks/…).",
  validUrl: (url) => url.protocol === "https:" && DISCORD_HOSTS.has(url.hostname) && url.pathname.startsWith("/api/webhooks/"),
  event: (event) =>
    JSON.stringify({
      allowed_mentions: noMentions,
      embeds: [
        {
          author: { name: vendorName(event) },
          title: eventName(event).slice(0, 256),
          url: eventUrl(event),
          description: `${eventLabel(event)} · ${eventDetail(event, markup)}`,
          color: colors[event.type],
          thumbnail: event.imageUrl ? { url: event.imageUrl } : undefined,
          footer: event.sku ? { text: event.sku } : undefined,
        },
      ],
    }),
  text: (content) => JSON.stringify({ allowed_mentions: noMentions, content }),
};
