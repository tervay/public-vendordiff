import { eventLabels } from "@/lib/format";
import type { Formatter } from ".";
import { eventDetail, eventEmoji, eventLabel, eventName, eventUrl, vendorName, type Markup } from "./message";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const markup: Markup = { strike: (text) => `~${text}~`, bold: (text) => `*${text}*` };

export const slack: Formatter = {
  contentType: "application/json",
  urlHint: "Use a Slack incoming webhook URL (https://hooks.slack.com/services/…).",
  validUrl: (url) => url.origin === "https://hooks.slack.com" && url.pathname.startsWith("/services/"),
  event: (event) => {
    const name = escape(eventName(event));
    const heading = `${eventEmoji(event)} *${eventLabels[event.type]}* · ${escape(vendorName(event))}`;
    return JSON.stringify({
      text: `${eventLabel(event)}: ${name}`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `${heading}\n*<${eventUrl(event)}|${name}>* · ${escape(eventDetail(event, markup))}` },
          accessory: event.imageUrl ? { type: "image", image_url: event.imageUrl, alt_text: eventName(event) } : undefined,
        },
      ],
    });
  },
  text: (text) => JSON.stringify({ text: escape(text) }),
};
