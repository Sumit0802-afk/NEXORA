import type { FloorPlan, FurnitureItem, Room } from "@houseplan/design-schema";
import { floorName } from "./floors";
import type { ValidationIssue } from "./validation";

/**
 * Vertical-circulation checks: staircases that connect, floor elevations, access to terraces, and furniture that stays
 * inside the plot. Geometry only (axis-aligned room rectangles); this is not a building-code or structural check.
 */

type Rect = { minX: number; minY: number; maxX: number; maxY: number };
type Level = FloorPlan["levels"][number];

const EPS = 0.05;
/** A shared wall must be at least this long (about a door) for people to walk between two rooms. */
const MIN_CONNECTION = 2.5;
/** An upper staircase must sit over at least this share of the one below. */
const MIN_STACK_OVERLAP = 0.8;

export function roomRect(room: Room): Rect {
  const xs = room.polygon.map((p) => p[0]);
  const ys = room.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** True for open-to-sky areas people use as terraces, decks or balconies. */
export function isTerraceRoom(room: Room): boolean {
  if (room.type === "balcony") return true;
  return room.type === "other" && /terrace|roof|deck|balcony|sit-?out/i.test(room.name);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return w > 0 && h > 0 ? w * h : 0;
}

const area = (r: Rect) => (r.maxX - r.minX) * (r.maxY - r.minY);

/** Length of the wall two rectangles share (0 if they only touch at a corner or not at all). */
function sharedEdge(a: Rect, b: Rect): number {
  const vertical = Math.abs(a.maxX - b.minX) <= EPS || Math.abs(b.maxX - a.minX) <= EPS;
  if (vertical) {
    return Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  }
  const horizontal = Math.abs(a.maxY - b.minY) <= EPS || Math.abs(b.maxY - a.minY) <= EPS;
  if (horizontal) {
    return Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  }
  return 0;
}

const isWet = (room: Room) => room.type === "bathroom";

/** Rooms reachable from `start` by walking through connected rooms (bathrooms are dead ends, not through-routes). */
function reachable(rooms: Room[], rects: Map<string, Rect>, start: Room): Set<string> {
  const seen = new Set<string>([start.id]);
  const queue: Room[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id !== start.id && isWet(cur)) continue; // can enter a bathroom, but not pass through it
    for (const next of rooms) {
      if (seen.has(next.id)) continue;
      if (sharedEdge(rects.get(cur.id)!, rects.get(next.id)!) >= MIN_CONNECTION) {
        seen.add(next.id);
        queue.push(next);
      }
    }
  }
  return seen;
}

function furnitureOf(level: Level): FurnitureItem[] {
  return ((level.furniture ?? []) as FurnitureItem[]).filter((f) => f && Array.isArray((f as FurnitureItem).position));
}

