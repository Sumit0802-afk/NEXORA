import type { FloorPlan, FurnitureItem, Room } from "@houseplan/design-schema";
import { isTerraceRoom, roomRect } from "./circulation";
import { getTerraceFurnitureById, TERRACE_FURNITURE_CATALOG } from "./terrace-catalog";

/**
 * Terrace layouts with real, editable furniture. A terrace area is an open-to-sky room on an upper floor. Each style
 * below places catalogue objects (seating, planters, pergolas, an outdoor kitchen, a walking path, lights, utility
 * items) as ordinary furniture items on that floor, so they show up and can be edited in 2D, in 3D and in exports.
 *
 * Layouts are written in a local frame where the terrace's entry (the side next to the staircase or passage) is at the
 * bottom and the far wall at the top, so every style keeps the way in clear and works whichever way the plan faces.
 */

export type TerraceStyleId = "modern_minimalist" | "indian_family" | "rooftop_garden" | "luxury_lounge" | "compact" | "party";

export interface TerraceStyleSpec {
  id: TerraceStyleId;
  name: string;
  tagline: string;
  /** What goes where, in the local frame. */
  pieces: Piece[];
}

type Piece = {
  type: string;
  /** Centre as a fraction of the terrace (fx: left to right, fy: far wall 0 to entry 1). */
  at: [number, number];
  /** Quarter turns (0-3) relative to facing the entry. */
  turns?: 0 | 1 | 2 | 3;
  /** Uniform size multiplier. */
  size?: number;
  color?: string;
};

export const TERRACE_STYLES: TerraceStyleSpec[] = [
  {
    id: "modern_minimalist",
    name: "Modern Minimalist",
    tagline: "Clean lounge, few pieces, generous open floor",
    pieces: [
      { type: "outdoor_sofa", at: [0.5, 0.1] },
      { type: "outdoor_coffee_table", at: [0.5, 0.3] },
      { type: "planter_box", at: [0.14, 0.1], turns: 1 },
      { type: "planter_box", at: [0.86, 0.1], turns: 1 },
      { type: "light_post", at: [0.04, 0.96] },
      { type: "light_post", at: [0.96, 0.96] },
    ],
  },
  {
    id: "indian_family",
    name: "Indian Family Terrace",
    tagline: "Jhula swing, planters, a corner for tanks and drying",
    pieces: [
      { type: "indian_jhula", at: [0.5, 0.12] },
      { type: "terracotta_planter", at: [0.12, 0.12] },
      { type: "terracotta_planter", at: [0.88, 0.12] },
      { type: "terracotta_planter", at: [0.12, 0.45] },
      { type: "garden_bench", at: [0.86, 0.45], turns: 1 },
      { type: "water_tank", at: [0.9, 0.9] },
      { type: "drying_rack", at: [0.15, 0.9] },
      { type: "light_post", at: [0.5, 0.96] },
    ],
  },
  {
    id: "rooftop_garden",
    name: "Rooftop Garden",
    tagline: "Planters all round, a pergola and a lounger",
    pieces: [
      { type: "pergola", at: [0.5, 0.18] },
      { type: "garden_bench", at: [0.5, 0.1] },
      { type: "planter_box", at: [0.13, 0.1], turns: 1 },
      { type: "planter_box", at: [0.87, 0.1], turns: 1 },
      { type: "planter_box", at: [0.13, 0.5], turns: 1 },
      { type: "planter_box", at: [0.87, 0.5], turns: 1 },
      { type: "terracotta_planter", at: [0.3, 0.6] },
      { type: "terracotta_planter", at: [0.7, 0.6] },
      { type: "sun_lounger", at: [0.5, 0.6], turns: 1 },
      { type: "light_post", at: [0.04, 0.96] },
      { type: "light_post", at: [0.96, 0.96] },
    ],
  },
  {
    id: "luxury_lounge",
    name: "Luxury Lounge",
    tagline: "Pergola seating, loungers and an outdoor kitchen",
    pieces: [
      { type: "pergola", at: [0.36, 0.2] },
      { type: "outdoor_sofa", at: [0.36, 0.1] },
      { type: "outdoor_coffee_table", at: [0.36, 0.28] },
      { type: "sun_lounger", at: [0.82, 0.22] },
      { type: "sun_lounger", at: [0.82, 0.5] },
      { type: "outdoor_kitchen", at: [0.26, 0.62] },
      { type: "planter_box", at: [0.88, 0.8], turns: 1 },
      { type: "light_post", at: [0.04, 0.96] },
      { type: "light_post", at: [0.96, 0.96] },
    ],
  },
  {
    id: "compact",
    name: "Compact Terrace",
    tagline: "Two seats, a table and a planter for small terraces",
    pieces: [
      { type: "garden_bench", at: [0.5, 0.1] },
      { type: "outdoor_coffee_table", at: [0.5, 0.35], size: 0.8 },
      { type: "terracotta_planter", at: [0.12, 0.12] },
      { type: "terracotta_planter", at: [0.88, 0.12] },
    ],
  },
  {
    id: "party",
    name: "Party Terrace",
    tagline: "Dining for a crowd, bar counter, shade and lights",
    pieces: [
      { type: "outdoor_dining_set", at: [0.3, 0.2] },
      { type: "outdoor_dining_set", at: [0.72, 0.2] },
      { type: "outdoor_parasol", at: [0.3, 0.55] },
      { type: "outdoor_parasol", at: [0.72, 0.55] },
      { type: "outdoor_kitchen", at: [0.5, 0.08] },
      { type: "bbq_grill", at: [0.88, 0.6] },
      { type: "planter_box", at: [0.12, 0.6], turns: 1 },
      { type: "light_post", at: [0.04, 0.04] },
      { type: "light_post", at: [0.96, 0.04] },
      { type: "light_post", at: [0.04, 0.96] },
      { type: "light_post", at: [0.96, 0.96] },
    ],
  },
];

