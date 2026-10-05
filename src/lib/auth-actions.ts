"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function signIn() {
  const { url } = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/account" } });
  redirect(url!);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
