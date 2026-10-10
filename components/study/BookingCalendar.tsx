"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Booking } from "@/types/domain";
import { roomBookings, reserve, cancelBooking } from "@/services/bookings";
import { Switch } from "@/components/ui/switch";

// Opening hours and grid resolution. 08:00–20:00 on a 30-minute grid; bookings are
// drawn as blocks whose height is proportional to their real duration, so a 45- or
// 90-minute slot reads differently from a one-hour one.
const OPEN = 480; // 08:00 in minutes
const CLOSE = 1200; // 20:00
const STEP = 30;
const CELL = 34; // px per 30-minute step
const DURATIONS = [30, 60, 90, 120];
const WINDOW_DAYS = 31; // how far ahead we fetch and allow booking
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const durTxt = (m: number) => (m >= 60 ? `${m / 60}h` : `${m}m`);

function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function weekDays(offset: number): Date[] {
  const base = mondayOfThisWeek();
  base.setDate(base.getDate() + offset * 7);
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });
}
const dayIsPast = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.getTime() < Date.now();
};
// Absolute epoch-ms for a given day + minutes-of-day, in the viewer's local time.
const slotMs = (day: Date, minutes: number) => {
  const t = new Date(day);
  t.setHours(0, 0, 0, 0);
  t.setMinutes(minutes);
  return t.getTime();
};

// First week with at least one weekday still ahead (so weekends skip to next week),
// and the furthest week whose Friday is still inside the booking window.
function firstOpenOffset(): number {
  for (let o = 0; o <= 52; o++)
    if (weekDays(o).some((d) => !dayIsPast(d))) return o;
  return 0;
}
function lastOpenOffset(min: number): number {
  const limit = Date.now() + WINDOW_DAYS * 86400000;
  let last = min;
  for (let o = min; o <= min + 8; o++) {
    if (slotMs(weekDays(o)[0], OPEN) <= limit) last = o;
    else break;
  }
  return last;
}

