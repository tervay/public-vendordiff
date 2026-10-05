import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Thumbnail } from "@/components/events";
import { ProductHistory } from "@/components/ProductHistory";
import { formatDate } from "@/lib/format";
import { getProduct } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

export default function ProductPage({ params }: PageProps<"/v/[vendor]/[product]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: Pick<PageProps<"/v/[vendor]/[product]">, "params">) {
  const { vendor: slug, product: param } = await params;
  const vendor = vendorBySlug(slug);
  const id = param.match(/^(\d{1,9})(-|$)/)?.[1];
  const data = vendor && id && (await getProduct(vendor.slug, Number(id)));
  if (!vendor || !data) notFound();
  const { product, ...history } = data;

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <Thumbnail src={product.imageUrl} />
        <div className="space-y-1">
          <Link href={`/v/${vendor.slug}`} className="text-sm text-muted hover:underline">
            {vendor.name}
          </Link>
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <p className="text-sm text-muted">
            First seen {formatDate(product.firstSeenAt)} ·{" "}
            <a href={product.url} target="_blank" rel="noreferrer" className="hover:underline">
              View on {vendor.name}
            </a>
          </p>
        </div>
      </header>
      <ProductHistory {...history} />
    </div>
  );
}
