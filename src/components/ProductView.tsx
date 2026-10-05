import Link from "next/link";
import { notFound } from "next/navigation";
import { Thumbnail } from "@/components/events";
import { StockLabel, VariantHistory, VariantPrice, VariantTable } from "@/components/ProductHistory";
import { formatDate } from "@/lib/format";
import { getProduct } from "@/lib/queries";
import { vendorBySlug } from "@/vendors";

const paramId = (param: string) => param.match(/^(\d{1,9})(-|$)/)?.[1];

export async function ProductView({ params }: { params: Promise<{ vendor: string; product: string; variant?: string }> }) {
  const { vendor: slug, product: productParam, variant: variantParam } = await params;
  const vendor = vendorBySlug(slug);
  const id = paramId(productParam);
  const data = vendor && id && (await getProduct(vendor.slug, Number(id)));
  if (!vendor || !data) notFound();
  const { product, variants, history, asOf } = data;
  const productPath = `/v/${vendor.slug}/${product.id}-${product.handle}`;
  const variant = variantParam === undefined ? undefined : variants.find((v) => v.id === Number(paramId(variantParam)));
  if (variantParam !== undefined && !variant) notFound();
  const shown = variant ?? variants[0];
  const vendorUrl = variant && vendor.platform === "shopify" ? `${product.url}?variant=${variant.externalId}` : product.url;

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <Thumbnail src={product.imageUrl} />
        <div className="space-y-1">
          <p className="text-sm text-muted">
            <Link href={`/v/${vendor.slug}`} className="hover:underline">
              {vendor.name}
            </Link>
            {variant && (
              <>
                {" / "}
                <Link href={productPath} className="hover:underline">
                  {product.title}
                </Link>
              </>
            )}
          </p>
          <h1 className="text-2xl font-semibold">
            <a href={vendorUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {variant?.title || product.title} ↗
            </a>
          </h1>
          {variant && (
            <p className="flex flex-wrap items-center gap-x-3 text-sm tabular-nums">
              {variant.sku && <span className="text-muted">{variant.sku}</span>}
              <span>
                <VariantPrice variant={variant} />
              </span>
              <StockLabel variant={variant} />
            </p>
          )}
          <p className="text-sm text-muted">First seen {formatDate(product.firstSeenAt)}</p>
        </div>
      </header>
      {shown ? (
        <div className="space-y-10">
          {!variant && <VariantTable variants={variants} selectedId={shown.id} basePath={productPath} />}
          <VariantHistory variant={shown} history={history} asOf={asOf} title={variant ? undefined : shown.title} />
        </div>
      ) : (
        <p className="text-muted">This product has no variants listed.</p>
      )}
    </div>
  );
}
