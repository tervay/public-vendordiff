import { eventLabels } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import type { Formatter } from ".";
import { eventDetail, eventEmoji, eventLabel, eventName, eventUrl, groupTitle, packLines, vendorHistoryUrl, vendorName, type Markup } from "./message";

const MAX_BLOCKS = 50;
const SECTION_CHARS = 3000;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const markup: Markup = { strike: (text) => `~${text}~`, bold: (text) => `*${text}*` };

const link = (event: FeedEvent) => `*<${eventUrl(event)}|${escape(eventName(event))}>*`;

const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });

export const slack: Formatter = {
  contentType: "application/json",
  urlHint: "Use a Slack incoming webhook URL (https://hooks.slack.com/services/…).",
  validUrl: (url) => url.origin === "https://hooks.slack.com" && url.pathname.startsWith("/services/"),
  event: (event) => {
    const heading = `${eventEmoji(event)} *${eventLabels[event.type]}* · ${escape(vendorName(event))}`;
    return JSON.stringify({
      text: escape(`${eventLabel(event)}: ${eventName(event)}`),
      blocks: [
        {
          ...section(`${heading}\n${link(event)} · ${escape(eventDetail(event, markup))}`),
          accessory: event.imageUrl ? { type: "image", image_url: event.imageUrl, alt_text: eventName(event) } : undefined,
        },
      ],
    });
  },
  group: (events) => {
    const title = escape(groupTitle(events));
    const lines = events.map((event) => `${eventLabel(event)} · ${link(event)} · ${escape(eventDetail(event, markup))}`);
    const { chunks, hidden } = packLines(lines, SECTION_CHARS, MAX_BLOCKS - 2);
    const more = hidden > 0 ? [section(`and ${hidden} more · <${vendorHistoryUrl(events[0])}|see all on vendordiff>`)] : [];
    return JSON.stringify({ text: title, blocks: [section(`*${title}*`), ...chunks.map(section), ...more] });
  },
  text: (text) => JSON.stringify({ text: escape(text) }),
};
