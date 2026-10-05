import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: Array.from({ length: 24 }, (_, hour) => ({
    path: "/api/cron/check",
    schedule: `0 ${hour} * * *`,
  })),
};
