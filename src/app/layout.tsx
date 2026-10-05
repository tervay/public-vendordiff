import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "FRC Vendor Tracker", template: "%s · FRC Vendor Tracker" },
  description: "Stock and price changes across FRC vendors, checked every hour.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-hairline">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold">
              FRC Vendor Tracker
            </Link>
            <Link href="/search" className="text-sm text-muted hover:text-foreground">
              Products
            </Link>
            <Link href="/history" className="text-sm text-muted hover:text-foreground">
              History
            </Link>
            <a
              href="https://www.chiefdelphi.com/u/jtrv"
              target="_blank"
              rel="noopener"
              className="ml-auto text-sm text-muted hover:text-foreground"
            >
              by Justin
            </a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-4xl px-4 py-6 text-xs text-subtle">
          Vendor sites are checked every hour. Not affiliated with any vendor.
        </footer>
      </body>
    </html>
  );
}
