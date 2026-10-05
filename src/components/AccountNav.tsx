import { headers } from "next/headers";
import Link from "next/link";
import { signIn, signOut } from "@/lib/auth-actions";
import { auth } from "@/lib/auth";

const linkClass = "text-sm text-muted hover:text-foreground";

export async function AccountNav() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <form action={signIn}>
        <button className={linkClass}>Sign in</button>
      </form>
    );
  }

  return (
    <>
      <Link href="/account" className={linkClass}>
        Account
      </Link>
      <form action={signOut}>
        <button className={linkClass}>Sign out</button>
      </form>
    </>
  );
}
