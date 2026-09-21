import {
  appearanceStorageKey,
  defaultAppearance,
  parseAppearance,
  type Appearance,
} from "../data/appearance";
let current = defaultAppearance;
const listeners = new Set<() => void>();
export function applyAppearance(value: Appearance) {
  current = value;
  const root = document.documentElement;
  root.classList.toggle("dark", value.mode === "dark");
  root.style.colorScheme = value.mode;
  root.dataset.palette = value.palette;
  root.dataset.textSize = value.textSize;
  root.dataset.fontWeight = value.fontWeight;
  listeners.forEach((fn) => fn());
}
export function readAppearance() {
  try {
    const raw = localStorage.getItem(appearanceStorageKey);
    return raw
      ? parseAppearance(JSON.parse(raw))
      : {
          ...defaultAppearance,
          mode:
            localStorage.getItem("study-room-theme") === "dark"
              ? ("dark" as const)
              : ("light" as const),
        };
  } catch {
    return defaultAppearance;
  }
}
export const appearanceStore = {
  getSnapshot: () => current,
  getServerSnapshot: () => defaultAppearance,
  subscribe(fn: () => void) {
    listeners.add(fn);
    applyAppearance(readAppearance());
    const sync = (event: StorageEvent) => {
      if (event.key === appearanceStorageKey || event.key === null)
        applyAppearance(readAppearance());
    };
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", sync);
    };
  },
  update(patch: Partial<Appearance>) {
    const next = parseAppearance({ ...current, ...patch });
    applyAppearance(next);
    try {
      localStorage.setItem(appearanceStorageKey, JSON.stringify(next));
    } catch {
      /* Settings remain in memory. */
    }
  },
};
