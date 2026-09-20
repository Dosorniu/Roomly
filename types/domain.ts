export type Status = 'free' | 'share' | 'occupied' | 'unknown';
export interface University { id: string; name: string; slug: string }
export interface Campus { id: string; universityId: string; name: string }
export interface Building { id: string; campusId: string; name: string; slug: string; image: string }
export interface Floor { id: string; buildingId: string; number: number; name: string }
export interface Room { id: string; floorId: string; name: string; number: string; type: string; capacity: number; features: string[]; enabled: boolean }
export interface User { id: string; displayName: string; universityId: string }
export interface RoomSession { id: string; roomId: string; holderId: string; startedAt: number; expectedEnd: number; openToShare: boolean }
export interface RoomMembership { sessionId: string; userId: string; joinedAt: number }
export interface Observation { roomId: string; status: 'free' | 'unknown'; updatedAt: number }
export interface StudyState { sessions: RoomSession[]; memberships: RoomMembership[]; observations: Observation[]; revision: number }
export interface RoomView { room: Room; status: Status; count: number; session?: RoomSession; updatedAt: number }
