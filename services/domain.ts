import type { Room, RoomView, StudyState } from "../types/domain";
export const FREE_FRESHNESS_MS = 30 * 60_000;
export type Command =
  | {
      type: "checkIn";
      roomId: string;
      userId: string;
      minutes: number;
      openToShare: boolean;
      confirmedEmpty?: boolean;
    }
  | { type: "join" | "leave"; roomId: string; userId: string }
  | {
      type: "update";
      roomId: string;
      userId: string;
      minutes: number;
      openToShare: boolean;
    };
export function expire(state: StudyState, now: number): StudyState {
  const expired = state.sessions.filter((s) => s.expectedEnd <= now);
  const stale = state.observations.some(
    (o) => o.status === "free" && now - o.updatedAt >= FREE_FRESHNESS_MS,
  );
  if (!expired.length && !stale) return state;
  const ids = new Set(expired.map((s) => s.id));
  return {
    ...state,
    revision: state.revision + 1,
    sessions: state.sessions.filter((s) => !ids.has(s.id)),
    memberships: state.memberships.filter((m) => !ids.has(m.sessionId)),
    observations: [
      ...state.observations
        .filter((o) => !expired.some((s) => s.roomId === o.roomId))
        .map((o) =>
          o.status === "free" && now - o.updatedAt >= FREE_FRESHNESS_MS
            ? { ...o, status: "unknown" as const }
            : o,
        ),
      ...expired.map((s) => ({
        roomId: s.roomId,
        status: "unknown" as const,
        updatedAt: now,
      })),
    ],
  };
}
const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
// Someone else's bookings that overlap [from, to), earliest first.
function othersReservations(
  state: StudyState,
  roomId: string,
  from: number,
  to: number,
) {
  return (state.reservations ?? [])
    .filter(
      (r) =>
        r.roomId === roomId && !r.mine && r.endsAt > from && r.startsAt < to,
    )
    .sort((a, b) => a.startsAt - b.startsAt);
}
// A private booking by someone else blocks check-in for that time.
export function blockingReservation(
  state: StudyState,
  roomId: string,
  from: number,
  to: number,
) {
  return othersReservations(state, roomId, from, to).find((r) => !r.share);
}
// A shared booking by someone else lets you in, but only open to others.
export function sharedReservation(
  state: StudyState,
  roomId: string,
  from: number,
  to: number,
) {
  return othersReservations(state, roomId, from, to).find((r) => r.share);
}
export function viewRoom(state: StudyState, room: Room, now: number): RoomView {
  const session = state.sessions.find(
    (s) => s.roomId === room.id && s.expectedEnd > now,
  );
  // A booking running right now. Someone else's makes the room occupied (or
  // open to share when booked with "Others can join"); your own leaves it free
  // for you so you can check in.
  const reservation = session
    ? undefined
    : (state.reservations ?? []).find(
        (r) => r.roomId === room.id && r.startsAt <= now && r.endsAt > now,
      );
  // Product model: a room is Free unless someone has an active session in it
  // or someone else has booked it for right now.
  return {
    room,
    session,
    reservation,
    status: session
      ? session.openToShare
        ? "share"
        : "occupied"
      : reservation && !reservation.mine
        ? reservation.share
          ? "share"
          : "occupied"
        : "free",
    count: session
      ? (session.occupantCount ??
        state.memberships.filter((m) => m.sessionId === session.id).length)
      : 0,
    updatedAt: session?.startedAt ?? 0,
  };
}
export function applyCommand(
  input: StudyState,
  catalog: Room[],
  cmd: Command,
  now: number,
  id: string,
): StudyState {
  const state = structuredClone(expire(input, now));
  const room = catalog.find((r) => r.id === cmd.roomId && r.enabled);
  if (!room) throw Error("This room is unavailable.");
  if (!cmd.userId) throw Error("Sign in before updating a room.");
  if (!["checkIn", "join", "leave", "update"].includes(cmd.type))
    throw Error("Unknown room command.");
  const v = viewRoom(state, room, now);
  const s = v.session;
  const member =
    s &&
    state.memberships.find(
      (m) => m.sessionId === s.id && m.userId === cmd.userId,
    );
  if (cmd.type === "checkIn" || cmd.type === "update") {
    if (!Number.isInteger(cmd.minutes) || cmd.minutes < 1 || cmd.minutes > 480)
      throw Error("Choose a duration between 1 and 480 minutes.");
    if (typeof cmd.openToShare !== "boolean")
      throw Error("Choose whether others can join.");
  }
  if (cmd.type === "checkIn" || cmd.type === "join") {
    if (state.memberships.some((m) => m.userId === cmd.userId))
      throw Error("Leave your current room before joining another.");
  }
  // The booker arriving while someone already sits in their shared room joins
  // that session instead of starting a new one.
  const bookedHere = (state.reservations ?? []).some(
    (r) =>
      r.roomId === room.id && r.mine && r.startsAt <= now && r.endsAt > now,
  );
  if (cmd.type === "checkIn" && s && bookedHere)
    return applyCommand(
      state,
      catalog,
      { type: "join", roomId: cmd.roomId, userId: cmd.userId },
      now,
      id,
    );
  if (cmd.type === "checkIn" || cmd.type === "update") {
    if (
      !cmd.openToShare &&
      sharedReservation(state, room.id, now, now + cmd.minutes * 60_000)
    )
      throw Error("This room is booked as shared. Keep it open to others.");
    const block = blockingReservation(
      state,
      room.id,
      now,
      now + cmd.minutes * 60_000,
    );
    if (block)
      throw Error(
        block.startsAt <= now
          ? `This room is reserved until ${hhmm(block.endsAt)}.`
          : `This room is booked from ${hhmm(block.startsAt)}. Choose a shorter stay.`,
      );
  }
  if (cmd.type === "checkIn") {
    if (s)
      throw Error(
        "Someone has already checked in. Please review the updated room.",
      );
    state.sessions.push({
      id,
      roomId: room.id,
      holderId: cmd.userId,
      startedAt: now,
      expectedEnd: now + cmd.minutes * 60_000,
      openToShare: cmd.openToShare,
    });
    state.memberships.push({
      sessionId: id,
      userId: cmd.userId,
      joinedAt: now,
    });
    state.observations = state.observations.filter((o) => o.roomId !== room.id);
  } else if (cmd.type === "join") {
    if (!s || !s.openToShare)
      throw Error("This room is no longer open to sharing.");
    if (v.count >= room.capacity)
      throw Error("This room has reached its capacity.");
    state.memberships.push({
      sessionId: s.id,
      userId: cmd.userId,
      joinedAt: now,
    });
  } else if (cmd.type === "update") {
    if (!s || s.holderId !== cmd.userId)
      throw Error("Only the current room holder can update this session.");
    s.expectedEnd = now + cmd.minutes * 60_000;
    s.openToShare = cmd.openToShare;
  } else if (cmd.type === "leave") {
    if (!s || !member) throw Error("You are not checked into this room.");
    state.memberships = state.memberships.filter(
      (m) => !(m.sessionId === s.id && m.userId === cmd.userId),
    );
    const remaining = state.memberships
      .filter((m) => m.sessionId === s.id)
      .sort(
        (a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId),
      );
    if (!remaining.length) {
      state.sessions = state.sessions.filter((x) => x.id !== s.id);
      state.observations.push({
        roomId: room.id,
        status: "free",
        updatedAt: now,
      });
    } else if (s.holderId === cmd.userId) s.holderId = remaining[0].userId;
  }
  state.revision++;
  return state;
}
