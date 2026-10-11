"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarClock,
  Clock,
  MapPin,
  X,
  ArrowRight,
  DoorOpen,
  LogOut,
  Users,
} from "lucide-react";
import { rooms, floors, buildings } from "@/data/catalog";
import { roomPath } from "@/services/routes";
import { myBookings, cancelBooking } from "@/services/bookings";
import type { MyBooking, RoomView } from "@/types/domain";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WD = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const durTxt = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m % 60 === 0) return `${m / 60}h`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const dayKey = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayLabel = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dayKey(ms) - today.getTime()) / 86400000);
  const base = `${WD[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  return base;
};

function roomOf(roomId: string) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return { name: "Room", number: roomId, location: "" };
  const floor = floors.find((f) => f.id === room.floorId);
  const building = floor
    ? buildings.find((b) => b.id === floor.buildingId)
    : undefined;
  const location = [building?.name, floor?.name].filter(Boolean).join(" · ");
  return { name: room.name, number: room.number, location, room };
}

export function MyBookings({
  canInteract,
  shared,
  onRequireAuth,
  current,
  onLeave,
}: {
  canInteract: boolean;
  shared: boolean;
  onRequireAuth: () => void;
  // The room you are checked into right now, if any.
  current?: RoomView;
  onLeave: (roomId: string) => Promise<boolean>;
}) {
  const [items, setItems] = useState<MyBooking[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [cancelling, setCancelling] = useState<MyBooking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const next = await myBookings();
    setItems(next);
    setError(null);
  }

  useEffect(() => {
    // Gated (shared mode, not signed in): the render shows the sign-in card
    // regardless of `loaded`, so just skip loading — no setState in the effect.
    if (shared && !canInteract) return;
    let alive = true;
    (async () => {
      try {
        const next = await myBookings();
        if (alive) {
          setItems(next);
          setError(null);
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Unable to load your bookings.",
          );
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shared, canInteract]);

  const onCancel = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await cancelBooking(id);
      await load();
      setCancelling(null);
      toast.success("Reservation cancelled.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to cancel the reservation.",
      );
    } finally {
      setBusy(null);
    }
  };

  // Group upcoming bookings by calendar day, in chronological order.
  const groups = new Map<number, MyBooking[]>();
  for (const b of items) {
    const k = dayKey(b.startsAt);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(b);
  }
  const days = Array.from(groups.keys()).sort((a, b) => a - b);

  return (
    <section className="mybookings">
      <Link href="/" className="back-link">
        <ArrowRight size={17} style={{ transform: "rotate(180deg)" }} /> All
        study spaces
      </Link>

      <header className="mb-head">
        <span className="eyebrow">YOUR ROOMS</span>
        <h1>My bookings</h1>
        <p className="intro-description">
          Where you are checked in right now, and every room you have reserved,
          soonest first.
        </p>
      </header>

      {canInteract && current?.session && (
        <section className="mb-now" aria-labelledby="mb-now-title">
          <h2 className="mb-dayhdr" id="mb-now-title">
            Checked in now
          </h2>
          <article className="mb-card mb-card-now">
            <div className="mb-main">
              <div className="mb-room">
                <Link href={roomPath(current.room)} className="mb-roomname">
                  {current.room.name} · {current.room.number}
                </Link>
              </div>
              <div className="mb-meta">
                <span>
                  <Clock size={15} />
                  Until {fmt(current.session.expectedEnd)}
                  <i className="mb-dot" />
                  {current.session.openToShare ? "Others can join" : "Just you"}
                </span>
                <span>
                  <Users size={15} />
                  {current.count} / {current.room.capacity} inside
                </span>
                {roomOf(current.room.id).location && (
                  <span>
                    <MapPin size={15} />
                    {roomOf(current.room.id).location}
                  </span>
                )}
              </div>
            </div>
            <div className="mb-actions">
              <Link href={roomPath(current.room)} className="mb-cancel">
                <DoorOpen size={16} /> Open room
              </Link>
              <button
                className="mb-cancel"
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true);
                  await onLeave(current.room.id);
                  setLeaving(false);
                }}
              >
                <LogOut size={16} />
                {leaving ? "Leaving…" : "Leave"}
              </button>
            </div>
          </article>
        </section>
      )}

      {shared && !canInteract ? (
        <div className="mb-empty">
          <div className="empty-icon" aria-hidden="true">
            <CalendarClock size={26} />
          </div>
          <h2>Sign in to see your bookings</h2>
          <p>
            Your reservations are tied to your campus account. Sign in with a
            verified email to view and manage them.
          </p>
          <button className="primary-button" onClick={onRequireAuth}>
            Sign in
          </button>
        </div>
      ) : !loaded ? (
        <div className="mb-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="mb-skel" key={i}>
              <div className="sk sk-title" />
              <div className="sk sk-sub" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mb-empty" role="alert">
          <h2>Couldn’t load your bookings</h2>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mb-empty">
          <div className="empty-icon" aria-hidden="true">
            <CalendarClock size={26} />
          </div>
          <h2>No upcoming bookings</h2>
          <p>
            You haven’t reserved any rooms yet. Open a room and pick a free slot
            in its Availability calendar.
          </p>
          <Link href="/" className="primary-button">
            Browse rooms
          </Link>
        </div>
      ) : (
        <div className="mb-days">
          {days.map((k) => (
            <div className="mb-daygroup" key={k}>
              <h2 className="mb-dayhdr">{dayLabel(k)}</h2>
              <div className="mb-list">
                {groups
                  .get(k)!
                  .sort((a, b) => a.startsAt - b.startsAt)
                  .map((b) => {
                    const r = roomOf(b.roomId);
                    return (
                      <article className="mb-card" key={b.id}>
                        <div className="mb-main">
                          <div className="mb-room">
                            {r.room ? (
                              <Link
                                href={roomPath(r.room)}
                                className="mb-roomname"
                              >
                                {r.name} · {r.number}
                              </Link>
                            ) : (
                              <span className="mb-roomname">
                                {r.name} · {r.number}
                              </span>
                            )}
                          </div>
                          <div className="mb-meta">
                            <span>
                              <Clock size={15} />
                              {fmt(b.startsAt)}–{fmt(b.endsAt)}
                              <i className="mb-dot" />
                              {durTxt(b.endsAt - b.startsAt)}
                              {b.share && (
                                <>
                                  <i className="mb-dot" />
                                  Others can join
                                </>
                              )}
                            </span>
                            {r.location && (
                              <span>
                                <MapPin size={15} />
                                {r.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="mb-cancel"
                          disabled={busy === b.id}
                          onClick={() => setCancelling(b)}
                          aria-label={`Cancel booking for ${r.name}`}
                        >
                          <X size={16} />
                          {busy === b.id ? "Cancelling…" : "Cancel"}
                        </button>
                      </article>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="small-note mb-note">
        Rooms can be booked Monday to Friday, 08:00–20:00. A booking holds the
        whole room unless you let others join. A check-in is not a booking — it
        ends automatically at the time you chose. Times are shown in your local
        timezone.
      </p>

      {cancelling && (
        <div
          className="sheet-back"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelling(null);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true">
            <h3>Cancel this booking?</h3>
            <p className="s-sub">
              {roomOf(cancelling.roomId).name} ·{" "}
              {roomOf(cancelling.roomId).number},{" "}
              {dayLabel(cancelling.startsAt)}, {fmt(cancelling.startsAt)}–
              {fmt(cancelling.endsAt)}
            </p>
            <p className="s-sub">The slot becomes free for others to book.</p>
            <div className="sheet-actions">
              <button
                className="s-cancel"
                onClick={() => setCancelling(null)}
                disabled={busy !== null}
              >
                Keep booking
              </button>
              <button
                className="s-go"
                onClick={() => onCancel(cancelling.id)}
                disabled={busy !== null}
              >
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
