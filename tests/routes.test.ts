import assert from "node:assert/strict";
import { rooms, buildings } from "../data/catalog";
import { findRoom, resolveLegacyRoom, roomPath } from "../services/routes";
const room = rooms.find((r) => r.id === "214")!;
assert.equal(roomPath(room), "/rooms/214");
assert.equal(findRoom("missing"), undefined);
const params = {
  university: "cbs",
  building: "main-building",
  floor: "2",
  room: "room-214",
};
assert.equal(resolveLegacyRoom(params)?.id, "214");
for (const bad of [
  { university: "other" },
  { building: "other" },
  { floor: "1" },
  { room: "room-missing" },
])
  assert.equal(resolveLegacyRoom({ ...params, ...bad }), undefined);
const oldSlug = buildings[0].slug;
try {
  buildings[0].slug = "renamed-building";
  assert.equal(roomPath(room), "/rooms/214");
  assert.equal(resolveLegacyRoom(params)?.id, "214");
} finally {
  buildings[0].slug = oldSlug;
}
const wasEnabled = room.enabled;
try {
  room.enabled = false;
  assert.equal(findRoom("214"), undefined);
  assert.equal(resolveLegacyRoom(params), undefined);
} finally {
  room.enabled = wasEnabled;
}
console.log(
  "PASS: canonical room IDs, hierarchical legacy resolution, renamed building aliases, disabled and missing rooms.",
);
