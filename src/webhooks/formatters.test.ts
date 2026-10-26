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

describe("json v1", () => {
  it("builds a versioned body with nested snake_case fields", () => {
    expect(JSON.parse(formatters.json.event(event({ sku: null, imageUrl: null })))).toEqual({
      version: 1,
      events: [
        {
          id: 1,
          type: "price_change",
          occurred_at: "2026-10-05T16:00:00.000Z",
          url: "https://vendordiff.com/v/wcp/3-gear/7",
          vendor: { slug: "wcp", name: "WCP" },
          product: { id: 3, title: "Gear <b> & Co", image_url: null },
          variant: { id: 7, title: "12T", sku: null },
          price_cents: 1200,
          old_price_cents: 1000,
          old_title: null,
        },
      ],
    });
  });

  it("sends plain messages with no events", () => {
    expect(JSON.parse(formatters.json.text("hello"))).toEqual({ version: 1, events: [], message: "hello" });
  });
});

describe("group", () => {
  const longEvents = Array.from({ length: 40 }, (_, i) =>
    event({ id: i, variantId: i, productId: i, productTitle: `${i}${"X".repeat(500)}`, variantTitle: "Y".repeat(500), handle: "h".repeat(200) }),
  );

  it("keeps Slack under 50 blocks and 3000 characters per section", () => {
    const { blocks } = JSON.parse(formatters.slack.group(longEvents));
    expect(blocks.length).toBeLessThanOrEqual(50);
    for (const block of blocks) expect(block.text.text.length).toBeLessThanOrEqual(3000);
    expect(blocks[0].text.text).toBe("*WCP: 40 changes*");
    expect(blocks.at(-1).text.text).toBe("and 25 more · <https://vendordiff.com/history?vendor=wcp|see all on vendordiff>");
  });

  it("keeps Discord under 4096 characters in the description and 6000 in total", () => {
    const [embed] = JSON.parse(formatters.discord.group(longEvents)).embeds;
    expect(embed.description.length).toBeLessThanOrEqual(4096);
    expect(embed.title.length + embed.description.length).toBeLessThanOrEqual(6000);
    expect(embed.description).toMatch(/\[and \d+ more\]\(https:\/\/vendordiff\.com\/history\?vendor=wcp\)$/);
  });

  const swerve = (id: number, productId: number, priceCents: number, vendorSlug = "andymark") =>
    event({ id, variantId: id, productId, priceCents, vendorSlug, type: "removed", productTitle: `SDS MK4 - Gear Ratio:L${productId}`, handle: "mk4" });

  it("combines changes of one type to one product into one line", () => {
    const events = [swerve(1, 3, 28390, "wcp"), swerve(2, 3, 43350, "wcp"), event({ id: 3 })];
    expect(formatters.plaintext.group(events).split("\n")).toEqual([
      "WCP: 3 changes",
      "🗑️ Removed: SDS MK4 - Gear Ratio:L3, 2 variants · $283.90–$433.50 https://vendordiff.com/v/wcp/3-mk4",
      "💲 Price change: Gear <b> & Co — 12T, $10.00 → $12.00 (+20%) https://vendordiff.com/v/wcp/3-gear/7",
    ]);
  });

  it("combines AndyMark products that share a base title", () => {
    const events = [swerve(1, 3, 28390), swerve(2, 3, 43350), swerve(3, 4, 44200)];
    expect(formatters.plaintext.group(events).split("\n")[1]).toBe(
      "🗑️ Removed: SDS MK4, 3 variants in 2 products · $283.90–$442.00 https://vendordiff.com/search?vendor=andymark&q=SDS+MK4",
    );
  });

  it("keeps products with a shared base title apart at other vendors", () => {
    const events = [swerve(1, 3, 28390, "wcp"), swerve(2, 3, 43350, "wcp"), swerve(3, 4, 44200, "wcp")];
    expect(formatters.plaintext.group(events).split("\n")).toHaveLength(3);
  });

  it("shows price and percent ranges for combined price changes", () => {
    const events = [event({ id: 1 }), event({ id: 2, oldPriceCents: 2000, priceCents: 2200 }), event({ id: 3, oldPriceCents: 1000, priceCents: 1500 })];
    expect(JSON.parse(formatters.slack.group(events)).blocks[1].text.text).toBe(
      "💲 Price change · *<https://vendordiff.com/v/wcp/3-gear|Gear &lt;b&gt; &amp; Co>* · 3 variants · *$12.00–$22.00* (+10% to +50%)",
    );
  });

  it("counts hidden changes, not lines", () => {
    const events = [...Array.from({ length: 15 }, (_, i) => event({ id: i, productId: i, productTitle: `P${i}` })), swerve(15, 99, 100, "wcp"), swerve(16, 99, 100, "wcp")];
    expect(formatters.plaintext.group(events).split("\n").at(-1)).toBe("and 2 more: https://vendordiff.com/history?vendor=wcp");
  });

  it("escapes brackets in Discord link text", () => {
    const [embed] = JSON.parse(formatters.discord.group([event({ productTitle: "Gear [12T]", variantTitle: "" }), event({ productId: 4 })])).embeds;
    expect(embed.description).toContain("[Gear \\[12T\\]](https://vendordiff.com/v/wcp/3-gear/7)");
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
    ["json", "https://example.com/hook", true],
    ["json", "http://example.com/hook", false],
    ["json", "https://127.0.0.1/hook", false],
  ] as const)("%s %s → %s", (type, url, valid) => {
    expect(parseWebhookUrl(type, url) !== null).toBe(valid);
  });
});
