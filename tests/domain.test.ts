import assert from "node:assert/strict";
import { createSeed, rooms } from "../data/catalog";
import {
  applyCommand,
  expire,
  viewRoom,
  FREE_FRESHNESS_MS,
  type Command,
} from "../services/domain";
const now = 1000000;
let state = createSeed(now);
const room = rooms.find((r) => r.id === "112")!;
const run = (cmd: Command, t = now) => {
  state = applyCommand(state, rooms, cmd, t, "session-" + state.revision);
};
run({
  type: "checkIn",
  roomId: room.id,
  userId: "A",
  minutes: 60,
  openToShare: true,
});
assert.equal(viewRoom(state, room, now).status, "share");
assert.throws(
  () =>
    run({
      type: "checkIn",
      roomId: room.id,
      userId: "B",
      minutes: 30,
      openToShare: true,
    }),
  /already checked in/,
);
run({ type: "join", roomId: room.id, userId: "B" }, now + 1);
assert.equal(viewRoom(state, room, now).count, 2);
assert.throws(
  () => run({ type: "join", roomId: "214", userId: "B" }),
  /Leave your current room/,
);
assert.throws(
  () =>
    run({
      type: "update",
      roomId: room.id,
      userId: "B",
      minutes: 30,
      openToShare: false,
    }),
  /Only the current room holder/,
);
run({ type: "leave", roomId: room.id, userId: "A" });
assert.equal(viewRoom(state, room, now).session?.holderId, "B");
assert.equal(viewRoom(state, room, now).status, "share");
run({
  type: "update",
  roomId: room.id,
  userId: "B",
  minutes: 30,
  openToShare: false,
});
assert.equal(viewRoom(state, room, now).status, "occupied");
assert.throws(
  () => run({ type: "join", roomId: room.id, userId: "C" }),
  /no longer open/,
);
run({ type: "leave", roomId: room.id, userId: "B" });
assert.equal(viewRoom(state, room, now).status, "free");
// After a session expires, with no one checked in, the room reads as Free again.
assert.equal(
  viewRoom(
    expire(state, now + FREE_FRESHNESS_MS),
    room,
    now + FREE_FRESHNESS_MS,
  ).status,
  "free",
);
const unknown = rooms.find((r) => r.id === "321")!;
assert.throws(
  () =>
    run({
      type: "checkIn",
      roomId: unknown.id,
      userId: "C",
      minutes: 1,
      openToShare: true,
    }),
  /Confirm the room is empty/,
);
run({
  type: "checkIn",
  roomId: unknown.id,
  userId: "C",
  minutes: 1,
  openToShare: true,
  confirmedEmpty: true,
});
state = expire(state, now + 60000);
assert.equal(viewRoom(state, unknown, now + 60000).status, "free");
assert.ok(!state.memberships.some((m) => m.userId === "C"));
for (const minutes of [NaN, 0, -1, 481, 1.5, Infinity])
  assert.throws(
    () =>
      run({
        type: "checkIn",
        roomId: room.id,
        userId: "C",
        minutes,
        openToShare: true,
      }),
    /duration between/,
  );
const tiny = rooms.find((r) => r.id === "118")!;
run({
  type: "checkIn",
  roomId: tiny.id,
  userId: "D",
  minutes: 60,
  openToShare: true,
});
run({ type: "join", roomId: tiny.id, userId: "E" });
assert.throws(
  () => run({ type: "join", roomId: tiny.id, userId: "F" }),
  /reached its capacity/,
);
assert.equal(viewRoom(state, tiny, now).count, 2);
console.log(
  "PASS: check-in, collision rejection, join, single active membership, holder permissions and transfer, privacy status, last leave, free freshness, unknown confirmation, expiration, duration validation, capacity.",
);

const before = structuredClone(state);
assert.throws(
  () => run({ type: "join", roomId: "missing", userId: "G" }),
  /unavailable/,
);
assert.deepEqual(state, before, "Rejected commands must not mutate state");
assert.throws(
  () => run({ type: "leave", roomId: tiny.id, userId: "outsider" }),
  /not checked into/,
);

// Reservations: someone else's booking blocks check-in and extensions; your own
// does not. A booking running now marks the room occupied for others only.
{
  const base = createSeed(now);
  const r = rooms.find((x) => x.id === "301")!;
  const withRes = (mine: boolean, startsAt: number, endsAt: number) => ({
    ...base,
    reservations: [{ roomId: r.id, startsAt, endsAt, mine }],
  });
  const checkIn = (minutes: number): Command => ({
    type: "checkIn",
    roomId: r.id,
    userId: "R",
    minutes,
    openToShare: false,
    confirmedEmpty: true,
  });

  const runningOther = withRes(false, now - 60_000, now + 3_600_000);
  assert.equal(viewRoom(runningOther, r, now).status, "occupied");
  assert.ok(viewRoom(runningOther, r, now).reservation);
  assert.throws(
    () => applyCommand(runningOther, rooms, checkIn(30), now, "x"),
    /reserved until/,
  );

  const runningMine = withRes(true, now - 60_000, now + 3_600_000);
  assert.equal(viewRoom(runningMine, r, now).status, "free");
  applyCommand(runningMine, rooms, checkIn(30), now, "x");

  const later = withRes(false, now + 1_800_000, now + 5_400_000);
  assert.equal(viewRoom(later, r, now).status, "free");
  assert.throws(
    () => applyCommand(later, rooms, checkIn(60), now, "x"),
    /booked from/,
  );
  const short = applyCommand(later, rooms, checkIn(20), now, "x");
  assert.throws(
    () =>
      applyCommand(
        short,
        rooms,
        {
          type: "update",
          roomId: r.id,
          userId: "R",
          minutes: 60,
          openToShare: false,
        },
        now + 1,
        "y",
      ),
    /booked from/,
  );
  console.log(
    "PASS: reservations block check-in and extensions for others, not for the booker; running bookings show occupied.",
  );
}
