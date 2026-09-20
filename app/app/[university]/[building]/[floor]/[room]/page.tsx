import { StudyApp } from '@/components/study/StudyApp';
export default async function RoomPage({params}:{params:Promise<{university:string;building:string;floor:string;room:string}>}){const p=await params;return <StudyApp requestedPath={`/app/${p.university}/${p.building}/${p.floor}/${p.room}`}/>;}
