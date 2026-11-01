import type { FloorPlan, Room, RoomType } from "@houseplan/design-schema";
import { getMaterial } from "./materials";
import { getAt, type DesignSection, type Finish, type HouseDesign, type LightingPreview } from "./schema";

/** How one named part of the model looks right now. */
export type Surface = Finish & { emissive?: string; emissiveIntensity?: number };

/** Parts that belong to the roof and disappear with it, so the user can look down into the rooms. */
export function isRoofPart(part: string): boolean {
  return part === "roof" || part === "fascia" || part === "soffit" || part === "gableWall" || part === "roofTrim" || part === "ceilingBeam" || part === "coveLight" || part.startsWith("ceiling:");
}

/** Parts rendered from both sides because the geometry is a single plane. */
export function isTwoSided(part: string): boolean {
  return part === "roof" || part === "fascia" || part === "soffit" || part === "gableWall";
}

export function isTransparent(materialId: string): boolean {
  return getMaterial(materialId).category === "glass";
}

const ROOM_FLOORS: Partial<Record<RoomType, Finish>> = {
  living_room: { materialId: "wood_floor_oak", color: "#C9A67C" },
  dining_room: { materialId: "wood_floor_oak", color: "#BE9568" },
  bedroom: { materialId: "wood_floor_oak", color: "#D0AE85" },
  study: { materialId: "wood_floor_walnut", color: "#8A6242" },
  kitchen: { materialId: "tile_porcelain", color: "#CFCDC8" },
  bathroom: { materialId: "marble_carrara", color: "#E8ECEE" },
  utility: { materialId: "tile_porcelain", color: "#BDBBB6" },
  staircase: { materialId: "stone_limestone", color: "#C9BFAE" },
  hallway: { materialId: "marble_travertine", color: "#DCD3C2" },
  corridor: { materialId: "marble_travertine", color: "#DCD3C2" },
  parking: { materialId: "ground_pavers", color: "#A8A59E" },
  balcony: { materialId: "wood_deck", color: "#B08F68" },
  other: { materialId: "wood_deck", color: "#B99B75" },
};

export function roomFinish(design: HouseDesign, room: Room | undefined, roomId: string, which: "wall" | "floor" | "ceiling"): Finish {
  const override = design.interior.rooms[roomId]?.[which];
  if (override) return override;
  if (which === "wall") {
    return room?.interior?.wallColor ? { ...design.interior.wall, color: room.interior.wallColor } : design.interior.wall;
  }
  if (which === "ceiling") return design.interior.ceiling;
  const open = room?.type === "parking" || room?.type === "balcony" || room?.type === "other";
  const base = open ? ROOM_FLOORS[room!.type] : design.interior.floor ?? (room ? ROOM_FLOORS[room.type] : undefined);
  const finish = base ?? { materialId: "marble_travertine", color: "#DCD3C2" };
  return room?.interior?.floorColor && !design.interior.floor ? { ...finish, color: room.interior.floorColor } : finish;
}

const SURROUND: Record<HouseDesign["environment"]["surroundings"], Finish> = {
  studio: { materialId: "concrete_smooth", color: "#D9D5CC" },
  suburban: { materialId: "ground_grass", color: "#7FA366" },
  urban: { materialId: "ground_pavers", color: "#A9A59D" },
  woodland: { materialId: "ground_grass", color: "#5F7F4A" },
  waterfront: { materialId: "ground_sand", color: "#DCC9A3" },
};

const FIXED: Record<string, Finish> = {
  sidewalk: { materialId: "ground_pavers", color: "#BDB9B0" },
  road: { materialId: "ground_asphalt", color: "#46474B" },
  roadMark: { materialId: "paint_matte", color: "#E7E3D8" },
  trunk: { materialId: "wood_walnut", color: "#5A4432" },
  neighbour: { materialId: "paint_matte", color: "#C9C5BC" },
  water: { materialId: "paint_gloss", color: "#4B7E9B" },
  lampBody: { materialId: "metal_powder", color: "#26282D" },
  doorGroove: { materialId: "paint_matte", color: "#1B1A1A" },
};

function darker(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * factor).toString(16).padStart(2, "0"));
  return `#${c.join("")}`;
}

