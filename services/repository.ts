import { createSeed, rooms } from '../data/catalog';
import type { StudyState } from '../types/domain';
import { applyCommand, expire, type Command } from './domain';
export interface RoomRepository { getSnapshot(): StudyState; subscribe(fn:()=>void):()=>void; dispatch(command:Command):Promise<void>; start():()=>void }
const KEY='cbs-study-demo-v1';
class LocalDemoRepository implements RoomRepository {
 private state=createSeed(0); private listeners=new Set<()=>void>(); private started=0;
 getSnapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private read():StudyState {try{const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(Array.isArray(value.sessions)&&Array.isArray(value.memberships)&&Array.isArray(value.observations)&&typeof value.revision==='number')return value;}}catch{}return this.state;}
 private notify(){this.listeners.forEach(fn=>fn());}
 private save(state:StudyState){this.state=state;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}this.notify();}
 private async locked(fn:()=>void){if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request(KEY,fn);else fn();}
 dispatch=async(cmd:Command)=>{await this.locked(()=>{const now=Date.now();this.save(applyCommand(this.read(),rooms,cmd,now,crypto.randomUUID()));});};
 start=()=>{
  if(this.started++===0){this.state=createSeed();this.state=expire(this.read(),Date.now());this.save(this.state);}
  const sync=(event:StorageEvent)=>{if(event.key===KEY){this.state=expire(this.read(),Date.now());this.notify();}};
  window.addEventListener('storage',sync);
  const timer=setInterval(()=>{void this.locked(()=>{const current=this.read();const next=expire(current,Date.now());if(next!==current)this.save(next);else if(current.revision!==this.state.revision){this.state=current;this.notify();}});},5000);
  return()=>{this.started--;clearInterval(timer);window.removeEventListener('storage',sync);};
 };
}
export const repository:RoomRepository=new LocalDemoRepository();
