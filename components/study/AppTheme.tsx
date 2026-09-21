"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { defaultAppearance, type Appearance } from "@/data/appearance";
import { appearanceStore } from "@/services/appearance-store";
type Value = {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  theme: Appearance["mode"];
  setTheme: (mode: Appearance["mode"]) => void;
};
const ThemeContext = createContext<Value>({
  appearance: defaultAppearance,
  setAppearance: () => {},
  theme: "light",
  setTheme: () => {},
});
export function AppTheme({ children }: { children: React.ReactNode }) {
  const appearance = useSyncExternalStore(
    appearanceStore.subscribe,
    appearanceStore.getSnapshot,
    appearanceStore.getServerSnapshot,
  );
  return (
    <ThemeContext.Provider
      value={{
        appearance,
        setAppearance: appearanceStore.update,
        theme: appearance.mode,
        setTheme: (mode) => appearanceStore.update({ mode }),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useAppTheme = () => useContext(ThemeContext);
