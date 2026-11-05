import type { Finish, Elevation, HouseDesign, ObjectOverride } from "./schema";

/** The selectable things in a house. Ids are semantic and stable, so an edit follows its object through rebuilds. */

export type ObjectKind =
  | "wall" | "interiorWall" | "window" | "door" | "interiorDoor" | "balcony" | "railing" | "roof"
  | "portico" | "floor" | "ceiling" | "boundary" | "gate" | "driveway" | "tree";

export type SceneObject = {
  id: string;
  kind: ObjectKind;
  label: string;
  level: number | null;
  /** The side of the house it is on, when it is on one. */
  elevation: Elevation | null;
  /** The object this one sits in, such as a window's wall. */
  host: string | null;
  /** Added by the model to a blank wall; it does not exist in the 2D plan. */
  modelOnly?: boolean;
  parts: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
};

export const OBJECT_GROUPS: { title: string; kinds: ObjectKind[] }[] = [
  { title: "Walls", kinds: ["wall", "interiorWall"] },
  { title: "Roof", kinds: ["roof"] },
  { title: "Windows", kinds: ["window"] },
  { title: "Doors", kinds: ["door", "interiorDoor"] },
  { title: "Balconies and railings", kinds: ["balcony", "railing", "portico"] },
  { title: "Rooms", kinds: ["floor", "ceiling"] },
  { title: "Boundary and gates", kinds: ["boundary", "gate"] },
  { title: "Garden", kinds: ["tree", "driveway"] },
];

/** Puts a change onto one object, leaving the design it came from untouched. */
export function withOverride(design: HouseDesign, id: string, change: (current: ObjectOverride) => ObjectOverride): HouseDesign {
  const next = change({ ...design.overrides[id] });
  const overrides = { ...design.overrides };
  if (isEmptyOverride(next)) delete overrides[id];
  else overrides[id] = { ...next, source: "user" };
  return { ...design, overrides };
}

const isEmptyOverride = (o: ObjectOverride) =>
  !o.hidden && !Object.keys(o.finishes ?? {}).length && !Object.keys(o.window ?? {}).length && !Object.keys(o.door ?? {}).length &&
  !Object.keys(o.balcony ?? {}).length && !Object.keys(o.roof ?? {}).length;

export function withObjectFinish(design: HouseDesign, ids: string[], part: string, finish: Finish): HouseDesign {
  return ids.reduce((d, id) => withOverride(d, id, (o) => ({ ...o, finishes: { ...o.finishes, [part]: finish } })), design);
}

export function withoutOverride(design: HouseDesign, id: string): HouseDesign {
  const overrides = { ...design.overrides };
  delete overrides[id];
  return { ...design, overrides };
}

/** The finish this object's part has been given by hand, if any. A plate closing an opening matches its host wall. */
export function objectFinish(design: HouseDesign, object: string | undefined, part: string, hosts?: Map<string, string | null>): Finish | undefined {
  if (!object) return undefined;
  const own = design.overrides[object]?.finishes?.[part];
  if (own) return own;
  const host = part === "walls" ? hosts?.get(object) : null;
  return host ? design.overrides[host]?.finishes?.walls : undefined;
}

/** Edits whose object has left the model, usually because a wall or window was removed in the 2D editor. */
export function orphanedOverrides(design: HouseDesign, objects: SceneObject[]): string[] {
  const known = new Set(objects.map((o) => o.id));
  // Removing a model-added window takes it out of the model, so its override is what keeps it gone.
  return Object.keys(design.overrides).filter((id) => !known.has(id) && !design.overrides[id].hidden);
}

export function siblingsOf(object: SceneObject, objects: SceneObject[]): SceneObject[] {
  return objects.filter((o) => o.kind === object.kind && o.elevation === object.elevation);
}
