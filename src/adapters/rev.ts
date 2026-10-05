import { toCents, type CatalogVariant } from ".";
import { fetchJson } from "./http";

type RevItem = {
  sku: string;
  name: string;
  availability_status: string;
  price: number;
  url: string;
  image_url: string | null;
};

export async function fetchRev(feedUrl: string): Promise<CatalogVariant[]> {
  const items = await fetchJson<RevItem[]>(feedUrl);
  return items.map((item) => ({
    externalProductId: item.sku,
    externalVariantId: item.sku,
    productTitle: item.name,
    variantTitle: "",
    handle: item.url.split("/").filter(Boolean).at(-1) ?? item.sku,
    productUrl: item.url,
    sku: item.sku,
    priceCents: toCents(item.price),
    compareAtCents: null,
    stock: item.availability_status === "Available" ? "in_stock" : "out_of_stock",
    imageUrl: item.image_url,
  }));
}
