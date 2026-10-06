import type { Formatter } from ".";
import { eventDetail, eventLabel, eventName, eventUrl, vendorName } from "./message";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const slack: Formatter = {
  contentType: "application/json",
  urlHint: "Use a Slack incoming webhook URL (https://hooks.slack.com/services/…).",
  validUrl: (url) => url.origin === "https://hooks.slack.com" && url.pathname.startsWith("/services/"),
  event: (event) => {
    const name = escape(eventName(event));
    const detail = escape(eventDetail(event, (price) => `~${price}~`));
    const context = [vendorName(event), event.sku].filter(Boolean).join(" · ");
    return JSON.stringify({
      text: `${eventLabel(event)}: ${name}`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*<${eventUrl(event)}|${name}>*\n${eventLabel(event)} · ${detail}` },
          accessory: event.imageUrl ? { type: "image", image_url: event.imageUrl, alt_text: eventName(event) } : undefined,
        },
        { type: "context", elements: [{ type: "mrkdwn", text: escape(context) }] },
      ],
    });
  },
  text: (text) => JSON.stringify({ text: escape(text) }),
};
