import {
  floors,
  buildings,
  campuses,
  universities,
  rooms,
} from "../data/catalog";
import type { Room } from "../types/domain";
// Printed QR links use immutable IDs, independent of display names and slugs.
export function roomPath(room: Room) {
  return `/rooms/${encodeURIComponent(room.id)}`;
}
export function findRoom(id: string) {
  return rooms.find((room) => room.id === id && room.enabled);
}
export type LegacyRoomParams = {
  university: string;
  building: string;
  floor: string;
  room: string;
};
// Keep historical aliases when changing catalog slugs.
const universityAliases: Record<string, string> = { cbs: "cbs" };
const buildingAliases: Record<string, string> = {
  "main-building": "main-building",
};
export function resolveLegacyRoom(params: LegacyRoomParams) {
  const university = universities.find(
    (u) =>
      u.slug === params.university ||
      u.id === universityAliases[params.university],
  );
  const building = buildings.find(
    (b) =>
      b.slug === params.building || b.id === buildingAliases[params.building],
  );
  if (
    !university ||
    !building ||
    !campuses.some(
      (c) => c.id === building.campusId && c.universityId === university.id,
    )
  )
    return undefined;
  const floor = floors.find(
    (f) => f.buildingId === building.id && String(f.number) === params.floor,
  );
  if (!floor || !params.room.startsWith("room-")) return undefined;
  const room = findRoom(params.room.slice(5));
  return room?.floorId === floor.id ? room : undefined;
}
