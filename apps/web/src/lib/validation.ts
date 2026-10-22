import type { FloorPlan, Room } from "@houseplan/design-schema";
import { floorName } from "./floors";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  roomId?: string;
  /** Floor the issue is on (0 = ground). */
  levelIndex?: number;
};

function roomBoundsOf(room: Room) {
  const xs = room.polygon.map((p) => p[0]);
  const ys = room.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function rectsOverlap(a: ReturnType<typeof roomBoundsOf>, b: ReturnType<typeof roomBoundsOf>, tolerance = 0.05) {
  return a.minX < b.maxX - tolerance && a.maxX > b.minX + tolerance && a.minY < b.maxY - tolerance && a.maxY > b.minY + tolerance;
}

/**
 * Lightweight, synchronous geometry checks for the editor's validation panel.
 * Intentionally conservative: only flags issues that can be checked reliably
 * for the axis-aligned rectangular rooms the current tools produce.
 */
export function validateDesign(plan: FloorPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!(plan.plot.width > 0) || !(plan.plot.length > 0)) {
    issues.push({ id: "plot-dims", severity: "error", message: "Plot width and length must both be positive." });
  }
  plan.levels.forEach((level, levelIndex) => {
    const where = plan.levels.length > 1 ? `${floorName(levelIndex)}: ` : "";
    for (const issue of validateLevel(plan, level)) {
      issues.push({ ...issue, id: levelIndex === 0 ? issue.id : `${level.id}-${issue.id}`, message: where + issue.message, levelIndex });
    }
  });
  return issues;
}

function validateLevel(plan: FloorPlan, level: FloorPlan["levels"][number]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bounds = level.rooms.map((room) => ({ room, bounds: roomBoundsOf(room) }));

  for (const { room, bounds: b } of bounds) {
    if (!(b.maxX - b.minX > 0) || !(b.maxY - b.minY > 0)) {
      issues.push({ id: `invalid-dims-${room.id}`, severity: "error", message: `"${room.name}" has an invalid (zero or negative) size.`, roomId: room.id });
      continue;
    }
    if (b.minX < -0.05 || b.minY < -0.05 || b.maxX > plan.plot.width + 0.05 || b.maxY > plan.plot.length + 0.05) {
      issues.push({ id: `outside-plot-${room.id}`, severity: "error", message: `"${room.name}" extends outside the plot boundary.`, roomId: room.id });
    }
  }

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (rectsOverlap(bounds[i].bounds, bounds[j].bounds)) {
        issues.push({
          id: `overlap-${bounds[i].room.id}-${bounds[j].room.id}`,
          severity: "error",
          message: `"${bounds[i].room.name}" overlaps "${bounds[j].room.name}".`,
          roomId: bounds[i].room.id,
        });
      }
    }
  }

  for (const opening of level.openings) {
    const wall = level.walls.find((w) => w.id === opening.wallId);
    if (!wall) {
      issues.push({ id: `orphan-opening-${opening.id}`, severity: "warning", message: `A ${opening.kind} is not attached to any wall and won't be rendered in 3D.` });
      continue;
    }
    const wallLength = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    if (opening.offset < -0.05 || opening.offset > wallLength + 0.05) {
      issues.push({ id: `opening-outside-wall-${opening.id}`, severity: "error", message: `A ${opening.kind} is positioned outside the bounds of its wall.` });
    }
  }

  return issues;
}
