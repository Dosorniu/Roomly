"use client";
import Link from "next/link";
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

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-logo" aria-hidden="true">
          <img src="/team-monogram.png" alt="" />
        </span>
        <span>Roomly</span>
      </Link>
      <nav className="header-actions" aria-label="Main navigation">
        <Link className="nav-link" href="/#building">
          Building
        </Link>
        <button className="nav-link" onClick={() => onPanel("help")}>
          About
        </button>
        <span className="nav-divider" />
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
              <button className="icon-button" aria-label="Open menu">
                <Menu size={22} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/#building">Building</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPanel("appearance")}>
                Appearance
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPanel("help")}>
                About this prototype
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPanel("notifications")}>
                Availability notifications
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
