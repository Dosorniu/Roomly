import { floors, buildings, campuses, universities } from '@/data/catalog';
import type { Room } from '@/types/domain';
export function roomPath(room:Room){const floor=floors.find(f=>f.id===room.floorId)!;const building=buildings.find(b=>b.id===floor.buildingId)!;const campus=campuses.find(c=>c.id===building.campusId)!;const uni=universities.find(u=>u.id===campus.universityId)!;return `/app/${uni.slug}/${building.slug}/${floor.number}/room-${room.id}`;}
