'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { appearanceStorageKey, defaultAppearance, parseAppearance, type Appearance } from '@/data/appearance';
type AppearanceContextValue = {
  appearance:Appearance;
  setAppearance:(patch:Partial<Appearance>)=>void;
  theme:Appearance['mode'];
  setTheme:(mode:Appearance['mode'])=>void;
};
const ThemeContext=createContext<AppearanceContextValue>({appearance:defaultAppearance,setAppearance:()=>{},theme:'light',setTheme:()=>{}});
function applyToDocument(value:Appearance) {
  const root=document.documentElement;
  root.classList.toggle('dark',value.mode==='dark');
  root.style.colorScheme=value.mode;
  root.dataset.palette=value.palette;
  root.dataset.textSize=value.textSize;
  root.dataset.fontWeight=value.fontWeight;
}
export function AppTheme({children}:{children:React.ReactNode}) {
  const [appearance,updateAppearance]=useState<Appearance>(defaultAppearance);
  const current=useRef(appearance);
  const apply=(value:Appearance)=>{current.current=value;applyToDocument(value);updateAppearance(value);};
  useEffect(()=>{
    try {
      const raw=localStorage.getItem(appearanceStorageKey);
      apply(raw?parseAppearance(JSON.parse(raw)):{...defaultAppearance,mode:localStorage.getItem('study-room-theme')==='dark'?'dark':'light'});
    } catch { apply({...defaultAppearance}); }
    const sync=(event:StorageEvent)=>{
      if(event.key===appearanceStorageKey){try{apply(parseAppearance(event.newValue?JSON.parse(event.newValue):null));}catch{}}
    };
    window.addEventListener('storage',sync);
    return()=>window.removeEventListener('storage',sync);
  },[]);
  const setAppearance=(patch:Partial<Appearance>)=>{
    const next=parseAppearance({...current.current,...patch});
    apply(next);
    try{localStorage.setItem(appearanceStorageKey,JSON.stringify(next));}catch{}
  };
  return <ThemeContext.Provider value={{appearance,setAppearance,theme:appearance.mode,setTheme:mode=>setAppearance({mode})}}>{children}</ThemeContext.Provider>;
}
export const useAppTheme=()=>useContext(ThemeContext);
