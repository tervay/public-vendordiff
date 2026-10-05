import type { VercelConfig } from "@vercel/config/v1";
import { vendors } from "./src/vendors";

const utcHours = [2, 6, 10, 14, 18, 22];

export const config: VercelConfig = {
  crons: vendors.flatMap((vendor) =>
    utcHours.map((hour) => ({
      path: `/api/cron/check/${vendor.slug}`,
      schedule: `0 ${hour} * * *`,
    })),
  ),
};
