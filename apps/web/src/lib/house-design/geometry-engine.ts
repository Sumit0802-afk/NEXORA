import type { FloorPlan, Opening, RoomType, Wall } from "@houseplan/design-schema";
import { OPEN_TYPES, buildSceneGeometry, type RoomFloor, type SceneGeometry } from "../scene-geometry";
import type { HouseDesign } from "./schema";

/**
 * Geometry engine: what the floor plan fixes. Rooms, walls and floors come from the plan and nothing downstream may
 * change them, which `planFingerprint` lets the studio and the tests check. Design choices only reach this layer to
 * decide which extra openings the model shows on blank walls.
 */

export type Pt = [number, number];
export type Rect = { x0: number; x1: number; z0: number; z1: number };

export const EPS = 0.01;

export const rectOf = (f: RoomFloor): Rect => ({ x0: f.centerX - f.width / 2, x1: f.centerX + f.width / 2, z0: f.centerZ - f.depth / 2, z1: f.centerZ + f.depth / 2 });
export const isEnclosed = (type: RoomType, name = "") => !OPEN_TYPES.has(type) && !/terrace|deck|porch|verandah?/i.test(name);

const WINDOW_ROOMS: ReadonlySet<RoomType> = new Set<RoomType>(["living_room", "dining_room", "bedroom", "study", "kitchen", "bathroom"]);

export function subtract(from: number, to: number, blocks: Pt[]): Pt[] {
  let spans: Pt[] = [[from, to]];
  for (const [a, b] of blocks) {
    spans = spans.flatMap(([s, e]): Pt[] => {
      if (b <= s + EPS || a >= e - EPS) return [[s, e]];
      const parts: Pt[] = [];
      if (a > s + EPS) parts.push([s, a]);
      if (b < e - EPS) parts.push([b, e]);
      return parts;
    });
  }
  return spans;
}

/**
 * A copy of the plan with windows on blank exterior walls and a front door if it has none, so a plan drawn without
 * openings can still show the chosen window and door design. The stored plan is untouched, and an opening the user
 * placed is never moved.
 */
