"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Clock,
  Building2,
  Bell,
  ShieldCheck,
  LogOut,
  Pencil,
  DoorOpen,
  Check,
} from "lucide-react";
import { floors, buildings } from "@/data/catalog";
import type { RoomView, StudyState } from "@/types/domain";
import type { Command } from "@/services/domain";
import { StatusBadge } from "./StatusBadge";
import { CheckInModal } from "./CheckInModal";
import { BookingCalendar } from "./BookingCalendar";
import { timeLabel } from "./RoomCard";

export function RoomDetails({
  view,
  state,
  userId,
  onSubmit,
  watching,
  onWatch,
  now,
  shared,
  canInteract,
  onRequireAuth,
}: {
  now: number;
  shared: boolean;
  canInteract: boolean;
  onRequireAuth: () => void;
  view: RoomView;
  state: StudyState;
  userId: string;
  onSubmit: (c: Command) => Promise<boolean>;
  watching: boolean;
  onWatch: () => void;
}) {
  const [modal, setModal] = useState<"checkIn" | "update" | null>(null);
  const [busy, setBusy] = useState(false);
  const { room, status, session, count, reservation } = view;
  // A booking running now: someone else's blocks the room (or, when booked with
  // "Others can join", lets you check in alongside); your own is yours to use.
  const reservedByOther =
    !!reservation && !reservation.mine && !reservation.share;
  const sharedBooking =
    !!reservation && !reservation.mine && !!reservation.share;
  const myReservation = !!reservation && reservation.mine;
  const floor = floors.find((f) => f.id === room.floorId)!;
  const building = buildings.find((b) => b.id === floor.buildingId)!;
  const member =
    !!session &&
    state.memberships.some(
      (m) => m.sessionId === session.id && m.userId === userId,
    );
  const holder = session?.holderId === userId;
  const other = state.memberships.some((m) => m.userId === userId) && !member;

  const requireInteractionAccess = () => {
    if (canInteract) return true;
    onRequireAuth();
    return false;
  };

  const action = async (type: "join" | "leave") => {
    if (!requireInteractionAccess()) return;
    setBusy(true);
    await onSubmit({ type, userId, roomId: room.id });
    setBusy(false);
  };

  return (
    <section className="detail-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={17} /> All study spaces
      </Link>
      <div className="detail-grid">
        <article className="detail-main">
          <div className="detail-heading">
            <StatusBadge
              status={status}
              label={reservedByOther ? "Reserved" : undefined}
            />
            <span className="room-number">ROOM {room.number}</span>
          </div>
          <h1>{room.name}</h1>
          <p>
            {room.type} · {floor.name} · {building.name}
          </p>
          <div className="detail-metrics">
            <div>
              <Users size={22} />
              <strong>
                {session ? `${count} / ${room.capacity}` : room.capacity}
              </strong>
              <span>
                {session ? "registered occupants" : "person capacity"}
              </span>
            </div>
            <div>
              <Clock size={22} />
              <strong>
                {session
                  ? timeLabel(session.expectedEnd)
                  : reservation
                    ? timeLabel(reservation.endsAt)
                    : status === "free"
                      ? "Now"
                      : "Unconfirmed"}
              </strong>
              <span>
                {session
                  ? "estimated session end"
                  : reservedByOther || sharedBooking
                    ? "reserved until"
                    : myReservation
                      ? "your booking ends"
                      : status === "free"
                        ? "available to check in"
                        : "please check in person"}
              </span>
            </div>
          </div>
          <h2>In this space</h2>
          <div className="amenities">
            {room.features.map((f) => (
              <span key={f}>
                <Check size={16} />
                {f}
              </span>
            ))}
          </div>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>
              Roomly is anonymous: everyone sees only whether a room is free,
              shared, occupied or booked, and how many people are inside — never
              names or email addresses.
            </p>
          </div>
          <div className="location-line">
            <Building2 size={19} />
            <span>
              Main Campus · {building.name} · {floor.name}
            </span>
          </div>
        </article>
        <aside className="session-panel">
          <span className="eyebrow">
            {member ? "YOUR STUDY SESSION" : "USE THIS SPACE"}
          </span>
          <h2>
            {member
              ? holder
                ? "You’re the room holder."
                : "You’ve joined this room."
              : reservedByOther
                ? "This room is booked."
                : sharedBooking
                  ? "Booked, open to share."
                  : myReservation
                    ? "Your booking is running."
                    : status === "free"
                      ? "A space of your own."
                      : status === "share"
                        ? "A table worth sharing."
                        : status === "occupied"
                          ? "A session is in progress."
                          : "No recent update."}
          </h2>
          <p>
            {member
              ? holder
                ? "You can change the time and choose whether others can join."
                : "The room holder manages the end time and sharing preference."
              : reservedByOther
                ? `Someone reserved it until ${timeLabel(reservation!.endsAt)}. Pick a free slot in the calendar below.`
                : sharedBooking
                  ? `Someone booked it until ${timeLabel(reservation!.endsAt)} and others can join. Check in if you are here.`
                  : myReservation
                    ? "Check in when you arrive so others see the room is in use."
                    : status === "free"
                      ? "Already here? Check in so others know the room is in use."
                      : status === "share"
                        ? "Join if you are here and there is a seat available."
                        : status === "occupied"
                          ? "This room is currently closed to additional participants."
                          : "Check the room in person before starting a session."}
          </p>

          {shared && !canInteract && (
            <p className="session-reminder">
              Browsing is public. Sign in with a verified email to check in,
              join rooms or create availability alerts.
            </p>
          )}

          {member && session && session.expectedEnd - now < 300000 && (
            <div className="session-reminder">
              Your session ends soon.{" "}
              {holder
                ? "Extend your time or leave when finished."
                : "Ask the holder to extend if needed."}
            </div>
          )}
          {other && (
            <p className="session-reminder">
              You are registered in another room. Leave it before checking in
              here.
            </p>
          )}

          {!member &&
            (status === "free" ||
              status === "unknown" ||
              (sharedBooking && !session)) && (
              <button
                className="primary-button full"
                disabled={canInteract && other}
                onClick={() => {
                  if (requireInteractionAccess()) setModal("checkIn");
                }}
              >
                <DoorOpen size={18} /> Check In
              </button>
            )}

          {!member && status === "share" && !!session && (
            <button
              className="primary-button full"
              disabled={
                canInteract && (busy || other || count >= room.capacity)
              }
              onClick={() => action("join")}
            >
              <Users size={18} />
              {count >= room.capacity ? "Room at capacity" : "Join Room"}
            </button>
          )}

          {holder && (
            <button
              className="primary-button full"
              onClick={() => {
                if (requireInteractionAccess()) setModal("update");
              }}
            >
              <Pencil size={17} /> Update Status
            </button>
          )}

          {member && (
            <button
              className="secondary-button full"
              disabled={busy}
              onClick={() => action("leave")}
            >
              <LogOut size={17} /> Leave Room
            </button>
          )}

          {!member && status !== "free" && (
            <button
              className="secondary-button full"
              aria-pressed={canInteract ? watching : false}
              onClick={() => {
                if (requireInteractionAccess()) onWatch();
              }}
            >
              <Bell size={17} />
              {canInteract && watching
                ? "Notification on"
                : "Notify me when free"}
            </button>
          )}

          {member && (
            <p className="small-note">
              {holder
                ? "If you leave first, the next participant becomes the holder."
                : "Leaving removes only you from this session."}
            </p>
          )}

          <div className="small-note session-disclaimer">
            {shared
              ? "Student-reported estimates, not bookings. Room status is public; room actions require a verified account."
              : "Student-reported estimates, not bookings. Demo changes are shared across tabs in this browser."}
          </div>
        </aside>
      </div>

      <BookingCalendar
        roomId={room.id}
        shared={shared}
        canInteract={canInteract}
        onRequireAuth={onRequireAuth}
      />

      {modal && (
        <CheckInModal
          view={view}
          userId={userId}
          editing={modal === "update"}
          onClose={() => setModal(null)}
          onSubmit={onSubmit}
        />
      )}
    </section>
  );
}
