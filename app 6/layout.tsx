import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AppTheme } from "@/components/study/AppTheme";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Roomly · Room Finder",
  description:
    "Find a study space, check in and share a room on campus. Student demonstration prototype.",
  other: {
    "codex-preview": "development",
    // Bump this when a CSS-only change must force a fresh Cloudflare build
    // (the Workers build cache otherwise reuses the previously compiled CSS).
    "build-rev": "2026-10-04.2",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" suppressHydrationWarning className={figtree.variable}>
      <head>
        <Script
          src="/appearance-init.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
      </head>
      <body className="antialiased">
        <AppTheme>{children}</AppTheme>
      </body>
    </html>
  );
}
