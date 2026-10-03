import { getSupabase, sharedMode } from "./supabase-client";
import { sessionStore } from "./session-store";
import { users } from "../data/catalog";
import type { Booking } from "../types/domain";

// Advance room bookings. In shared mode these call the server RPCs, which derive
// the actor from the verified JWT and enforce overlap, duration and campus rules.
// In local demo mode bookings live in this browser only, with the same rules
// applied client-side so the prototype behaves consistently.

const DEMO_KEY = "cbs-demo-bookings-v1";
const MIN_MS = 900000; // 15 min
const MAX_MS = 14400000; // 4 h

type DemoBooking = {
  id: string;
  roomId: string;
  userId: string;
  startsAt: number;
  endsAt: number;
  by?: string;
};

function demoName(userId: string) {
  return users.find((u) => u.id === userId)?.displayName ?? "Student";
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
            typeof b.endsAt === "number" &&
            (b.by === undefined || typeof b.by === "string"),
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
      .filter((b) => b.roomId === roomId && b.endsAt > now && b.startsAt < horizon)
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((b) => ({
        id: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        mine: b.userId === demoUser(),
        by: b.userId === demoUser() ? "You" : (b.by ?? demoName(b.userId)),
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
      by: b.mine === true ? "You" : (b.by ?? "Student"),
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
      throw new Error("A booking must be between 15 minutes and 4 hours.");
    if (startsAt < now - 60000) throw new Error("That time has already passed.");
    const list = readDemo();
    if (
      list.some(
        (b) => b.roomId === roomId && b.endsAt > startsAt && b.startsAt < endsAt,
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
    list.push({
      id: crypto.randomUUID(),
      roomId,
      userId: demoUser(),
      startsAt,
      endsAt,
      by: demoName(demoUser()),
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
    writeDemo(readDemo().filter((b) => !(b.id === id && b.userId === demoUser())));
    return;
  }
  const { error } = await getSupabase().rpc("roomly_cancel_booking", {
    booking_id: id,
  });
  if (error) throw new Error(error.message);
}
