import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/lib/queries";
import { formatters, parseWebhookUrl } from ".";

const event = (overrides: Partial<FeedEvent> = {}): FeedEvent => ({
  id: 1,
  type: "price_change",
  occurredAt: new Date("2026-10-05T16:00:00Z"),
  oldPriceCents: 1000,
  oldTitle: null,
  priceCents: 1200,
  vendorSlug: "wcp",
  variantId: 7,
  variantTitle: "12T",
  sku: "WCP-0001",
  productTitle: "Gear <b> & Co",
  productId: 3,
  handle: "gear",
  imageUrl: "https://cdn.example.com/gear.png",
  ...overrides,
});

describe("slack", () => {
  it("builds escaped Block Kit with a link and the price change percent", () => {
    expect(JSON.parse(formatters.slack.event(event()))).toEqual({
      text: "💲 Price change: Gear &lt;b&gt; &amp; Co — 12T",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "💲 *Price change* · WCP\n*<https://vendordiff.com/v/wcp/3-gear/7|Gear &lt;b&gt; &amp; Co — 12T>* · ~$10.00~ → *$12.00* (+20%)",
          },
          accessory: { type: "image", image_url: "https://cdn.example.com/gear.png", alt_text: "Gear <b> & Co — 12T" },
        },
      ],
    });
  });

  it("shows a decimal for small price changes and leaves out a missing image", () => {
    const body = JSON.parse(formatters.slack.event(event({ oldPriceCents: 10000, priceCents: 9950, imageUrl: null })));
    expect(body.blocks[0].text.text).toContain("~$100.00~ → *$99.50* (-0.5%)");
    expect(body.blocks[0].accessory).toBeUndefined();
  });
});

describe("discord", () => {
  it("builds one embed and blocks mentions", () => {
    const body = JSON.parse(formatters.discord.event(event({ type: "restock", oldPriceCents: null, sku: null })));
    expect(body).toEqual({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          author: { name: "WCP" },
          title: "Gear <b> & Co — 12T",
          url: "https://vendordiff.com/v/wcp/3-gear/7",
          description: "✅ Restocked · $12.00",
          color: 0x22c55e,
          thumbnail: { url: "https://cdn.example.com/gear.png" },
        },
      ],
    });
  });

  it("leaves out a missing image", () => {
    expect(JSON.parse(formatters.discord.event(event({ imageUrl: null }))).embeds[0].thumbnail).toBeUndefined();
  });
});

describe("plaintext", () => {
  it("writes the old name for a rename", () => {
    expect(formatters.plaintext.event(event({ type: "rename", oldTitle: "Gear — 12 tooth" }))).toBe(
      "✏️ Renamed: WCP Gear <b> & Co — 12T, was Gear — 12 tooth\nhttps://vendordiff.com/v/wcp/3-gear/7",
    );
  });
});

describe("parseWebhookUrl", () => {
  it.each([
    ["slack", "https://hooks.slack.com/services/T0/B0/x", true],
    ["slack", "https://hooks.slack.com.evil.com/services/x", false],
    ["slack", "http://hooks.slack.com/services/x", false],
    ["discord", "https://discord.com/api/webhooks/1/x", true],
    ["discord", "https://discordapp.com/api/webhooks/1/x", true],
    ["discord", "https://discord.com/channels/1", false],
    ["plaintext", "https://ntfy.sh/my-topic", true],
    ["plaintext", "http://ntfy.sh/my-topic", false],
    ["plaintext", "https://localhost/hook", false],
    ["plaintext", "https://169.254.169.254/latest", false],
    ["plaintext", "https://[::1]/hook", false],
    ["plaintext", "not a url", false],
  ] as const)("%s %s → %s", (type, url, valid) => {
    expect(parseWebhookUrl(type, url) !== null).toBe(valid);
  });
});
