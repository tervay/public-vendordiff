import type { EventType } from "@/db/schema";
import type { Formatter } from ".";
import { eventDetail, eventLabel, eventName, eventUrl, groupTitle, packLines, rowDetail, vendorHistoryUrl, vendorName, type Markup, type Row } from "./message";

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

const DESCRIPTION_CHARS = 4096;
const MORE_LINE_CHARS = 200;
const GROUP_COLOR = 0x71717a;

const noMentions = { parse: [] };

const escapeLink = (text: string) => text.replace(/[[\]]/g, "\\$&");

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
          title: eventName(event),
          url: eventUrl(event),
          description: `${eventLabel(event)} · ${eventDetail(event, markup)}`,
          color: colors[event.type],
          thumbnail: event.imageUrl ? { url: event.imageUrl } : undefined,
          footer: event.sku ? { text: event.sku } : undefined,
        },
      ],
    }),
  group: (events) => {
    const line = (row: Row) => `${eventLabel(row.events[0])} · [${escapeLink(row.name)}](${row.url}) · ${rowDetail(row, markup)}`;
    const { chunks, hidden } = packLines(events, line, DESCRIPTION_CHARS - MORE_LINE_CHARS, 1);
    const more = hidden > 0 ? `\n[and ${hidden} more](${vendorHistoryUrl(events[0])})` : "";
    return JSON.stringify({
      allowed_mentions: noMentions,
      embeds: [{ title: groupTitle(events), url: vendorHistoryUrl(events[0]), description: `${chunks[0]}${more}`, color: GROUP_COLOR }],
    });
  },
  text: (content) => JSON.stringify({ allowed_mentions: noMentions, content }),
};