export function getTerraceStyle(id: TerraceStyleId): TerraceStyleSpec {
  return TERRACE_STYLES.find((s) => s.id === id)!;
}

// ── finding the terrace ──────────────────────────────────────────────────────

export type TerraceArea = { levelIndex: number; room: Room };

/** Terrace rooms on upper floors, the biggest first. */
export function findTerraces(plan: FloorPlan): TerraceArea[] {
  const out: TerraceArea[] = [];
  plan.levels.forEach((level, levelIndex) => {
    if (levelIndex === 0) return;
    for (const room of level.rooms) if (isTerraceRoom(room)) out.push({ levelIndex, room });
  });
  const size = (a: TerraceArea) => {
    const r = roomRect(a.room);
    return (r.maxX - r.minX) * (r.maxY - r.minY);
  };
  return out.sort((a, b) => b.levelIndex - a.levelIndex || size(b) - size(a));
}

type Side = "N" | "S" | "E" | "W";
type Rect = ReturnType<typeof roomRect>;

/** Which side of the terrace people walk in from: the longest wall it shares with a staircase, passage or room. */
function entrySide(terrace: Rect, others: Rect[]): Side {
  const EPS = 0.05;
  const score: Record<Side, number> = { N: 0, S: 0, E: 0, W: 0 };
  for (const o of others) {
    const vOverlap = Math.max(0, Math.min(terrace.maxY, o.maxY) - Math.max(terrace.minY, o.minY));
    const hOverlap = Math.max(0, Math.min(terrace.maxX, o.maxX) - Math.max(terrace.minX, o.minX));
    if (Math.abs(terrace.minY - o.maxY) <= EPS) score.N += hOverlap;
    if (Math.abs(terrace.maxY - o.minY) <= EPS) score.S += hOverlap;
    if (Math.abs(terrace.minX - o.maxX) <= EPS) score.W += vOverlap;
    if (Math.abs(terrace.maxX - o.minX) <= EPS) score.E += vOverlap;
  }
  const best = (Object.entries(score) as [Side, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "S";
}

// ── placing a style ──────────────────────────────────────────────────────────

const MARGIN = 0.4;

type Box = { x0: number; y0: number; x1: number; y1: number };

const overlaps = (a: Box, b: Box, gap = 0.15) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap;

export interface PlacedTerrace {
  items: FurnitureItem[];
  /** Pieces left out because the terrace was too small for them. */
  skipped: string[];
  entry: Side;
}

let uid = 0;
const newId = (type: string) => `terrace-${type}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

export function makeTerraceItem(type: string, roomId: string, levelId: string, position: [number, number], rotation: number, unitScale: number, color?: string): FurnitureItem {
  const spec = getTerraceFurnitureById(type) ?? TERRACE_FURNITURE_CATALOG[0];
  return {
    id: newId(type),
    name: spec.name,
    category: "terrace",
    type: spec.type,
    roomId,
    levelId,
    position: [position[0], position[1], 0],
    rotation,
    scale: [1, 1, 1],
    dimensions: { width: spec.dimensions.width * unitScale, depth: spec.dimensions.depth * unitScale, height: spec.dimensions.height * unitScale },
    material: { color: color ?? spec.defaultColor },
  };
}

/**
 * Arranges `style` on one terrace room. Nothing is ever placed outside the room, on the walking path from the entry, or
 * on top of another piece; a piece that cannot fit is skipped and reported.
 */
export function layoutTerrace(plan: FloorPlan, area: TerraceArea, styleId: TerraceStyleId): PlacedTerrace {
  const level = plan.levels[area.levelIndex];
  const rect = roomRect(area.room);
  const unitScale = plan.units === "m" ? 0.3048 : 1;
  const others = level.rooms.filter((r) => r.id !== area.room.id).map(roomRect);
  const entry = entrySide(rect, others);

  const W = rect.maxX - rect.minX;
  const H = rect.maxY - rect.minY;
  const inner: Box = { x0: rect.minX + MARGIN * unitScale, y0: rect.minY + MARGIN * unitScale, x1: rect.maxX - MARGIN * unitScale, y1: rect.maxY - MARGIN * unitScale };

  // Local frame -> world: (fx, fy) with fy = 1 at the entry wall.
  const toWorld = (fx: number, fy: number): [number, number] => {
    switch (entry) {
      case "S": return [rect.minX + fx * W, rect.minY + fy * H];
      case "N": return [rect.minX + (1 - fx) * W, rect.minY + (1 - fy) * H];
      case "E": return [rect.minX + fy * W, rect.minY + (1 - fx) * H];
      case "W": return [rect.minX + (1 - fy) * W, rect.minY + fx * H];
    }
  };
  // Quarter turns that map "facing the entry" to the world, as radians.
  const baseTurns = { S: 0, N: 2, E: 3, W: 1 }[entry];

  const placed: { box: Box; item: FurnitureItem }[] = [];
  const skipped: string[] = [];
  const items: FurnitureItem[] = [];

  const footprint = (item: FurnitureItem, turns: number): [number, number] => {
    const odd = turns % 2 === 1;
    const w = item.dimensions.width * item.scale[0];
    const d = item.dimensions.depth * item.scale[2];
    return odd ? [d, w] : [w, d];
  };

  // The walking path runs from the entry wall into the terrace, kept clear of everything else.
  const pathLen = Math.min((entry === "N" || entry === "S" ? H : W) * 0.45, 14 * unitScale);
  const pathWidth = 2.6 * unitScale;
  let pathBox: Box | null = null;
  const pathCentre = toWorld(0.5, 1);
  if (pathLen >= 3.5 * unitScale && Math.min(W, H) >= 7 * unitScale) {
    const along = entry === "N" || entry === "S";
    const px = along ? pathCentre[0] : entry === "E" ? rect.maxX - pathLen / 2 : rect.minX + pathLen / 2;
    const py = along ? (entry === "S" ? rect.maxY - pathLen / 2 : rect.minY + pathLen / 2) : pathCentre[1];
    const path = makeTerraceItem("walking_path", area.room.id, level.id, [px, py], along ? 0 : Math.PI / 2, unitScale);
    path.dimensions = { ...path.dimensions, width: pathWidth, depth: pathLen };
    pathBox = along ? { x0: px - pathWidth / 2, x1: px + pathWidth / 2, y0: py - pathLen / 2, y1: py + pathLen / 2 } : { x0: px - pathLen / 2, x1: px + pathLen / 2, y0: py - pathWidth / 2, y1: py + pathWidth / 2 };
    items.push(path);
  }

  for (const piece of getTerraceStyle(styleId).pieces) {
    const turns = (((piece.turns ?? 0) + baseTurns) % 4) as 0 | 1 | 2 | 3;
    const [cx, cy] = toWorld(piece.at[0], piece.at[1]);
    const item = makeTerraceItem(piece.type, area.room.id, level.id, [cx, cy], (turns * Math.PI) / 2, unitScale, piece.color);
    if (piece.size && piece.size !== 1) item.scale = [piece.size, piece.size, piece.size];
    // Shrink a piece a little, down to 60%, before giving up on it, so small terraces still get a sensible layout.
    const shades = piece.type === "pergola";
    let fit: { x: number; y: number; box: Box; scale: number } | null = null;
    for (const f of [1, 0.85, 0.7, 0.6]) {
      const sc = (piece.size ?? 1) * f;
      item.scale = [sc, sc, sc];
      const [fw, fd] = footprint(item, turns);
      if (fw > inner.x1 - inner.x0 + 1e-6 || fd > inner.y1 - inner.y0 + 1e-6) continue;
      const x = Math.min(Math.max(cx, inner.x0 + fw / 2), inner.x1 - fw / 2);
      const y = Math.min(Math.max(cy, inner.y0 + fd / 2), inner.y1 - fd / 2);
      const box: Box = { x0: x - fw / 2, x1: x + fw / 2, y0: y - fd / 2, y1: y + fd / 2 };
      // Pergolas shade other pieces on purpose; everything else must not collide.
      const hit = (pathBox && !shades && overlaps(box, pathBox, 0)) || placed.some((p) => (p.item.type === "pergola" || shades ? false : overlaps(box, p.box)) || (p.item.type === "pergola" && shades && overlaps(box, p.box, 0)));
      if (!hit) { fit = { x, y, box, scale: sc }; break; }
    }
    if (!fit) {
      skipped.push(item.name);
      continue;
    }
    const { x, y, box } = fit;
    item.position = [x, y, 0];
    placed.push({ box, item });
    items.push(item);
  }
  return { items, skipped, entry };
}

/** Replaces any terrace furniture on this terrace with the chosen style; other furniture is left alone. */
export function applyTerraceStyle(plan: FloorPlan, area: TerraceArea, styleId: TerraceStyleId): { plan: FloorPlan; skipped: string[] } {
  const { items, skipped } = layoutTerrace(plan, area, styleId);
  const levels = plan.levels.map((level, i) => {
    if (i !== area.levelIndex) return level;
    const kept = ((level.furniture ?? []) as FurnitureItem[]).filter((f) => !(f.roomId === area.room.id && f.category === "terrace"));
    return { ...level, furniture: [...kept, ...items] };
  });
  return { plan: { ...plan, levels }, skipped };
}

export function clearTerraceFurniture(plan: FloorPlan, area: TerraceArea): FloorPlan {
  const levels = plan.levels.map((level, i) =>
    i !== area.levelIndex ? level : { ...level, furniture: ((level.furniture ?? []) as FurnitureItem[]).filter((f) => !(f.roomId === area.room.id && f.category === "terrace")) },
  );
  return { ...plan, levels };
}

export function terraceItems(plan: FloorPlan, area: TerraceArea): FurnitureItem[] {
  return ((plan.levels[area.levelIndex].furniture ?? []) as FurnitureItem[]).filter((f) => f.roomId === area.room.id && f.category === "terrace");
}
