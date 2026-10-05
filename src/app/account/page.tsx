import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/lib/auth-actions";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <AccountView />
    </Suspense>
  );
}

async function AccountView() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { user } = session;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="flex items-center gap-4">
        {user.image && <img src={user.image} alt="" className="size-12 rounded-full" referrerPolicy="no-referrer" />}
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>
      <form action={signOut}>
        <button className="text-sm text-muted hover:text-foreground">Sign out</button>
      </form>
    </div>
  );
}
