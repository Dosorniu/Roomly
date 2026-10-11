"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, UserRound, Settings2 } from "lucide-react";
import { users } from "@/data/catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";

export function Header({
  userId,
  accessGranted,
  onUser,
  onPanel,
  hasNotices,
  shared,
  onSignIn,
  onSignOut,
}: {
  shared: boolean;
  userId: string;
  accessGranted: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onUser: (id: string) => void;
  onPanel: (panel: "help" | "notifications" | "appearance") => void;
  hasNotices: boolean;
}) {
  const accountLabel = !userId
    ? "Sign in"
    : accessGranted
      ? "Sign out"
      : "Complete access";
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link className="brand" href="/">
          <span className="brand-logo" aria-hidden="true">
            R
          </span>
          <span>Roomly</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link
            className={`nav-link${pathname === "/" ? " active" : ""}`}
            href="/"
          >
            Rooms
          </Link>
          <Link
            className={`nav-link${pathname === "/bookings" ? " active" : ""}`}
            href="/bookings"
          >
            My bookings
          </Link>
          <Link
            className={`nav-link${pathname === "/help" ? " active" : ""}`}
            href="/help"
          >
            Guide
          </Link>
          <Link
            className={`nav-link${pathname === "/privacy" ? " active" : ""}`}
            href="/privacy"
          >
            Privacy
          </Link>
        </nav>
      </div>
      <nav className="header-actions" aria-label="Account and settings">
        <ThemeToggle />
        <button
          className="icon-button appearance-button"
          aria-label="Appearance settings"
          onClick={() => onPanel("appearance")}
        >
          <Settings2 size={19} />
        </button>
        <button
          className="icon-button desktop-notifications"
          aria-label="Availability notifications"
          onClick={() => onPanel("notifications")}
        >
          <Bell size={18} />
          {hasNotices && <span className="notice-dot" />}
        </button>
        <div className="desktop-account">
          {shared ? (
            <button
              className="secondary-button"
              onClick={accessGranted ? onSignOut : onSignIn}
            >
              {accountLabel}
            </button>
          ) : (
            <Select value={userId} onValueChange={onUser}>
              <SelectTrigger
                className="student-select"
                aria-label="Demo student"
              >
                <UserRound size={18} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="mobile-menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="icon-button"
                aria-label={
                  hasNotices ? "Open menu (new notifications)" : "Open menu"
                }
              >
                <Menu size={22} />
                {hasNotices && <span className="notice-dot" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/">Rooms</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/bookings">My bookings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">Guide</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/privacy">Privacy</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPanel("appearance")}>
                Appearance
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPanel("notifications")}>
                Availability notifications
                {hasNotices && <span className="menu-new">New</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {shared ? (
                <DropdownMenuItem
                  onSelect={accessGranted ? onSignOut : onSignIn}
                >
                  {accountLabel}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuLabel>Demo student</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={userId} onValueChange={onUser}>
                    {users.map((u) => (
                      <DropdownMenuRadioItem key={u.id} value={u.id}>
                        {u.displayName}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