export function withFacadeOpenings(plan: FloorPlan, design: HouseDesign): FloorPlan {
  const { fillBlankWalls, proportion } = design.exterior.window;
  if (!fillBlankWalls) return plan;
  const ft = plan.units === "m" ? 0.3048 : 1;
  const plotW = plan.plot.width;
  let added = 0;
  // Ids come from position, so an edit to one opening still finds it after the plan is rebuilt.
  const slug = (levelIndex: number, edge: { axis: string; at: number; from: number }) => `${levelIndex}-${edge.axis}${Math.round(edge.at * 100)}-${Math.round(edge.from * 100)}`;
  const removed = (id: string) => Boolean(design.overrides[`window:${id}`]?.hidden);

  const levels = plan.levels.map((level, levelIndex) => {
    const rects = level.rooms
      .filter((r) => isEnclosed(r.type, r.name))
      .map((room) => {
        const xs = room.polygon.map((p) => p[0]), ys = room.polygon.map((p) => p[1]);
        return { room, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      });
    const placed = level.openings
      .map((o) => {
        const host = level.walls.find((w) => w.id === o.wallId);
        if (!host) return null;
        const dx = host.end[0] - host.start[0], dy = host.end[1] - host.start[1];
        const len = Math.hypot(dx, dy) || 1;
        return { opening: o, host, x: host.start[0] + (dx / len) * o.offset, y: host.start[1] + (dy / len) * o.offset };
      })
      .filter(Boolean) as { opening: Opening; host: Wall; x: number; y: number }[];

    type Edge = { axis: "h" | "v"; at: number; from: number; to: number; rect: (typeof rects)[number]; outward: Pt };
    const edges: Edge[] = [];
    for (const rect of rects) {
      const sides: [Edge["axis"], number, number, number, Pt][] = [
        ["h", rect.y0, rect.x0, rect.x1, [0, -1]],
        ["h", rect.y1, rect.x0, rect.x1, [0, 1]],
        ["v", rect.x0, rect.y0, rect.y1, [-1, 0]],
        ["v", rect.x1, rect.y0, rect.y1, [1, 0]],
      ];
      for (const [axis, at, from, to, outward] of sides) {
        const blocks = rects
          .filter((other) => other !== rect)
          .filter((o) => (axis === "h" ? Math.abs((outward[1] < 0 ? o.y1 : o.y0) - at) < EPS : Math.abs((outward[0] < 0 ? o.x1 : o.x0) - at) < EPS))
          .map((o): Pt => (axis === "h" ? [o.x0, o.x1] : [o.y0, o.y1]));
        for (const [a, b] of subtract(from, to, blocks)) edges.push({ axis, at, from: a, to: b, rect, outward });
      }
    }

    const walls: Wall[] = [...level.walls];
    const openings: Opening[] = [...level.openings];
    const host = (edge: Edge): Wall => {
      const wall: Wall = {
        id: `hd-wall-${slug(levelIndex, edge)}`,
        start: edge.axis === "h" ? [edge.from, edge.at] : [edge.at, edge.from],
        end: edge.axis === "h" ? [edge.to, edge.at] : [edge.at, edge.to],
        thickness: 0.75 * ft,
        height: level.wallHeight,
        kind: "exterior",
      };
      added++;
      walls.push(wall);
      return wall;
    };
    const occupied = (edge: Edge) =>
      placed.some((p) => {
        const on = edge.axis === "h" ? Math.abs(p.y - edge.at) < EPS : Math.abs(p.x - edge.at) < EPS;
        const along = edge.axis === "h" ? p.x : p.y;
        return on && along > edge.from - EPS && along < edge.to + EPS;
      });

    const hasExteriorDoor = placed.some((p) => p.opening.kind === "door" && p.host.kind === "exterior");
    const wantsDoor = levelIndex === 0 && !hasExteriorDoor;
    const doorEdge = wantsDoor
      ? [...edges]
          .filter((e) => e.outward[1] < 0 && e.to - e.from >= 4.5 * ft && !occupied(e))
          .sort((p, q) => p.at - q.at || Number(q.rect.room.type === "living_room") - Number(p.rect.room.type === "living_room") || q.to - q.from - (p.to - p.from))[0]
      : undefined;

    for (const edge of edges) {
      const type = edge.rect.room.type;
      const len = edge.to - edge.from;
      const onPlotSide = edge.axis === "v" && (edge.at < EPS || edge.at > plotW - EPS);
      const hasWindow = placed.some(
        (p) => p.opening.kind === "window" && p.x > edge.rect.x0 - EPS && p.x < edge.rect.x1 + EPS && p.y > edge.rect.y0 - EPS && p.y < edge.rect.y1 + EPS
      );
      if (edge === doorEdge) {
        const wall = host(edge);
        const width = Math.min(3.5 * ft, len - 1 * ft);
        const offset = Math.max(width / 2 + 0.5 * ft, len * 0.3);
        openings.push({ id: `hd-door-${slug(levelIndex, edge)}`, wallId: wall.id, kind: "door", offset, width, height: 7.5 * ft });
        if (WINDOW_ROOMS.has(type) && len >= 11 * ft && !removed(`hd-win-${slug(levelIndex, edge)}`)) {
          openings.push({ id: `hd-win-${slug(levelIndex, edge)}`, wallId: wall.id, kind: "window", offset: len * 0.72, width: Math.min(len * 0.34, 7 * ft), ...sizeFor(proportion, ft) });
        }
        continue;
      }
      if (!WINDOW_ROOMS.has(type) || occupied(edge) || len < 3.5 * ft) continue;
      if (onPlotSide && hasWindow) continue;
      const bath = type === "bathroom";
      const width = bath ? Math.min(2.5 * ft, len - ft) : Math.min(len - 2 * ft, proportion === "full" ? 10 * ft : proportion === "tall" ? 6 * ft : 4.5 * ft);
      const count = !bath && len >= 17 * ft ? 2 : 1;
      const wall = host(edge);
      for (let i = 0; i < count; i++) {
        if (removed(`hd-win-${slug(levelIndex, edge)}-${i}`)) continue;
        openings.push({
          id: `hd-win-${slug(levelIndex, edge)}-${i}`, wallId: wall.id, kind: "window", offset: (len * (2 * i + 1)) / (2 * count), width,
          ...(bath ? { sillHeight: 5 * ft, height: 2.2 * ft } : sizeFor(proportion, ft)),
        });
      }
    }
    return { ...level, walls, openings };
  });
  return added ? { ...plan, levels } : plan;
}

function sizeFor(proportion: HouseDesign["exterior"]["window"]["proportion"], ft: number) {
  if (proportion === "full") return { sillHeight: 0.6 * ft, height: 7.4 * ft };
  if (proportion === "tall") return { sillHeight: 2 * ft, height: 5.8 * ft };
  return { sillHeight: 3 * ft, height: 4 * ft };
}

/** Covers the cells of a rectilinear area with as few rectangles as a greedy pass finds, largest first. */
export function mergeRects(rects: Rect[], minus: Rect[] = []): Rect[] {
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]).concat(minus.flatMap((r) => [r.x0, r.x1])).map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap((r) => [r.z0, r.z1]).concat(minus.flatMap((r) => [r.z0, r.z1])).map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const nx = xs.length - 1, nz = zs.length - 1;
  if (nx < 1 || nz < 1) return [];
  const inside = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const grid: boolean[][] = [];
  for (let i = 0; i < nx; i++) {
    grid[i] = [];
    for (let j = 0; j < nz; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      grid[i][j] = rects.some((r) => inside(r, cx, cz)) && !minus.some((r) => inside(r, cx, cz));
    }
  }
  const out: Rect[] = [];
  for (;;) {
    let best: { i0: number; i1: number; j0: number; j1: number; area: number } | null = null;
    for (let i0 = 0; i0 < nx; i0++) {
      for (let j0 = 0; j0 < nz; j0++) {
        if (!grid[i0][j0]) continue;
        let maxJ = nz - 1;
        for (let i1 = i0; i1 < nx && grid[i1][j0]; i1++) {
          let j = j0;
          while (j + 1 <= maxJ && grid[i1][j + 1]) j++;
          maxJ = Math.min(maxJ, j);
          const area = (xs[i1 + 1] - xs[i0]) * (zs[maxJ + 1] - zs[j0]);
          if (!best || area > best.area) best = { i0, i1, j0, j1: maxJ, area };
        }
      }
    }
    if (!best) break;
    for (let i = best.i0; i <= best.i1; i++) for (let j = best.j0; j <= best.j1; j++) grid[i][j] = false;
    out.push({ x0: xs[best.i0], x1: xs[best.i1 + 1], z0: zs[best.j0], z1: zs[best.j1 + 1] });
  }
  return out;
}

