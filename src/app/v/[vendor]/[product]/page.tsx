import { Suspense } from "react";
import { ProductView } from "@/components/ProductView";

export default function ProductPage({ params }: PageProps<"/v/[vendor]/[product]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ProductView params={params} />
    </Suspense>
  );
}