export function validateCirculation(plan: FloorPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const levels = plan.levels;
  const multi = levels.length > 1;

  // 1. Floor elevations must stack: each floor starts where the one below ends.
  let expected = 0;
  levels.forEach((level, i) => {
    if (!(level.wallHeight > 0)) {
      issues.push({
        id: `height-${level.id}`,
        severity: "error",
        message: `${floorName(i)} has an invalid storey height (${level.wallHeight}).`,
        fixSuggestion: "Set a positive wall height for this floor.",
        levelIndex: i,
      });
      return;
    }
    if (Math.abs(level.elevation - expected) > EPS) {
      issues.push({
        id: `elevation-${level.id}`,
        severity: "error",
        message: `${floorName(i)} starts at ${level.elevation} but the floor below ends at ${expected}.`,
        fixSuggestion: "Floors must stack: each floor's elevation equals the total height of the floors below it.",
        levelIndex: i,
      });
    }
    expected += level.wallHeight;
  });

  // 2. Staircases must exist on every floor of a multi-storey house and line up from floor to floor.
  const stairsByLevel = levels.map((l) => l.rooms.filter((r) => r.type === "staircase"));
  if (multi) {
    levels.forEach((level, i) => {
      if (stairsByLevel[i].length === 0) {
        issues.push({
          id: `no-stair-${level.id}`,
          severity: "error",
          message: `${floorName(i)} has no staircase, so it cannot be reached from the floor${i === 0 ? " above" : " below"}.`,
          fixSuggestion: "Add a staircase room on every floor, stacked directly over the one below.",
          levelIndex: i,
        });
      }
    });
    for (let i = 1; i < levels.length; i++) {
      const below = stairsByLevel[i - 1];
      for (const stair of stairsByLevel[i]) {
        const r = roomRect(stair);
        const best = Math.max(0, ...below.map((b) => overlapArea(r, roomRect(b)) / Math.max(area(r), EPS)));
        if (below.length && best < MIN_STACK_OVERLAP) {
          issues.push({
            id: `stair-offset-${levels[i].id}-${stair.id}`,
            severity: "error",
            message: `The staircase on ${floorName(i)} does not line up with the one on ${floorName(i - 1)}.`,
            fixSuggestion: "Move the staircase so it sits directly above the staircase below.",
            roomId: stair.id,
            levelIndex: i,
          });
        }
      }
    }
  }

  // 3. Each staircase needs an open side, and terraces must be reachable from it.
  levels.forEach((level, i) => {
    const rects = new Map(level.rooms.map((r) => [r.id, roomRect(r)] as const));
    const stairs = stairsByLevel[i];
    for (const stair of stairs) {
      const connected = level.rooms.some((r) => r.id !== stair.id && sharedEdge(rects.get(stair.id)!, rects.get(r.id)!) >= MIN_CONNECTION);
      if (!connected) {
        issues.push({
          id: `blocked-stair-${level.id}-${stair.id}`,
          severity: "error",
          message: `The staircase on ${floorName(i)} is walled in: no room opens onto it.`,
          fixSuggestion: "Place a passage, landing or room against one side of the staircase.",
          roomId: stair.id,
          levelIndex: i,
        });
      }
    }
    if (i === 0 || stairs.length === 0) return;
    const reach = reachable(level.rooms, rects, stairs[0]);
    for (const room of level.rooms) {
      if (isTerraceRoom(room) && !reach.has(room.id)) {
        issues.push({
          id: `terrace-blocked-${level.id}-${room.id}`,
          severity: "error",
          message: `"${room.name}" on ${floorName(i)} cannot be reached from the staircase.`,
          fixSuggestion: "Connect the terrace to the staircase through a passage or an adjoining room.",
          roomId: room.id,
          levelIndex: i,
        });
      }
    }
  });

  // 4. Furniture and terrace objects must stay on the plot, and inside their room.
  levels.forEach((level, i) => {
    const rects = new Map(level.rooms.map((r) => [r.id, roomRect(r)] as const));
    for (const item of furnitureOf(level)) {
      const w = (item.dimensions?.width ?? 0) * (item.scale?.[0] ?? 1);
      const d = (item.dimensions?.depth ?? 0) * (item.scale?.[2] ?? item.scale?.[1] ?? 1);
      // Footprint of the rotated box.
      const cos = Math.abs(Math.cos(item.rotation ?? 0));
      const sin = Math.abs(Math.sin(item.rotation ?? 0));
      const hx = (w * cos + d * sin) / 2;
      const hy = (w * sin + d * cos) / 2;
      const [x, y] = item.position;
      if (x - hx < -EPS || y - hy < -EPS || x + hx > plan.plot.width + EPS || y + hy > plan.plot.length + EPS) {
        issues.push({
          id: `furniture-outside-plot-${item.id}`,
          severity: "error",
          message: `"${item.name}" on ${floorName(i)} sticks out past the plot boundary.`,
          fixSuggestion: "Move or resize the object so it stays inside the plot.",
          levelIndex: i,
        });
        continue;
      }
      const room = rects.get(item.roomId);
      if (room && (x - hx < room.minX - EPS || y - hy < room.minY - EPS || x + hx > room.maxX + EPS || y + hy > room.maxY + EPS)) {
        issues.push({
          id: `furniture-outside-room-${item.id}`,
          severity: "warning",
          message: `"${item.name}" on ${floorName(i)} extends beyond its room.`,
          fixSuggestion: "Move or resize the object so it fits inside the room.",
          levelIndex: i,
        });
      }
    }
  });

  return issues;
}
