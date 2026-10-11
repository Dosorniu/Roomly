"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
  Zap,
  ArrowLeftRight,
  VolumeX,
  Users,
  Layers,
} from "lucide-react";
import { floors, rooms } from "@/data/catalog";
import type { RoomView, Status } from "@/types/domain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { RoomCard } from "./RoomCard";
interface Props {
  views: RoomView[];
  query: string;
  onQuery: (s: string) => void;
  status: Status | "all";
  onStatus: (s: Status | "all") => void;
  floor: string;
  onFloor: (s: string) => void;
  capacity: string;
  onCapacity: (s: string) => void;
  type: string;
  onType: (s: string) => void;
  onReset: () => void;
}
export function DiscoverRooms(p: Props) {
  const [expanded, setExpanded] = useState(false);
  // Campus opening hours (Mon–Fri, 08:00–20:00). Computed after mount to avoid a
  // server/client time mismatch; explains why nothing reads as "Free now" off-hours.
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const n = new Date();
      const h = n.getHours() + n.getMinutes() / 60;
      setClosed(n.getDay() === 0 || n.getDay() === 6 || h < 8 || h >= 20);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const active =
    p.floor !== "all" ||
    p.capacity !== "all" ||
    p.type !== "all" ||
    p.status === "occupied";
  const title = p.query.trim()
    ? "Search results"
    : p.status === "free"
      ? "Available now"
      : p.status === "share"
        ? "Open to Share"
        : "All study spaces";
  // Single-select quick filters — tapping one clears the rest; tapping the active
  // one clears back to all. "Floors" opens the detailed filters (floor picker).
  const pick = (isActive: boolean, apply: () => void) => () => {
    p.onReset();
    if (!isActive) apply();
  };
  const quickActions = [
    {
      key: "free",
      label: "Free now",
      Icon: Zap,
      active: p.status === "free",
      onClick: pick(p.status === "free", () => p.onStatus("free")),
    },
    {
      key: "share",
      label: "To share",
      Icon: ArrowLeftRight,
      active: p.status === "share",
      onClick: pick(p.status === "share", () => p.onStatus("share")),
    },
    {
      key: "quiet",
      label: "Quiet",
      Icon: VolumeX,
      active: p.type === "Quiet space",
      onClick: pick(p.type === "Quiet space", () => p.onType("Quiet space")),
    },
    {
      key: "group",
      label: "Group",
      Icon: Users,
      active: p.capacity === "6",
      onClick: pick(p.capacity === "6", () => p.onCapacity("6")),
    },
    {
      key: "floors",
      label: "Floors",
      Icon: Layers,
      active: expanded || p.floor !== "all",
      onClick: () => setExpanded((v) => !v),
    },
  ];
  return (
    <div className="discovery-layout">
      <div className="quick-actions" aria-label="Quick filters">
        {quickActions.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`quick-action${a.active ? " active" : ""}`}
            aria-pressed={a.active}
            onClick={a.onClick}
          >
            <span className="qa-circle">
              <a.Icon size={24} strokeWidth={2.4} />
            </span>
            <span className="qa-label">{a.label}</span>
          </button>
        ))}
      </div>
      {closed && (
        <div className="closed-banner" role="note">
          <span className="closed-dot" />
          Campus is closed right now. Bookings are available Mon–Fri,
          08:00–20:00 — you can book a slot ahead of time.
        </div>
      )}
      <section className="discovery-intro">
        <span className="eyebrow">YOUR CAMPUS, AT A GLANCE</span>
        <h1>Find your study space.</h1>
        <p className="intro-description">
          See which rooms are free, shared or bookable on campus right now — and
          reserve a slot ahead of time.
        </p>
        <div className="search-box">
          <Search size={21} />
          <input
            aria-label="Search rooms"
            placeholder="Search by room, building or floor..."
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
          />
          {p.query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => p.onQuery("")}
            >
              <X size={17} />
            </button>
          )}
        </div>
      </section>
      <section className="room-section" id="rooms">
        <div className="section-title">
          <h2>{title}</h2>
          <button
            className="text-button"
            onClick={() => {
              p.onReset();
              p.onStatus("all");
            }}
          >
            View all rooms <ArrowRight size={17} />
          </button>
        </div>
        <div className="room-list">
          {p.views.length ? (
            p.views.map((view) => <RoomCard key={view.room.id} view={view} />)
          ) : (
            <Empty className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                <SearchX size={26} />
              </div>
              <EmptyHeader>
                <EmptyTitle>No matching rooms</EmptyTitle>
                <EmptyDescription>
                  {p.status === "free" && !p.query
                    ? "No rooms are free right now. View all rooms to find a shared space, or book a slot for later."
                    : "Try another search or broaden your filters."}
                </EmptyDescription>
              </EmptyHeader>
              <button
                className="secondary-button"
                onClick={() => {
                  p.onReset();
                  p.onStatus("all");
                }}
              >
                View all rooms
              </button>
            </Empty>
          )}
        </div>
        <div className="list-tools">
          <span aria-live="polite">
            {p.views.length} {p.views.length === 1 ? "space" : "spaces"} · Live
            status
          </span>
          <button
            className="text-button filter-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={15} />
            {active ? "Filters active" : "More filters"}
          </button>
        </div>
        {expanded && (
          <div className="advanced-filters">
            <Select value={p.floor} onValueChange={p.onFloor}>
              <SelectTrigger aria-label="Floor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All floors</SelectItem>
                {floors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={p.capacity} onValueChange={p.onCapacity}>
              <SelectTrigger aria-label="Minimum capacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any capacity</SelectItem>
                <SelectItem value="4">4+ people</SelectItem>
                <SelectItem value="6">6+ people</SelectItem>
                <SelectItem value="8">8+ people</SelectItem>
              </SelectContent>
            </Select>
            <Select value={p.type} onValueChange={p.onType}>
              <SelectTrigger aria-label="Room type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All room types</SelectItem>
                {Array.from(new Set(rooms.map((r) => r.type))).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={p.status}
              onValueChange={(s) => p.onStatus(s as Status | "all")}
            >
              <SelectTrigger aria-label="All status filters">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="share">Open to Share</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
              </SelectContent>
            </Select>
            {active && (
              <button className="text-button" onClick={p.onReset}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
