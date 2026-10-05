import type { StockStatus } from "@/db/schema";
import type { Vendor } from "@/vendors";
import { fetchRev } from "./rev";
import { fetchShopify } from "./shopify";

export type CatalogVariant = {
  externalProductId: string;
  externalVariantId: string;
  productTitle: string;
  variantTitle: string;
  handle: string;
  productUrl: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stock: StockStatus;
  imageUrl: string | null;
};

export const toCents = (price: string | number) => Math.round(Number(price) * 100);

export async function fetchCatalog(vendor: Vendor): Promise<CatalogVariant[]> {
  const items = vendor.platform === "rev" ? await fetchRev(vendor.url) : await fetchShopify(vendor.url, vendor.ignoredShopifyVendors);
  const valid = items.filter((item) => Number.isFinite(item.priceCents));
  return [...new Map(valid.map((item) => [item.externalVariantId, item])).values()];
}
