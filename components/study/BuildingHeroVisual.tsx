import { buildings, floors } from "@/data/catalog";
import type { Building, RoomView, Status } from "@/types/domain";

// Live at-a-glance summary of the whole building, in place of a decorative banner.
// Each stat is a shortcut that applies the matching status filter.
export function BuildingHeroVisual({
  views = [],
  onStatus,
  activeStatus = "all",
  building = buildings[0],
}: {
  views?: RoomView[];
  onStatus?: (s: Status | "all") => void;
  activeStatus?: Status | "all";
  building?: Building;
}) {
  const levels = floors.filter((floor) => floor.buildingId === building.id);
  const count = (s: Status) => views.filter((v) => v.status === s).length;
  const total = views.length;

  const stats: { key: Status; label: string }[] = [
    { key: "free", label: "Free now" },
    { key: "share", label: "Open to share" },
    { key: "occupied", label: "In use" },
    { key: "unknown", label: "Unconfirmed" },
  ];

  return (
    <figure className="building-hero" id="building" data-building-id={building.id}>
      <div className="building-hero-top">
        <span className="building-hero-name">{building.name.toUpperCase()}</span>
        <span className="building-hero-meta">
          {total} spaces · {levels.length} levels · Ground floor to Floor{" "}
          {Math.max(...levels.map((floor) => floor.number))}
        </span>
      </div>
      <div className="building-stats">
        {stats.map(({ key, label }) => {
          const n = count(key);
          const isActive = activeStatus === key;
          return (
            <button
              key={key}
              type="button"
              className={`building-stat stat-${key}${isActive ? " active" : ""}`}
              aria-pressed={isActive}
              disabled={!onStatus}
              onClick={() => onStatus?.(isActive ? "all" : key)}
            >
              <strong>{n}</strong>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </figure>
  );
}