export function surfaceFor(part: string, design: HouseDesign, plan: FloorPlan, lighting: LightingPreview, rooms?: Map<string, Room>): Surface {
  const ext = design.exterior, env = design.environment;
  const room = (id: string) => rooms?.get(id) ?? plan.levels.flatMap((l) => l.rooms).find((r) => r.id === id);
  const lit = lighting === "night" ? 1 : lighting === "golden" ? 0.5 : 0;
  if (part.startsWith("roomWall:")) return roomFinish(design, room(part.slice(9)), part.slice(9), "wall");
  if (part.startsWith("roomFloor:")) return roomFinish(design, room(part.slice(10)), part.slice(10), "floor");
  if (part.startsWith("ceiling:")) return roomFinish(design, room(part.slice(8)), part.slice(8), "ceiling");
  switch (part) {
    case "walls":
    case "gableWall":
      return ext.wall;
    case "accent":
    case "fins":
      return ext.accent;
    case "base":
    case "step":
      return ext.base;
    case "trim":
    case "column":
    case "corbel":
    case "shutter":
    case "roofTrim":
      return ext.trim;
    case "shutterSlat":
      return { ...ext.trim, color: darker(ext.trim.color, 0.82) };
    case "roof":
      return ext.roof.finish;
    case "fascia":
      return ext.roof.fascia;
    case "soffit":
      return ext.roof.soffit;
    case "windowFrame":
      return ext.window.frame;
    case "glass":
    case "doorGlass":
      return { ...ext.window.glass, emissive: "#FFD79B", emissiveIntensity: lit * 0.85 };
    case "door":
      return ext.door.finish;
    case "hardware":
      return { materialId: "metal_powder", color: ext.door.hardware };
    case "railing":
      return ext.balcony.rail;
    case "railGlass":
      return { materialId: "glass_clear", color: "#C8E1F2" };
    case "balconySlab":
      return ext.balcony.slab;
    case "compound":
      return env.boundary;
    case "interiorWall":
      return design.interior.wall;
    case "interiorDoor":
      return design.interior.door.finish;
    case "ceilingBeam":
      return { materialId: "wood_oak", color: "#A98258" };
    case "coveLight":
      return { materialId: "paint_matte", color: "#FFF1D6", emissive: "#FFD9A0", emissiveIntensity: 0.4 + lit * 1.2 };
    case "plot":
      return env.lawn ? env.ground : { materialId: "ground_pavers", color: "#C9C3B6" };
    case "surroundings":
      return env.surroundings === "suburban" && env.lawn && env.ground.materialId === "ground_grass" ? env.ground : SURROUND[env.surroundings];
    case "path":
      return env.path.finish;
    case "drive":
      return env.driveway;
    case "hedge":
    case "foliage":
      return { materialId: "ground_grass", color: env.foliage };
    case "shrub":
      return { materialId: "ground_grass", color: darker(env.foliage, 0.88) };
    case "flower":
      return { materialId: "paint_matte", color: env.flowerColor };
    case "lampHead":
      return { materialId: "paint_matte", color: "#FFF4DE", emissive: env.lighting.color, emissiveIntensity: lit * 2.4 * env.lighting.intensity };
    default:
      return FIXED[part] ?? ext.wall;
  }
}

export type PartTarget = { path: string; label: string; section: DesignSection; roomId?: string };

/** Everything the user can paint, and where its finish lives in the design. */
export const PAINTABLE_PARTS: PartTarget[] = [
  { path: "exterior.wall", label: "Exterior walls", section: "walls" },
  { path: "exterior.accent", label: "Accent cladding", section: "walls" },
  { path: "exterior.base", label: "Plinth and steps", section: "walls" },
  { path: "exterior.trim", label: "Trim and columns", section: "facade" },
  { path: "exterior.roof.finish", label: "Roof covering", section: "roof" },
  { path: "exterior.roof.fascia", label: "Fascia and eaves", section: "roof" },
  { path: "exterior.roof.soffit", label: "Soffit", section: "roof" },
  { path: "exterior.window.frame", label: "Window frames", section: "windows" },
  { path: "exterior.window.glass", label: "Window glass", section: "windows" },
  { path: "exterior.door.finish", label: "Front door", section: "doors" },
  { path: "exterior.balcony.rail", label: "Balcony railing", section: "balcony" },
  { path: "exterior.balcony.slab", label: "Balcony slab", section: "balcony" },
  { path: "interior.wall", label: "Interior walls", section: "interior" },
  { path: "interior.ceiling", label: "Ceilings", section: "interior" },
  { path: "interior.door.finish", label: "Interior doors", section: "interior" },
  { path: "environment.ground", label: "Garden ground", section: "environment" },
  { path: "environment.path.finish", label: "Pathway", section: "environment" },
  { path: "environment.driveway", label: "Driveway", section: "environment" },
  { path: "environment.boundary", label: "Boundary wall", section: "environment" },
];

const PART_PATHS: Record<string, string> = {
  walls: "exterior.wall", gableWall: "exterior.wall", accent: "exterior.accent", fins: "exterior.accent", base: "exterior.base", step: "exterior.base",
  trim: "exterior.trim", column: "exterior.trim", corbel: "exterior.trim", shutter: "exterior.trim", shutterSlat: "exterior.trim", roofTrim: "exterior.trim",
  roof: "exterior.roof.finish", fascia: "exterior.roof.fascia", soffit: "exterior.roof.soffit", windowFrame: "exterior.window.frame", glass: "exterior.window.glass",
  doorGlass: "exterior.window.glass", door: "exterior.door.finish", railing: "exterior.balcony.rail", railGlass: "exterior.balcony.rail", balconySlab: "exterior.balcony.slab",
  interiorWall: "interior.wall", interiorDoor: "interior.door.finish", plot: "environment.ground", path: "environment.path.finish", drive: "environment.driveway", compound: "environment.boundary",
};

/** Resolves a clicked mesh to what the inspector should edit. */
export function targetForPart(part: string): PartTarget | null {
  for (const [prefix, which, label] of [["roomWall:", "wall", "Room walls"], ["roomFloor:", "floor", "Room floor"], ["ceiling:", "ceiling", "Room ceiling"]] as const) {
    if (part.startsWith(prefix)) {
      const roomId = part.slice(prefix.length);
      return { path: `interior.rooms.${roomId}.${which}`, label, section: "interior", roomId };
    }
  }
  const path = PART_PATHS[part];
  return (path && PAINTABLE_PARTS.find((p) => p.path === path)) || null;
}

/** A readable mesh name for model exports. */
export function partLabel(part: string): string {
  const target = targetForPart(part);
  if (target?.roomId) return `${target.label} ${target.roomId}`;
  if (target) return target.label;
  return part.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function finishAt(design: HouseDesign, path: string): Finish | undefined {
  return getAt<Finish | undefined>(design, path);
}
