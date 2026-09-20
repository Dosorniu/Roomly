import type { Metadata } from "next";
import "./globals.css";
import { AppTheme } from "@/components/study/AppTheme";

export const metadata: Metadata = {
  title: "Roomly · Room Finder",
  description: "Find a study space, check in and share a room on campus. Student demonstration prototype.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><AppTheme>{children}</AppTheme></body>
    </html>
  );
}

