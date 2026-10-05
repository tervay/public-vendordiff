import type { StockStatus } from "@/db/schema";
import { toCents, type CatalogVariant } from ".";
import { fetchJson, sleep } from "./http";

type ShopifyVariant = {
  id: string;
  sku: string | null;
  price: { amount: string };
  compareAtPrice: { amount: string } | null;
  availableForSale: boolean;
  currentlyNotInStock: boolean;
  selectedOptions: { value: string }[];
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  featuredImage: { url: string } | null;
  variants: { pageInfo: { hasNextPage: boolean }; nodes: ShopifyVariant[] };
};

type ShopifyResponse = {
  data?: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyProduct[] } };
  errors?: unknown[];
};

const API_VERSION = "2026-10";
const PAGE_SIZE = 250;
const MAX_PAGES = 100;
const PAGE_DELAY_MS = 500;

const QUERY = `query ($after: String) {
  products(first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle vendor
      featuredImage { url }
      variants(first: ${PAGE_SIZE}) {
        pageInfo { hasNextPage }
        nodes { id sku price { amount } compareAtPrice { amount } availableForSale currentlyNotInStock selectedOptions { value } }
      }
    }
  }
}`;

const fetchPage = (baseUrl: string, after: string | null) =>
  fetchJson<ShopifyResponse>(`${baseUrl}/api/${API_VERSION}/graphql.json`, { query: QUERY, variables: { after } });

export async function fetchShopify(baseUrl: string, ignoredVendors: string[] = []): Promise<CatalogVariant[]> {
  const catalog: CatalogVariant[] = [];
  let after: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, errors } = await fetchPage(baseUrl, after);
    if (!data || errors) throw new Error(`${baseUrl} GraphQL errors: ${JSON.stringify(errors)}`);
    const { pageInfo, nodes } = data.products;
    const overflowing = nodes.find((product) => product.variants.pageInfo.hasNextPage);
    if (overflowing) throw new Error(`${baseUrl} product ${overflowing.handle} has more than ${PAGE_SIZE} variants`);
    catalog.push(
      ...nodes
        .filter((product) => !ignoredVendors.includes(product.vendor))
        .flatMap((product) => product.variants.nodes.map((variant) => toCatalogVariant(baseUrl, product, variant))),
    );
    if (!pageInfo.hasNextPage) return catalog;
    after = pageInfo.endCursor;
    await sleep(PAGE_DELAY_MS);
  }
  throw new Error(`${baseUrl} returned more than ${MAX_PAGES} pages`);
}

const numericId = (gid: string) => gid.slice(gid.lastIndexOf("/") + 1);

const toStock = (variant: ShopifyVariant): StockStatus =>
  !variant.availableForSale ? "out_of_stock" : variant.currentlyNotInStock ? "backorder" : "in_stock";

const toCatalogVariant = (baseUrl: string, product: ShopifyProduct, variant: ShopifyVariant): CatalogVariant => {
  const title = variant.selectedOptions.map((option) => option.value).join(" / ");
  return {
    externalProductId: numericId(product.id),
    externalVariantId: numericId(variant.id),
    productTitle: product.title,
    variantTitle: title === "Default Title" ? "" : title,
    handle: product.handle,
    productUrl: `${baseUrl}/products/${product.handle}`,
    sku: variant.sku || null,
    priceCents: toCents(variant.price.amount),
    compareAtCents: variant.compareAtPrice ? toCents(variant.compareAtPrice.amount) : null,
    stock: toStock(variant),
    imageUrl: product.featuredImage?.url ?? null,
  };
};
