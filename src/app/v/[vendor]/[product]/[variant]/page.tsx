import { Suspense } from "react";
import { ProductView } from "@/components/ProductView";

export default function VariantPage({ params }: PageProps<"/v/[vendor]/[product]/[variant]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ProductView params={params} />
    </Suspense>
  );
}
