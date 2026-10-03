export const appearanceOptions = {
  palette: [
    { value: "original", label: "Original", description: "Minimal & neutral" },
    { value: "cbs", label: "Campus", description: "Black & lime" },
  ],
  mode: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ],
  textSize: [
    { value: "compact", label: "Compact" },
    { value: "standard", label: "Standard" },
    { value: "large", label: "Large" },
  ],
  fontWeight: [
    { value: "regular", label: "Regular" },
    { value: "medium", label: "Medium" },
    { value: "bold", label: "Bold" },
  ],
} as const;
export type Appearance = {
  [
    K in keyof typeof appearanceOptions
  ]: (typeof appearanceOptions)[K][number]["value"];
};
export const defaultAppearance: Appearance = {
  palette: "cbs",
  mode: "dark",
  textSize: "standard",
  fontWeight: "regular",
};
export const appearanceStorageKey = "nagroom-appearance-v1";
export function parseAppearance(input: unknown): Appearance {
  const result = { ...defaultAppearance };
  if (!input || typeof input !== "object" || Array.isArray(input))
    return result;
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(appearanceOptions) as (keyof Appearance)[]) {
    if (appearanceOptions[key].some((option) => option.value === record[key])) {
      Object.assign(result, { [key]: record[key] });
    }
  }
  return result;
}
