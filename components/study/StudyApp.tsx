'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { rooms, floors, users, buildings } from '@/data/catalog';
import { repository } from '@/services/repository';
import { viewRoom, type Command } from '@/services/domain';
import { roomPath } from '@/services/routes';
import type { Status } from '@/types/domain';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { DiscoverRooms } from './DiscoverRooms';
import { Header } from './Header';
import { AppearanceSettings } from './AppearanceSettings';
import { useAppTheme } from './AppTheme';
import { RoomDetails } from './RoomDetails';
import { registerRoomTools } from '@/services/webmcp';
export function StudyApp({requestedPath}:{requestedPath?:string}) {
 const {theme}=useAppTheme();
 const state=useSyncExternalStore(repository.subscribe,repository.getSnapshot,repository.getSnapshot);
 const [ready,setReady]=useState(false);const [now,setNow]=useState(0);const [userId,setUserId]=useState('student-A');const [floor,setFloor]=useState('all');const [query,setQuery]=useState('');const [status,setStatus]=useState<Status|'all'>('free');const [capacity,setCapacity]=useState('all');const [type,setType]=useState('all');const [panel,setPanel]=useState<'help'|'notifications'|'appearance'|null>(null);
 const [watches,setWatches]=useState<Record<string,string[]>>({});const [notices,setNotices]=useState<{id:string;userId:string;roomId:string;text:string}[]>([]);const prevStatuses=useRef<Record<string,Status>>({});
 useEffect(()=>{const stop=repository.start();setReady(true);setNow(Date.now());try{const saved=sessionStorage.getItem('cbs-demo-user');if(users.some(u=>u.id===saved))setUserId(saved!);const watch=JSON.parse(localStorage.getItem('cbs-demo-watches')||'{}');if(watch&&typeof watch==='object'&&!Array.isArray(watch))setWatches(watch);}catch{}const timer=setInterval(()=>setNow(Date.now()),5000);return()=>{stop();clearInterval(timer);};},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem('cbs-demo-watches',JSON.stringify(watches));}catch{}},[watches,ready]);
 const views=rooms.filter(r=>r.enabled).map(r=>viewRoom(state,r,now));
 useEffect(()=>{if(!ready)return;const current=Object.fromEntries(rooms.map(r=>[r.id,viewRoom(state,r,Date.now()).status]));const newlyFree=rooms.filter(r=>current[r.id]==='free'&&prevStatuses.current[r.id]&&prevStatuses.current[r.id]!=='free');for(const r of newlyFree){for(const [uid,ids] of Object.entries(watches)){if(Array.isArray(ids)&&ids.includes(r.id)){const text=`${r.name} · ${r.number} is now free.`;setNotices(n=>[{id:crypto.randomUUID(),userId:uid,roomId:r.id,text},...n].slice(0,20));if(uid===userId)toast.success(text);}}}prevStatuses.current=current;},[state,watches,userId,ready]);
 useEffect(()=>registerRoomTools(repository),[]);
 const switchUser=(id:string)=>{setUserId(id);try{sessionStorage.setItem('cbs-demo-user',id);}catch{}toast(`Demo session: ${users.find(u=>u.id===id)?.displayName}`);};
 const submit=async(command:Command)=>{try{await repository.dispatch(command);setNow(Date.now());toast.success(({checkIn:'You’re checked in.',join:'You’ve joined the room.',leave:'You’ve left the room.',update:'Session updated.'})[command.type]);return true;}catch(e){toast.error(e instanceof Error?e.message:'Unable to update the room.');return false;}};
 const watching=(id:string)=>Array.isArray(watches[userId])&&watches[userId].includes(id);
 const toggleWatch=(id:string)=>setWatches(current=>{const ids=Array.isArray(current[userId])?current[userId]:[];return {...current,[userId]:ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]};});
 const currentRoom=views.find(v=>v.session&&state.memberships.some(m=>m.sessionId===v.session!.id&&m.userId===userId));
 const selected=requestedPath?views.find(v=>roomPath(v.room)===requestedPath):undefined;
 const filtered=views.filter(v=>{const f=floors.find(f=>f.id===v.room.floorId)!;const b=buildings.find(b=>b.id===f.buildingId)!;const text=`${v.room.name} ${v.room.number} ${v.room.type} ${f.name} ${b.name}`.toLowerCase();return (floor==='all'||v.room.floorId===floor)&&(status==='all'||v.status===status)&&(capacity==='all'||v.room.capacity>=Number(capacity))&&(type==='all'||v.room.type===type)&&text.includes(query.trim().toLowerCase());});
 const reset=()=>{setQuery('');setFloor('all');setStatus('all');setCapacity('all');setType('all');};
 return <div className="app-shell"><Toaster position="bottom-right" theme={theme}/>
  <Header userId={userId} onUser={switchUser} onPanel={setPanel} hasNotices={notices.some(n=>n.userId===userId)}/>
  <main className="workspace">
   {!ready?<div className="loading-state" role="status">Loading study spaces…</div>:requestedPath?(selected?<RoomDetails key={`${selected.room.id}-${userId}`} view={selected} state={state} userId={userId} onSubmit={submit} watching={watching(selected.room.id)} onWatch={()=>toggleWatch(selected.room.id)}/>:<div className="empty-state"><h1>Room not found</h1><p>This room may have moved or is no longer listed.</p><Link href="/" className="primary-button">Browse rooms</Link></div>):<>
    {currentRoom&&<Link href={roomPath(currentRoom.room)} className="active-session"><span><strong>Your session: {currentRoom.room.name} · {currentRoom.room.number}</strong><span>{currentRoom.session!.expectedEnd-now<300000?'Ending soon — extend or leave.':'You are currently checked in.'}</span></span><span>Manage session →</span></Link>}
    <DiscoverRooms views={filtered} query={query} onQuery={setQuery} status={status} onStatus={setStatus} floor={floor} onFloor={setFloor} capacity={capacity} onCapacity={setCapacity} type={type} onType={setType} onReset={reset}/>
   </>}
   <footer><span>Roomly · Room Finder</span><span>Student prototype · Demonstration data</span></footer>
  </main><Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}><DialogContent className={`study-modal ${panel==='appearance'?'appearance-modal':''}`}><DialogHeader><DialogTitle>{panel==='appearance'?'Appearance':panel==='help'?'A study space, without the guesswork.':'Availability notifications'}</DialogTitle><DialogDescription>{panel==='appearance'?'Make this space feel like yours.':panel==='help'?'A student-built prototype for finding and sharing campus study spaces.':'In-app alerts for your current demo student while this app is open.'}</DialogDescription></DialogHeader>{panel==='appearance'?<AppearanceSettings/>:panel==='help'?<div className="help-content"><p><strong>1. Find a room.</strong> Search by name, number, building or floor. Filter by availability, capacity or room type.</p><p><strong>2. Check in when you arrive.</strong> Choose how long you plan to stay and whether others may join.</p><p><strong>3. Leave when you’re done.</strong> The next participant becomes holder if others remain. The last person leaving marks the room Free.</p><p><strong>Unknown means unconfirmed.</strong> Sessions expire at their end time. Free reports become Unknown after 30 minutes.</p><div className="demo-explainer"><strong>Try it with three demo students</strong><p>Switch Student A, B and C in the top bar. Changes persist locally and update across tabs in this browser. Other devices do not share these demo sessions. No passwords or email addresses are collected.</p></div></div>:<div className="notification-list">{notices.filter(n=>n.userId===userId).map(n=><Link key={n.id} href={roomPath(rooms.find(r=>r.id===n.roomId)!)} onClick={()=>setPanel(null)} className="notification-item">{n.text}</Link>)}<h3>Watching</h3>{rooms.filter(r=>watching(r.id)).map(r=><div className="watch-row" key={r.id}><span>{r.name} · {r.number}</span><button aria-label={`Stop watching ${r.name}`} onClick={()=>toggleWatch(r.id)}><X size={18}/></button></div>)}{!rooms.some(r=>watching(r.id))&&<p>No rooms watched yet. Open an occupied or unconfirmed room and choose “Notify me when free”.</p>}<p className="small-note">Alerts describe demo activity in this browser. No push notifications or email.</p></div>}</DialogContent></Dialog></div>;
}
