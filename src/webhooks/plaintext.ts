import type { Formatter } from ".";
import { eventDetail, eventLabel, eventName, eventUrl, vendorName } from "./message";

const LOCAL_HOST = /^(localhost|.+\.localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/i;

export const plaintext: Formatter = {
  contentType: "text/plain; charset=utf-8",
  urlHint: "Use an https URL with a domain name.",
  validUrl: (url) => url.protocol === "https:" && !LOCAL_HOST.test(url.hostname),
  event: (event) => `${eventLabel(event)}: ${vendorName(event)} ${eventName(event)}, ${eventDetail(event, (price) => price)}\n${eventUrl(event)}`,
  text: (text) => text,
};
