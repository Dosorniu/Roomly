export type Status = "free" | "share" | "occupied" | "unknown";
export interface University {
  id: string;
  name: string;
  slug: string;
}
export interface Campus {
  id: string;
  universityId: string;
  name: string;
}
export interface Building {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  image: string;
}
export interface Floor {
  id: string;
  buildingId: string;
  number: number;
  name: string;
}
export interface Room {
  id: string;
  floorId: string;
  name: string;
  number: string;
  type: string;
  capacity: number;
  features: string[];
  enabled: boolean;
}
export interface User {
  id: string;
  displayName: string;
  universityId: string;
}
export interface RoomSession {
  occupantCount?: number;
  // Display names of occupants, present only for rooms open to sharing and only in
  // the authenticated snapshot. Empty for non-shared rooms and the public view.
  occupants?: string[];
  id: string;
  roomId: string;
  holderId: string;
  startedAt: number;
  expectedEnd: number;
  openToShare: boolean;
}
export interface RoomMembership {
  sessionId: string;
  userId: string;
  joinedAt: number;
}
export interface Observation {
  roomId: string;
  status: "free" | "unknown";
  updatedAt: number;
}
export interface StudyState {
  sessions: RoomSession[];
  memberships: RoomMembership[];
  observations: Observation[];
  revision: number;
}
export interface RoomView {
  room: Room;
  status: Status;
  count: number;
  session?: RoomSession;
  updatedAt: number;
}
export interface Booking {
  id: string;
  startsAt: number;
  endsAt: number;
  mine: boolean;
  // Short display name of who booked the slot ("You" for the actor's own).
  // Visible to signed-in students only; never includes an email address.
  by: string;
}
// One of the signed-in student's own reservations, across any room. Used by the
// "My bookings" view, which resolves roomId to a room via the catalog.
export interface MyBooking {
  id: string;
  roomId: string;
  startsAt: number;
  endsAt: number;
}
