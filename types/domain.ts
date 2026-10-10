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
// An advance booking as the room status sees it: anonymous, no user id or name.
// `mine` is true only for the signed-in student's own booking.
export interface Reservation {
  roomId: string;
  startsAt: number;
  endsAt: number;
  mine?: boolean;
  // "Others can join": other students may check in while it runs.
  share?: boolean;
}
export interface StudyState {
  sessions: RoomSession[];
  memberships: RoomMembership[];
  observations: Observation[];
  // Bookings for roughly the next 24 hours, so status and check-in respect them.
  reservations?: Reservation[];
  revision: number;
}
export interface RoomView {
  room: Room;
  status: Status;
  count: number;
  session?: RoomSession;
  // A booking that is running right now (and no one is checked in).
  reservation?: Reservation;
  updatedAt: number;
}
export interface Booking {
  id: string;
  startsAt: number;
  endsAt: number;
  mine: boolean;
  share?: boolean;
  // "You" for your own booking, "Booked" for anyone else's. Bookings are
  // anonymous: no names or emails are ever shown.
  by: string;
}
// One of the signed-in student's own reservations, across any room. Used by the
// "My bookings" view, which resolves roomId to a room via the catalog.
export interface MyBooking {
  id: string;
  roomId: string;
  startsAt: number;
  endsAt: number;
  share?: boolean;
}
