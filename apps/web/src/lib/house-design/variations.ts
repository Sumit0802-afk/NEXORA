import { getMaterial } from "./materials";
import { ELEVATION_LABEL, type HouseDesign } from "./schema";
import { categoryLabel } from "./styles";

/** What differs between two designs, in the terms the studio uses. */

export type DesignDifference = { id: string; label: string; a: string; b: string };

const finish = (f: { materialId: string; color: string }) => `${getMaterial(f.materialId).name} ${f.color.toUpperCase()}`;

function summary(design: HouseDesign | null): Record<string, [string, string]> {
  if (!design) return {};
  const { exterior: ext, interior: int, environment: env } = design;
  const overrides = Object.values(design.overrides);
  return {
    style: ["Facade style", categoryLabel(design.category)],
    wall: ["Exterior walls", finish(ext.wall)],
    accent: ["Accent cladding", ext.accentPlacement === "none" ? "None" : finish(ext.accent)],
    roof: ["Roof", ext.roof.type === "flat" || ext.roof.type === "cantilever" ? ext.roof.type : `${ext.roof.type}, ${ext.roof.pitch}°`],
    roofFinish: ["Roof covering", finish(ext.roof.finish)],
    windows: ["Windows", `${ext.window.shape}, ${ext.window.grid} glazing`],
    frames: ["Window frames", finish(ext.window.frame)],
    door: ["Front door", `${ext.door.design}, ${getMaterial(ext.door.finish.materialId).name}`],
    balcony: ["Balconies", ext.balcony.projected ? `${ext.balcony.style}: ${ext.balcony.elevations.map((e) => ELEVATION_LABEL[e].toLowerCase()).join(", ")}` : "None"],
    interior: ["Interior walls", finish(int.wall)],
    floors: ["Floors", int.floor ? finish(int.floor) : "Set by room type"],
    garden: ["Garden", `${env.surroundings}, ${env.trees} trees${env.hedges ? ", hedges" : ""}`],
    edits: ["Individual object edits", overrides.length ? String(overrides.length) : "None"],
  };
}

export function diffDesigns(a: HouseDesign | null, b: HouseDesign | null): DesignDifference[] {
  const left = summary(a), right = summary(b);
  return Object.keys({ ...left, ...right })
    .filter((id) => left[id]?.[1] !== right[id]?.[1])
    .map((id) => ({ id, label: (left[id] ?? right[id])[0], a: left[id]?.[1] ?? "As drawn", b: right[id]?.[1] ?? "As drawn" }));
}
