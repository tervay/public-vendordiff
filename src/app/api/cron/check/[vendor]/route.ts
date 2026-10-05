import { revalidateTag } from "next/cache";
import { checkVendor } from "@/lib/check";
import { vendorBySlug } from "@/vendors";

export async function GET(request: Request, { params }: RouteContext<"/api/cron/check/[vendor]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const vendor = vendorBySlug((await params).vendor);
  if (!vendor) return new Response("Unknown vendor", { status: 404 });

  const result = await checkVendor(vendor);
  revalidateTag("runs", "max");
  if (result.dirty) {
    revalidateTag(`vendor:${vendor.slug}`, "max");
    revalidateTag("feed", "max");
  }
  return Response.json(result, { status: result.status === "ok" ? 200 : 500 });
}
