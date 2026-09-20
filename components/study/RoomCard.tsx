import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { floors } from '@/data/catalog';
import { roomPath } from '@/services/routes';
import type { RoomView } from '@/types/domain';
import { StatusBadge } from './StatusBadge';
export const timeLabel=(time:number)=>new Date(time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
export function RoomCard({view}:{view:RoomView}) {
  const {room,status,session,count}=view;
  return <Link className="room-row" href={roomPath(room)}><div className="room-row-name"><h3>{room.name}</h3><p>{room.number} <span>·</span> {floors.find(f=>f.id===room.floorId)?.name}</p></div><span className="room-row-capacity" aria-label={session?`${count} of ${room.capacity} occupants`:`Capacity ${room.capacity}`}><Users size={17}/>{session?`${count}/${room.capacity}`:room.capacity}</span><div className="room-row-state"><StatusBadge status={status}/>{session&&<span className="row-time">Until ~{timeLabel(session.expectedEnd)}</span>}</div><ChevronRight className="row-chevron" size={17}/></Link>;
}
