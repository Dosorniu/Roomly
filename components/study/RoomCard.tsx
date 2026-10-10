import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { floors } from "@/data/catalog";
import { roomPath } from "@/services/routes";
import type { RoomView } from "@/types/domain";
import { StatusBadge } from "./StatusBadge";
export const timeLabel = (time: number) =>
  new Date(time).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
export function RoomCard({ view }: { view: RoomView }) {
  const { room, status, session, count, reservation } = view;
  const reserved = !session && !!reservation && !reservation.mine;
  return (
    <Link className="room-row" href={roomPath(room)}>
      <div className="rc-top">
        <div className="rc-head">
          <h3>{room.name}</h3>
          <p>
            {room.number} <span>·</span>{" "}
            {floors.find((f) => f.id === room.floorId)?.name}
          </p>
        </div>
        <StatusBadge
          status={status}
          label={reserved ? "Reserved" : undefined}
        />
      </div>
      <div className="rc-foot">
        <span
          className="rc-count"
          aria-label={
            session
              ? `${count} of ${room.capacity} occupants`
              : `Capacity ${room.capacity}`
          }
        >
          <Users size={17} />
          {session ? `${count}/${room.capacity}` : room.capacity}
        </span>
        <span
          className={`rc-go${status === "free" ? "" : " ghost"}`}
          aria-hidden
        >
          <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}
