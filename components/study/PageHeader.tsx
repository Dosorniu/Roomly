"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

// Lightweight top bar for the static Guide and Privacy pages, matching the main
// header (brand + nav + theme toggle). Session-only actions are omitted here.
export function PageHeader() {
  const pathname = usePathname();
  const cls = (href: string) => `nav-link${pathname === href ? " active" : ""}`;
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link className="brand" href="/">
          <span className="brand-logo" aria-hidden="true">
            <img src="/team-monogram.png" alt="" />
          </span>
          <span>Roomly</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className={cls("/")} href="/">
            Rooms
          </Link>
          <Link className={cls("/help")} href="/help">
            Guide
          </Link>
          <Link className={cls("/privacy")} href="/privacy">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="header-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
