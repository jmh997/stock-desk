import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Desk",
  description: "Personal research desk — memos, watchlist, portfolio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Stock Desk
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-2.5 py-1.5 text-[var(--muted)] hover:bg-[var(--bg-row)] hover:text-[var(--text)]"
              >
                Desk
              </Link>
              <Link
                href="/memos"
                className="rounded-md px-2.5 py-1.5 text-[var(--muted)] hover:bg-[var(--bg-row)] hover:text-[var(--text)]"
              >
                Memos
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
