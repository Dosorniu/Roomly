import { rooms, users } from "../data/catalog";
import { viewRoom } from "./domain";
import type { StudyState, Status } from "../types/domain";

export type Notice = { id: string; roomId: string; text: string };
export type SessionSnapshot = {
  ready: boolean;
  now: number;
  userId: string;
  accessGranted: boolean;
  watches: string[];
  notices: Notice[];
  error: string | null;
};
const initial: SessionSnapshot = {
  ready: false,
  now: 0,
  userId: "student-A",
  accessGranted: false,
  watches: [],
  notices: [],
  error: null,
};
let current = initial;
let allWatches: Record<string, string[]> = {};
const allNotices: Record<string, Notice[]> = {};
let previous: Record<string, Status> = {};
const listeners = new Set<() => void>();
export const sessionStore = {
  getSnapshot: () => current,
  getServerSnapshot: () => initial,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set(patch: Partial<SessionSnapshot>) {
    current = { ...current, ...patch };
    listeners.forEach((fn) => fn());
  },
};
function validWatches(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([id]) => users.some((u) => u.id === id))
      .map(([id, value]) => [
        id,
        Array.isArray(value)
          ? value.filter(
              (v): v is string =>
                typeof v === "string" && rooms.some((r) => r.id === v),
            )
          : [],
      ]),
  );
}
export function startDemoSession() {
  try {
    allWatches = validWatches(
      JSON.parse(localStorage.getItem("cbs-demo-watches") || "{}"),
    );
  } catch {
    allWatches = {};
  }
  let id = "student-A";
  try {
    const saved = sessionStorage.getItem("cbs-demo-user");
    if (users.some((u) => u.id === saved)) id = saved!;
  } catch {
    /* Memory mode. */
  }
  previous = {};
  switchDemoUser(id);
  sessionStore.set({
    ready: true,
    now: Date.now(),
    accessGranted: true,
    error: null,
  });
}
export function switchDemoUser(userId: string) {
  if (!users.some((u) => u.id === userId)) return;
  try {
    sessionStorage.setItem("cbs-demo-user", userId);
  } catch {
    /* Memory mode. */
  }
  sessionStore.set({
    userId,
    accessGranted: true,
    watches: allWatches[userId] || [],
    notices: allNotices[userId] || [],
  });
}
export function toggleDemoWatch(roomId: string) {
  const { userId, watches } = current;
  allWatches[userId] = watches.includes(roomId)
    ? watches.filter((id) => id !== roomId)
    : [...watches, roomId];
  try {
    localStorage.setItem("cbs-demo-watches", JSON.stringify(allWatches));
  } catch {
    /* Memory mode. */
  }
  sessionStore.set({ watches: allWatches[userId] });
}
export function observeDemoState(state: StudyState) {
  const now = Date.now();
  for (const room of rooms) {
    const status = viewRoom(state, room, now).status;
    if (
      status === "free" &&
      previous[room.id] &&
      previous[room.id] !== "free"
    ) {
      for (const [userId, ids] of Object.entries(allWatches))
        if (ids.includes(room.id)) {
          allNotices[userId] = [
            {
              id: crypto.randomUUID(),
              roomId: room.id,
              text: `${room.name} · ${room.number} is now free.`,
            },
            ...(allNotices[userId] || []),
          ].slice(0, 50);
        }
    }
    previous[room.id] = status;
  }
  sessionStore.set({ now, notices: allNotices[current.userId] || [] });
}
