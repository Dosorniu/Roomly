import { getSupabase, sharedMode } from "./supabase-client";
import { sessionStore } from "./session-store";
import { isStudyState } from "./state-validation";
import type { Booking, MyBooking, Reservation } from "../types/domain";

// Advance room bookings. In shared mode these call the server RPCs, which derive
// the actor from the verified JWT and enforce overlap, duration and campus rules.
// In local demo mode bookings live in this browser only, with the same rules
// applied client-side so the prototype behaves consistently. Bookings are
// anonymous: other students only ever see that a slot is "Booked".

const DEMO_KEY = "cbs-demo-bookings-v1";
const STATE_KEY = "cbs-study-demo-v1"; // demo occupancy, written by repository.ts
const MIN_MS = 1800000; // 30 min
const MAX_MS = 7200000; // 2 h

type DemoBooking = {
  id: string;
  roomId: string;
  userId: string;
  startsAt: number;
  endsAt: number;
};

const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

// Monday to Friday, 08:00–20:00, start and end on the same day.
function withinCampusHours(start: number, end: number) {
  const a = new Date(start);
  const b = new Date(end);
  const day = a.getDay();
  const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
  return (
    day >= 1 &&
    day <= 5 &&
    a.toDateString() === b.toDateString() &&
    minutes(a) >= 480 &&
    minutes(b) <= 1200
  );
}

function readDemo(): DemoBooking[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? value.filter(
          (b): b is DemoBooking =>
            b &&
            typeof b.id === "string" &&
            typeof b.roomId === "string" &&
            typeof b.userId === "string" &&
            typeof b.startsAt === "number" &&
            typeof b.endsAt === "number",
        )
      : [];
  } catch {
    return [];
  }
}

function writeDemo(list: DemoBooking[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  } catch {
    /* Memory mode. */
  }
}

function demoUser() {
  return sessionStore.getSnapshot().userId || "demo";
}

export async function roomBookings(
  roomId: string,
  windowDays = 14,
): Promise<Booking[]> {
  const now = Date.now();
  if (!sharedMode) {
    const horizon = now + windowDays * 86400000;
    return readDemo()
      .filter(
        (b) => b.roomId === roomId && b.endsAt > now && b.startsAt < horizon,
      )
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((b) => ({
        id: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        mine: b.userId === demoUser(),
        by: b.userId === demoUser() ? "You" : "Booked",
      }));
  }
  const { data, error } = await getSupabase().rpc("roomly_bookings", {
    target_room: roomId,
    window_days: windowDays,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Invalid bookings response.");
  return data.map(
    (b: {
      id: string;
      startsAt: number;
      endsAt: number;
      mine: boolean;
      by?: string;
    }) => ({
      id: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      mine: b.mine === true,
      by: b.mine === true ? "You" : "Booked",
    }),
  );
}

// The signed-in student's own upcoming reservations, across every room. Demo mode
// filters this browser's bookings; shared mode calls an authenticated RPC that
// derives the actor from the JWT and scopes to the actor's own rows only.
export async function myBookings(windowDays = 31): Promise<MyBooking[]> {
  const now = Date.now();
  if (!sharedMode) {
    const horizon = now + windowDays * 86400000;
    return readDemo()
      .filter(
        (b) =>
          b.userId === demoUser() && b.endsAt > now && b.startsAt < horizon,
      )
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((b) => ({
        id: b.id,
        roomId: b.roomId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      }));
  }
  const { data, error } = await getSupabase().rpc("roomly_my_bookings", {
    window_days: windowDays,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Invalid bookings response.");
  return data.map(
    (b: { id: string; roomId: string; startsAt: number; endsAt: number }) => ({
      id: b.id,
      roomId: b.roomId,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    }),
  );
}

export async function reserve(
  roomId: string,
  startsAt: number,
  endsAt: number,
): Promise<void> {
  if (!sharedMode) {
    const now = Date.now();
    const duration = endsAt - startsAt;
    if (duration < MIN_MS || duration > MAX_MS)
      throw new Error("A booking must be between 30 minutes and 2 hours.");
    if (startsAt < now - 60000)
      throw new Error("That time has already passed.");
    if (!withinCampusHours(startsAt, endsAt))
      throw new Error("Rooms can be booked Monday to Friday, 08:00–20:00.");
    const list = readDemo();
    if (
      list.some(
        (b) =>
          b.roomId === roomId && b.endsAt > startsAt && b.startsAt < endsAt,
      )
    )
      throw new Error("That slot is already booked.");
    if (
      list.some(
        (b) =>
          b.userId === demoUser() && b.endsAt > startsAt && b.startsAt < endsAt,
      )
    )
      throw new Error("You already have a booking at that time.");
    const occupied = demoSessions().find(
      (s) =>
        s.roomId === roomId &&
        s.expectedEnd > startsAt &&
        s.startedAt < endsAt &&
        !s.members.includes(demoUser()),
    );
    if (occupied)
      throw new Error(
        `Someone is checked in until ${hhmm(occupied.expectedEnd)}.`,
      );
    list.push({
      id: crypto.randomUUID(),
      roomId,
      userId: demoUser(),
      startsAt,
      endsAt,
    });
    writeDemo(list);
    return;
  }
  const { error } = await getSupabase().rpc("roomly_reserve", {
    target_room: roomId,
    p_start: startsAt,
    p_end: endsAt,
  });
  if (error) throw new Error(error.message);
}

export async function cancelBooking(id: string): Promise<void> {
  if (!sharedMode) {
    writeDemo(
      readDemo().filter((b) => !(b.id === id && b.userId === demoUser())),
    );
    return;
  }
  const { error } = await getSupabase().rpc("roomly_cancel_booking", {
    booking_id: id,
  });
  if (error) throw new Error(error.message);
}

// Demo occupancy, read straight from storage to avoid a circular import with
// the repository. Each session carries the ids of the students in it.
function demoSessions() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (!isStudyState(state)) return [];
    return state.sessions.map((s) => ({
      ...s,
      members: state.memberships
        .filter((m) => m.sessionId === s.id)
        .map((m) => m.userId),
    }));
  } catch {
    return [];
  }
}

// Demo bookings for the next 24 hours as anonymous reservations, so room status
// and check-in respect them exactly like the shared snapshot does.
export function demoReservations(now = Date.now()): Reservation[] {
  const me = demoUser();
  return readDemo()
    .filter((b) => b.endsAt > now && b.startsAt < now + 86400000)
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((b) => ({
      roomId: b.roomId,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      mine: b.userId === me,
    }));
}