/** What decides which openings the model adds. Nothing else in a design reaches the base geometry. */
export function openingsKey(design: HouseDesign): string {
  const { fillBlankWalls, proportion } = design.exterior.window;
  const removed = Object.keys(design.overrides).filter((id) => id.startsWith("window:") && design.overrides[id].hidden).sort();
  return JSON.stringify([fillBlankWalls, proportion, removed]);
}

/** A short hash of everything that defines the house's layout. Furniture and room colours are not layout. */
export function planFingerprint(plan: FloorPlan): string {
  const layout = {
    units: plan.units,
    plot: plan.plot,
    levels: plan.levels.map((level) => ({
      elevation: level.elevation,
      wallHeight: level.wallHeight,
      rooms: level.rooms.map((r) => [r.id, r.type, r.polygon]),
      walls: level.walls.map((w) => [w.id, w.start, w.end, w.thickness, w.height, w.kind]),
      openings: level.openings.map((o) => [o.id, o.wallId, o.kind, o.offset, o.width, o.height, o.sillHeight]),
    })),
  };
  const text = JSON.stringify(layout);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export type RoomMeasure = { id: string; level: number; width: number; depth: number };

export function roomMeasures(geometry: SceneGeometry): RoomMeasure[] {
  return geometry.floors.map((f) => ({ id: f.id, level: f.level, width: f.width, depth: f.depth }));
}

export type BaseGeometry = { renderPlan: FloorPlan; geometry: SceneGeometry; fingerprint: string };

/** The plan as the model will show it: the stored plan plus any openings added to blank walls. */
export function baseGeometry(plan: FloorPlan, design: HouseDesign): BaseGeometry {
  const renderPlan = withFacadeOpenings(plan, design);
  return { renderPlan, geometry: buildSceneGeometry(renderPlan), fingerprint: planFingerprint(plan) };
}
