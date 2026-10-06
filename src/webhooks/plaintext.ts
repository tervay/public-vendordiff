import type { Formatter } from ".";
import { eventDetail, eventLabel, eventName, eventUrl, groupTitle, packLines, plain, vendorHistoryUrl, vendorName } from "./message";

const LOCAL_HOST = /^(localhost|.+\.localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/i;

export const plaintext: Formatter = {
  contentType: "text/plain; charset=utf-8",
  urlHint: "Use an https URL with a domain name.",
  validUrl: (url) => url.protocol === "https:" && !LOCAL_HOST.test(url.hostname),
  event: (event) => `${eventLabel(event)}: ${vendorName(event)} ${eventName(event)}, ${eventDetail(event, plain)}\n${eventUrl(event)}`,
  group: (events) => {
    const lines = events.map((event) => `${eventLabel(event)}: ${eventName(event)}, ${eventDetail(event, plain)} ${eventUrl(event)}`);
    const { chunks, hidden } = packLines(lines, Infinity, 1);
    const more = hidden > 0 ? `\nand ${hidden} more: ${vendorHistoryUrl(events[0])}` : "";
    return `${groupTitle(events)}\n${chunks[0]}${more}`;
  },
  text: (text) => text,
};
