import { toCents, type CatalogVariant } from ".";
import { fetchJson, sleep } from "./http";

type ShopifyVariant = {
  id: number;
  title: string;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
};

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  images: { src: string }[];
  variants: ShopifyVariant[];
};

const PAGE_SIZE = 250;
const MAX_PAGES = 100;
const PAGE_DELAY_MS = 500;

export async function fetchShopify(baseUrl: string): Promise<CatalogVariant[]> {
  const catalog: CatalogVariant[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { products } = await fetchJson<{ products: ShopifyProduct[] }>(
      `${baseUrl}/products.json?limit=${PAGE_SIZE}&page=${page}`,
    );
    if (products.length === 0) return catalog;
    catalog.push(...products.flatMap((product) => product.variants.map((variant) => toCatalogVariant(baseUrl, product, variant))));
    await sleep(PAGE_DELAY_MS);
  }
  throw new Error(`${baseUrl} returned more than ${MAX_PAGES} pages`);
}

const toCatalogVariant = (baseUrl: string, product: ShopifyProduct, variant: ShopifyVariant): CatalogVariant => ({
  externalProductId: String(product.id),
  externalVariantId: String(variant.id),
  productTitle: product.title,
  variantTitle: variant.title === "Default Title" ? "" : variant.title,
  handle: product.handle,
  productUrl: `${baseUrl}/products/${product.handle}`,
  sku: variant.sku || null,
  priceCents: toCents(variant.price),
  compareAtCents: variant.compare_at_price ? toCents(variant.compare_at_price) : null,
  available: variant.available,
  imageUrl: product.images[0]?.src ?? null,
});
