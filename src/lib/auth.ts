import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  plugins: [nextCookies()],
});
