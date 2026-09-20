import type { RoomRepository } from './repository';
import { rooms } from '../data/catalog';
import { viewRoom } from './domain';
type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>unknown};
export function registerRoomTools(repository:RoomRepository){
 const context=(document as Document & {modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 try{Promise.resolve(context.registerTool({name:'list_study_rooms',description:'Read current demo room availability from the same state shown in this browser. Optionally search room names or numbers. Does not check in or reserve a room.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected an object.');const obj=input as Record<string,unknown>;if(Object.keys(obj).some(k=>k!=='query')||(obj.query!==undefined&&typeof obj.query!=='string'))throw Error('query must be a string.');const q=((obj.query as string)||'').toLowerCase();return rooms.filter(r=>r.enabled&&`${r.name} ${r.number}`.toLowerCase().includes(q)).map(r=>{const v=viewRoom(repository.getSnapshot(),r,Date.now());return {id:r.id,name:r.name,number:r.number,status:v.status,occupants:v.count,capacity:r.capacity,expectedEnd:v.session?.expectedEnd??null};});}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
 return()=>lifecycle.abort();
}
