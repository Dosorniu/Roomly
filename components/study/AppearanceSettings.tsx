"use client";
import { Moon, Sun, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { appearanceOptions, type Appearance } from "@/data/appearance";
import { useAppTheme } from "./AppTheme";
export function AppearanceSettings() {
  const { appearance, setAppearance } = useAppTheme();
  return (
    <div className="appearance-settings">
      <fieldset>
        <legend>Color palette</legend>
        <p className="setting-description">
          A palette for your campus, in either mode.
        </p>
        <RadioGroup
          aria-label="Color palette"
          className="palette-choices"
          value={appearance.palette}
          onValueChange={(palette) =>
            setAppearance({ palette: palette as Appearance["palette"] })
          }
        >
          {appearanceOptions.palette.map((option) => (
            <label
              key={option.value}
              className={`palette-choice ${appearance.palette === option.value ? "chosen" : ""}`}
            >
              <RadioGroupItem
                value={option.value}
                id={`palette-${option.value}`}
              />
              <span
                className={`palette-swatches swatches-${option.value}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </span>
              <span className="choice-title">{option.label}</span>
              <span className="choice-description">{option.description}</span>
              {appearance.palette === option.value && (
                <Check className="choice-check" size={16} />
              )}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend>Mode</legend>
        <RadioGroup
          aria-label="Mode"
          className="appearance-segments two"
          value={appearance.mode}
          onValueChange={(mode) =>
            setAppearance({ mode: mode as Appearance["mode"] })
          }
        >
          {appearanceOptions.mode.map((option) => (
            <label
              key={option.value}
              className={appearance.mode === option.value ? "chosen" : ""}
            >
              <RadioGroupItem
                value={option.value}
                id={`mode-${option.value}`}
              />
              {option.value === "light" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
              <span>{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend>Text size</legend>
        <RadioGroup
          aria-label="Text size"
          className="appearance-segments"
          value={appearance.textSize}
          onValueChange={(textSize) =>
            setAppearance({ textSize: textSize as Appearance["textSize"] })
          }
        >
          {appearanceOptions.textSize.map((option) => (
            <label
              key={option.value}
              className={appearance.textSize === option.value ? "chosen" : ""}
            >
              <RadioGroupItem
                value={option.value}
                id={`size-${option.value}`}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend>Font weight</legend>
        <RadioGroup
          aria-label="Font weight"
          className="appearance-segments"
          value={appearance.fontWeight}
          onValueChange={(fontWeight) =>
            setAppearance({
              fontWeight: fontWeight as Appearance["fontWeight"],
            })
          }
        >
          {appearanceOptions.fontWeight.map((option) => (
            <label
              key={option.value}
              className={appearance.fontWeight === option.value ? "chosen" : ""}
            >
              <RadioGroupItem
                value={option.value}
                id={`weight-${option.value}`}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="appearance-preview">
        <span className="eyebrow">TEXT PREVIEW</span>
        <h3>A little room to focus.</h3>
        <p>Find a space, settle in and make it yours.</p>
        <span className="status free">Free now</span>
      </div>
      <p className="small-note">
        Changes apply immediately. Your preferences are saved in this browser.
      </p>
    </div>
  );
}
