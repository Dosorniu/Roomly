import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { AppTheme } from "@/components/study/AppTheme";

export const metadata: Metadata = {
  title: "Roomly · Room Finder",
  description:
    "Find a study space, check in and share a room on campus. Student demonstration prototype.",
  other: {
    "codex-preview": "development",
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
    <html lang="en" suppressHydrationWarning>
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
