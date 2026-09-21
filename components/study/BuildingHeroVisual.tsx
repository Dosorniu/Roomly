import { buildings, floors } from "@/data/catalog";
import type { Building } from "@/types/domain";
export function BuildingHeroVisual({
  building = buildings[0],
}: {
  building?: Building;
}) {
  const levels = floors.filter((floor) => floor.buildingId === building.id);
  return (
    <figure
      className="building-hero"
      id="building"
      data-building-id={building.id}
    >
      <img
        src={building.image}
        alt="Stylized illustration of the campus building and entrance courtyard"
      />
      <figcaption>
        <span>{building.name.toUpperCase()}</span>
        <span>
          {levels.length} levels · Ground floor to Floor{" "}
          {Math.max(...levels.map((floor) => floor.number))}
        </span>
      </figcaption>
    </figure>
  );
}
