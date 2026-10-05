import { fetchCatalog } from "@/adapters";
import { vendors } from "@/vendors";

const results = await Promise.allSettled(
  vendors.map(async (vendor) => {
    const started = performance.now();
    const catalog = await fetchCatalog(vendor);
    const products = new Set(catalog.map((item) => item.externalProductId)).size;
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    return `${vendor.slug.padEnd(12)} ${String(products).padStart(5)} products ${String(catalog.length).padStart(6)} variants ${seconds}s`;
  }),
);

for (const [i, result] of results.entries()) {
  console.log(result.status === "fulfilled" ? result.value : `${vendors[i].slug.padEnd(12)} FAILED ${result.reason}`);
}
