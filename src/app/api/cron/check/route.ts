import { revalidateTag } from "next/cache";
import { checkVendor } from "@/lib/check";
import { vendors } from "@/vendors";
import { deliverWebhooks } from "@/webhooks/deliver";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = await Promise.all(
    vendors.map(async (vendor) => {
      const result = await checkVendor(vendor);
      if (result.dirty) revalidateTag(`vendor:${vendor.slug}`, "max");
      return [vendor.slug, result] as const;
    }),
  );
  revalidateTag("runs", "max");
  if (results.some(([, result]) => result.dirty)) revalidateTag("feed", "max");
  const webhooks = await deliverWebhooks();

  const allOk = results.every(([, result]) => result.status === "ok");
  return Response.json({ ...Object.fromEntries(results), webhooks }, { status: allOk ? 200 : 500 });
}
