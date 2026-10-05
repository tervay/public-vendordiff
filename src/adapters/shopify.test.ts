import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchShopify } from "./shopify";

const variant = (id: number, options: string[], overrides = {}) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  sku: `SKU-${id}`,
  price: { amount: "12.5" },
  compareAtPrice: null,
  availableForSale: true,
  currentlyNotInStock: false,
  selectedOptions: options.map((value) => ({ value })),
  ...overrides,
});

const product = (id: number, variants: ReturnType<typeof variant>[], overrides = {}) => ({
  id: `gid://shopify/Product/${id}`,
  title: `Product ${id}`,
  handle: `product-${id}`,
  vendor: "Shop",
  featuredImage: { url: `https://cdn.example.com/${id}.png` },
  variants: { pageInfo: { hasNextPage: false }, nodes: variants },
  ...overrides,
});

const page = (nodes: ReturnType<typeof product>[], endCursor: string | null = null) => ({
  data: { products: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes } },
});

const stubPages = (...pages: unknown[]) => {
  const fetch = vi.fn();
  for (const body of pages) fetch.mockResolvedValueOnce(Response.json(body));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchShopify", () => {
  it("maps variants and follows the cursor across pages", async () => {
    const fetch = stubPages(
      page(
        [
          product(1, [
            variant(11, ["Default Title"]),
            variant(12, ["Red", "Large"], { currentlyNotInStock: true, compareAtPrice: { amount: "20.0" } }),
            variant(13, ["Blue", "Large"], { availableForSale: false, currentlyNotInStock: true }),
          ]),
          product(2, [variant(21, ["Default Title"])], { vendor: "N/A" }),
        ],
        "cursor-1",
      ),
      page([product(3, [variant(31, ["Default Title"], { sku: "" })], { featuredImage: null })]),
    );

    const catalog = await fetchShopify("https://shop.example.com", ["N/A"]);

    expect(catalog.map(({ externalProductId, externalVariantId, variantTitle, stock, compareAtCents }) => ({
      externalProductId,
      externalVariantId,
      variantTitle,
      stock,
      compareAtCents,
    }))).toEqual([
      { externalProductId: "1", externalVariantId: "11", variantTitle: "", stock: "in_stock", compareAtCents: null },
      { externalProductId: "1", externalVariantId: "12", variantTitle: "Red / Large", stock: "backorder", compareAtCents: 2000 },
      { externalProductId: "1", externalVariantId: "13", variantTitle: "Blue / Large", stock: "out_of_stock", compareAtCents: null },
      { externalProductId: "3", externalVariantId: "31", variantTitle: "", stock: "in_stock", compareAtCents: null },
    ]);
    expect(catalog[0]).toMatchObject({
      productTitle: "Product 1",
      handle: "product-1",
      productUrl: "https://shop.example.com/products/product-1",
      sku: "SKU-11",
      priceCents: 1250,
      imageUrl: "https://cdn.example.com/1.png",
    });
    expect(catalog[3]).toMatchObject({ sku: null, imageUrl: null });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).variables).toEqual({ after: "cursor-1" });
  });

  it("throws when a product has more variants than one request returns", async () => {
    stubPages(page([product(1, [variant(11, ["Default Title"])], { variants: { pageInfo: { hasNextPage: true }, nodes: [] } })]));
    await expect(fetchShopify("https://shop.example.com")).rejects.toThrow("more than 250 variants");
  });

  it("throws on GraphQL errors", async () => {
    stubPages({ errors: [{ message: "Throttled" }] });
    await expect(fetchShopify("https://shop.example.com")).rejects.toThrow("Throttled");
  });
});
