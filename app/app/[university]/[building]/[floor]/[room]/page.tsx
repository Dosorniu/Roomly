import { notFound, permanentRedirect } from "next/navigation";
import {
  resolveLegacyRoom,
  roomPath,
  type LegacyRoomParams,
} from "@/services/routes";
export default async function RoomPage({
  params,
}: {
  params: Promise<LegacyRoomParams>;
}) {
  const room = resolveLegacyRoom(await params);
  if (!room) notFound();
  permanentRedirect(roomPath(room));
}