export function BookingCalendar({
  roomId,
  canInteract,
  onRequireAuth,
  shared,
}: {
  roomId: string;
  canInteract: boolean;
  onRequireAuth: () => void;
  shared: boolean;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dur, setDur] = useState(60);
  const [share, setShare] = useState(false);
  const [minWk] = useState(firstOpenOffset);
  const [maxWk] = useState(() => lastOpenOffset(firstOpenOffset()));
  const [weekOffset, setWeekOffset] = useState(minWk);
  const [confirm, setConfirm] = useState<{
    day: Date;
    start: number;
    startMs: number;
    endMs: number;
  } | null>(null);

  const canView = !shared || canInteract;

  async function load() {
    const next = await roomBookings(roomId, WINDOW_DAYS);
    setBookings(next);
    setError(null);
  }

  useEffect(() => {
    if (!canView) return;
    let alive = true;
    (async () => {
      try {
        const next = await roomBookings(roomId, WINDOW_DAYS);
        if (!alive) return;
        setBookings(next);
        setError(null);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Unable to load the calendar.",
          );
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId, canView]);

  const days = weekDays(weekOffset);
  const starts: number[] = [];
  for (let m = OPEN; m < CLOSE; m += STEP) starts.push(m);
  const H = starts.length * CELL;
  const todayKey = new Date().toDateString();
  const cols = `56px repeat(5, minmax(80px, 1fr))`;

  // Bookings overlapping a given day, mapped to minutes-of-day for positioning.
  function dayBlocks(day: Date) {
    const dayStart = slotMs(day, 0);
    const dayEnd = slotMs(day, 24 * 60);
    return bookings
      .filter((b) => b.endsAt > dayStart && b.startsAt < dayEnd)
      .map((b) => ({
        ...b,
        startMin: Math.max(OPEN, Math.round((b.startsAt - dayStart) / 60000)),
        endMin: Math.min(CLOSE, Math.round((b.endsAt - dayStart) / 60000)),
      }));
  }

  const confirmReserve = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await reserve(roomId, confirm.startMs, confirm.endMs, share);
      await load();
      setConfirm(null);
      toast.success(
        `Reserved ${MONTHS[confirm.day.getMonth()]} ${confirm.day.getDate()}, ${fmt(confirm.start)}–${fmt(confirm.start + dur)}.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to reserve the slot.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelBooking(id);
      await load();
      toast.success("Reservation cancelled.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to cancel the slot.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canView)
    return (
      <section className="booking-cal">
        <div className="booking-cal-head">
          <h2>Availability</h2>
        </div>
        <p className="booking-locked">
          Sign in with a verified campus email to see and book this room’s
          schedule.
        </p>
        <button className="secondary-button" onClick={onRequireAuth}>
          Sign in to book
        </button>
      </section>
    );

  return (
    <section className="booking-cal">
      <div className="booking-cal-head">
        <h2>Availability</h2>
        <div className="booking-legend">
          <span>
            <i className="lg-free" />
            Free
          </span>
          <span>
            <i className="lg-busy" />
            Booked
          </span>
          <span>
            <i className="lg-mine" />
            Your slot
          </span>
        </div>
      </div>

      <div className="booking-tools">
        <span className="dur-label">Duration</span>
        <div className="dur-row">
          {DURATIONS.map((m) => (
            <button
              key={m}
              className={m === dur ? "on" : ""}
              onClick={() => setDur(m)}
            >
              {durTxt(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="weeknav">
        <button
          className="wk-btn"
          aria-label="Previous week"
          disabled={weekOffset <= minWk}
          onClick={() => setWeekOffset((w) => Math.max(minWk, w - 1))}
        >
          ‹
        </button>
        <span className="wk-label">
          {(() => {
            const a = days[0],
              b = days[4],
              ma = MONTHS[a.getMonth()],
              mb = MONTHS[b.getMonth()];
            return ma === mb
              ? `${ma} ${a.getDate()} – ${b.getDate()}`
              : `${ma} ${a.getDate()} – ${mb} ${b.getDate()}`;
          })()}
        </span>
        <button
          className="wk-btn"
          aria-label="Next week"
          disabled={weekOffset >= maxWk}
          onClick={() => setWeekOffset((w) => Math.min(maxWk, w + 1))}
        >
          ›
        </button>
        {weekOffset > minWk && (
          <button className="wk-today" onClick={() => setWeekOffset(minWk)}>
            This week
          </button>
        )}
      </div>

      {error ? (
        <p className="booking-locked">{error}</p>
      ) : !loaded ? (
        <p className="booking-locked">Loading schedule…</p>
      ) : (
        <div className="booking-scroll">
          <div className="calhead" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d, i) => {
              const past = dayIsPast(d);
              const today = d.toDateString() === todayKey;
              return (
                <div
                  className={`booking-dayhdr${past ? " past" : ""}${today ? " today" : ""}`}
                  key={i}
                >
                  {WD[(d.getDay() + 6) % 7]}
                  <small>
                    {MONTHS[d.getMonth()]} {d.getDate()}
                  </small>
                </div>
              );
            })}
          </div>
          <div
            className="calbody"
            style={{ gridTemplateColumns: cols, height: H }}
          >
            <div className="caltimes" style={{ height: H }}>
              {starts.map((st, i) => (
                <div
                  key={st}
                  className={`caltime-abs${st % 60 ? " half" : ""}`}
                  style={{ top: i * CELL }}
                >
                  {fmt(st)}
                </div>
              ))}
            </div>
            {days.map((d, di) => {
              const past = dayIsPast(d);
              const blocks = dayBlocks(d);
              const covered = (a: number, b: number) =>
                blocks.some((x) => x.endMin > a && x.startMin < b);
              return (
                <div
                  className={`calcol${past ? " past" : ""}`}
                  style={{ height: H }}
                  key={di}
                >
                  {!past &&
                    starts.map((st, i) => {
                      if (covered(st, st + STEP)) return null;
                      if (slotMs(d, st) <= Date.now()) return null;
                      return (
                        <button
                          key={st}
                          className="freecell"
                          style={{ top: i * CELL, height: CELL }}
                          disabled={busy}
                          onClick={() => {
                            const end = st + dur;
                            if (end > CLOSE) {
                              toast.error(
                                "That runs past closing time (20:00).",
                              );
                              return;
                            }
                            if (covered(st, end)) {
                              toast.error(
                                `Not enough free time for ${durTxt(dur)} here.`,
                              );
                              return;
                            }
                            setShare(false);
                            setConfirm({
                              day: d,
                              start: st,
                              startMs: slotMs(d, st),
                              endMs: slotMs(d, end),
                            });
                          }}
                        >
                          Free
                        </button>
                      );
                    })}
                  {blocks.map((b) => (
                    <div
                      key={b.id}
                      className={`bkblock ${b.mine ? "mine" : "busy"}`}
                      style={{
                        top: ((b.startMin - OPEN) / STEP) * CELL,
                        height: Math.max(
                          CELL - 4,
                          ((b.endMin - b.startMin) / STEP) * CELL,
                        ),
                        cursor: b.mine ? "pointer" : "default",
                      }}
                      onClick={b.mine ? () => onCancel(b.id) : undefined}
                      title={
                        b.mine
                          ? "Tap to cancel your reservation"
                          : b.share
                            ? "Booked — others can join"
                            : undefined
                      }
                    >
                      <span>
                        {b.by}
                        {b.share ? " · open" : ""}
                      </span>
                      <small>
                        {fmt(b.startMin)}–{fmt(b.endMin)}
                      </small>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="small-note">
        Pick a duration, tap a free start time, then confirm. Tap your own slot
        to cancel it. Bookings are anonymous — others only see that a slot is
        taken.
      </p>

      {confirm && (
        <div
          className="sheet-back"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirm(null);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true">
            <h3>Book this room?</h3>
            <p className="s-sub">
              {WD[(confirm.day.getDay() + 6) % 7]},{" "}
              {MONTHS[confirm.day.getMonth()]} {confirm.day.getDate()}
            </p>
            <p className="s-label">Your slot</p>
            <div className="sheet-pill">
              {fmt(confirm.start)}–{fmt(confirm.start + dur)} · {durTxt(dur)}
            </div>
            <div className="switch-row sheet-share">
              <div>
                <label htmlFor="booking-share">Can others join you?</label>
                <p>{share ? "Yes — Open to Share" : "No — just me"}</p>
              </div>
              <Switch
                id="booking-share"
                checked={share}
                onCheckedChange={setShare}
              />
            </div>
            <p className="s-sub">
              {share
                ? "Others can check in and sit with you during this time, but no one else can book it. Others only see the slot as booked, never your name."
                : "Holds the whole room for this time — no one else can check in or book it. Others only see the slot as booked, never your name."}
            </p>
            <div className="sheet-actions">
              <button
                className="s-cancel"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="s-go" onClick={confirmReserve} disabled={busy}>
                Confirm booking
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
