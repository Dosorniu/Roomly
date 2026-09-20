import type { Room, RoomView, StudyState } from '../types/domain';
export const FREE_FRESHNESS_MS = 30 * 60_000;
export type Command =
 | { type: 'checkIn'; roomId: string; userId: string; minutes: number; openToShare: boolean; confirmedEmpty?: boolean }
 | { type: 'join' | 'leave'; roomId: string; userId: string }
 | { type: 'update'; roomId: string; userId: string; minutes: number; openToShare: boolean };
export function expire(state: StudyState, now: number): StudyState {
 const expired = state.sessions.filter(s => s.expectedEnd <= now);
 const stale = state.observations.some(o => o.status === 'free' && now-o.updatedAt >= FREE_FRESHNESS_MS);
 if (!expired.length && !stale) return state;
 const ids = new Set(expired.map(s=>s.id));
 return {...state, revision:state.revision+1,sessions:state.sessions.filter(s=>!ids.has(s.id)),memberships:state.memberships.filter(m=>!ids.has(m.sessionId)),observations:[...state.observations.filter(o=>!expired.some(s=>s.roomId===o.roomId)).map(o=>o.status==='free'&&now-o.updatedAt>=FREE_FRESHNESS_MS?{...o,status:'unknown' as const}:o),...expired.map(s=>({roomId:s.roomId,status:'unknown' as const,updatedAt:now}))]};
}
export function viewRoom(state: StudyState, room: Room, now: number): RoomView {
 const session=state.sessions.find(s=>s.roomId===room.id && s.expectedEnd>now);
 const observation=state.observations.find(o=>o.roomId===room.id);
 return {room, session, status:session?(session.openToShare?'share':'occupied'):(observation?.status==='free' && now-observation.updatedAt<FREE_FRESHNESS_MS?'free':'unknown'), count:session?state.memberships.filter(m=>m.sessionId===session.id).length:0,updatedAt:session?.startedAt??observation?.updatedAt??0};
}
export function applyCommand(input: StudyState, catalog: Room[], cmd: Command, now: number, id: string): StudyState {
 const state=structuredClone(expire(input,now)); const room=catalog.find(r=>r.id===cmd.roomId && r.enabled);
 if (!room) throw Error('This room is unavailable.');
 if (!cmd.userId) throw Error('Choose a demo student first.');
 const v=viewRoom(state,room,now); const s=v.session;
 const member=s && state.memberships.find(m=>m.sessionId===s.id&&m.userId===cmd.userId);
 if (cmd.type==='checkIn'||cmd.type==='update') {
  if (!Number.isFinite(cmd.minutes)||cmd.minutes<1||cmd.minutes>480) throw Error('Choose a duration between 1 and 480 minutes.');
  if (typeof cmd.openToShare!=='boolean') throw Error('Choose whether others can join.');
 }
 if (cmd.type==='checkIn'||cmd.type==='join') {
  if(state.memberships.some(m=>m.userId===cmd.userId)) throw Error('Leave your current room before joining another.');
 }
 if(cmd.type==='checkIn'){
  if(s) throw Error('Someone has already checked in. Please review the updated room.');
  if(v.status==='unknown'&&!cmd.confirmedEmpty) throw Error('Confirm the room is empty in person before checking in.');
  state.sessions.push({id,roomId:room.id,holderId:cmd.userId,startedAt:now,expectedEnd:now+cmd.minutes*60_000,openToShare:cmd.openToShare});
  state.memberships.push({sessionId:id,userId:cmd.userId,joinedAt:now});
  state.observations=state.observations.filter(o=>o.roomId!==room.id);
 }else if(cmd.type==='join'){
  if(!s||!s.openToShare) throw Error('This room is no longer open to sharing.');
  if(v.count>=room.capacity) throw Error('This room has reached its capacity.');
  state.memberships.push({sessionId:s.id,userId:cmd.userId,joinedAt:now});
 }else if(cmd.type==='update'){
  if(!s||s.holderId!==cmd.userId) throw Error('Only the current room holder can update this session.');
  s.expectedEnd=now+cmd.minutes*60_000; s.openToShare=cmd.openToShare;
 }else if(cmd.type==='leave'){
  if(!s||!member) throw Error('You are not checked into this room.');
  state.memberships=state.memberships.filter(m=>!(m.sessionId===s.id&&m.userId===cmd.userId));
  const remaining=state.memberships.filter(m=>m.sessionId===s.id).sort((a,b)=>a.joinedAt-b.joinedAt||a.userId.localeCompare(b.userId));
  if(!remaining.length){state.sessions=state.sessions.filter(x=>x.id!==s.id);state.observations.push({roomId:room.id,status:'free',updatedAt:now});}
  else if(s.holderId===cmd.userId) s.holderId=remaining[0].userId;
 }
 state.revision++; return state;
}
