import { notFound } from "next/navigation";
import { StudyApp } from "@/components/study/StudyApp";
import { findRoom } from "@/services/routes";
export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const room = findRoom((await params).id);
  if (!room) notFound();
  return <StudyApp roomId={room.id} />;
}
