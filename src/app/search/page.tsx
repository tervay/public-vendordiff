import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Thumbnail } from "@/components/events";
import { formatPrice } from "@/lib/format";
import { SEARCH_PAGE_SIZE, searchProducts } from "@/lib/queries";
import { vendorBySlug, vendors } from "@/vendors";

export const metadata: Metadata = { title: "Products" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SearchView searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchView({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  const vendor = typeof params.vendor === "string" ? vendorBySlug(params.vendor) : undefined;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(0, Math.floor(Number(params.page)) || 0);
  const results = await searchProducts(vendor?.slug, query, page);
  const pageHref = (n: number) => `/search?${new URLSearchParams({ vendor: vendor?.slug ?? "", q: query, page: String(n) })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <Form action="/search" className="flex flex-wrap gap-2">
        <select name="vendor" defaultValue={vendor?.slug ?? ""} className="rounded-lg border border-hairline bg-surface px-3 py-2">
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={query}
          placeholder="Product name or SKU"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-background">
          Search
        </button>
      </Form>
      {results.length === 0 ? (
        <p className="text-muted">No products found.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {results.slice(0, SEARCH_PAGE_SIZE).map((product) => (
            <li key={product.productId} className="flex items-center gap-3 py-3">
              <Thumbnail src={product.imageUrl} />
              <div className="min-w-0 flex-1">
                <Link href={`/v/${product.vendorSlug}/${product.productId}-${product.handle}`} prefetch={false} className="block truncate font-medium hover:underline">
                  {product.title}
                </Link>
                <div className="text-sm text-muted">{vendorBySlug(product.vendorSlug)?.name}</div>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                {product.minPriceCents !== null && <div>from {formatPrice(product.minPriceCents)}</div>}
                <div className="text-muted">
                  {product.activeCount === 0 ? "Removed" : `${product.inStockCount} of ${product.activeCount} in stock`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm">
        {page > 0 ? <Link href={pageHref(page - 1)}>← Previous</Link> : <span />}
        {results.length > SEARCH_PAGE_SIZE && <Link href={pageHref(page + 1)}>Next →</Link>}
      </nav>
    </div>
  );
}
