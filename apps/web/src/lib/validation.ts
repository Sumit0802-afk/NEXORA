import type { FloorPlan, Room } from "@houseplan/design-schema";
import { floorName } from "./floors";
import { validateCirculation } from "./circulation";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  fixSuggestion?: string;
  roomId?: string;
  wallId?: string;
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
    issues.push({
      id: "plot-dims",
      severity: "error",
      message: "Plot width and length must both be positive.",
      fixSuggestion: "Enter positive numbers for plot width and length in the Properties sidebar.",
    });
  }
  plan.levels.forEach((level, levelIndex) => {
    const where = plan.levels.length > 1 ? `${floorName(levelIndex)}: ` : "";
    for (const issue of validateLevel(plan, level)) {
      issues.push({
        ...issue,
        id: levelIndex === 0 ? issue.id : `${level.id}-${issue.id}`,
        message: where + issue.message,
        levelIndex,
      });
    }
  });
  issues.push(...validateCirculation(plan));
  return issues;
}

function validateLevel(plan: FloorPlan, level: FloorPlan["levels"][number]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bounds = level.rooms.map((room) => ({ room, bounds: roomBoundsOf(room) }));

  for (const { room, bounds: b } of bounds) {
    if (!(b.maxX - b.minX > 0) || !(b.maxY - b.minY > 0)) {
      issues.push({
        id: `invalid-dims-${room.id}`,
        severity: "error",
        message: `"${room.name}" has an invalid (zero or negative) size.`,
        fixSuggestion: "Drag corner resize handles to expand the room to valid dimensions.",
        roomId: room.id,
      });
      continue;
    }
    if (b.minX < -0.05 || b.minY < -0.05 || b.maxX > plan.plot.width + 0.05 || b.maxY > plan.plot.length + 0.05) {
      issues.push({
        id: `outside-plot-${room.id}`,
        severity: "error",
        message: `"${room.name}" extends outside the plot boundary.`,
        fixSuggestion: "Move or resize this room so it stays within the outer plot boundary.",
        roomId: room.id,
      });
    }
  }

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (rectsOverlap(bounds[i].bounds, bounds[j].bounds)) {
        issues.push({
          id: `overlap-${bounds[i].room.id}-${bounds[j].room.id}`,
          severity: "error",
          message: `"${bounds[i].room.name}" overlaps "${bounds[j].room.name}".`,
          fixSuggestion: "Reposition or resize one of the rooms so their footprints do not intersect.",
          roomId: bounds[i].room.id,
        });
      }
    }
  }

  for (const wall of level.walls) {
    const len = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    if (len < 0.25) {
      issues.push({
        id: `short-wall-${wall.id}`,
        severity: "warning",
        message: `A wall segment is very short or zero-length (${len.toFixed(2)} ${plan.units}).`,
        fixSuggestion: "Delete this wall segment or drag its endpoints to give it adequate length.",
        wallId: wall.id,
      });
    }
  }

  // Check openings
  for (let i = 0; i < level.openings.length; i++) {
    const opening = level.openings[i];
    const wall = level.walls.find((w) => w.id === opening.wallId);
    if (!wall) {
      issues.push({
        id: `orphan-opening-${opening.id}`,
        severity: "warning",
        message: `A ${opening.kind} is not attached to any wall and won't be rendered in 3D.`,
        fixSuggestion: "Place the opening directly on an existing wall.",
      });
      continue;
    }
    const wallLength = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    if (opening.offset < -0.05 || opening.offset > wallLength + 0.05) {
      issues.push({
        id: `opening-outside-wall-${opening.id}`,
        severity: "error",
        message: `A ${opening.kind} is positioned outside the bounds of its wall.`,
        fixSuggestion: "Move the opening along the wall so it sits within the wall ends.",
      });
    }

    // Check overlap with other openings on the same wall
    for (let j = i + 1; j < level.openings.length; j++) {
      const other = level.openings[j];
      if (other.wallId === opening.wallId) {
        const minDistance = (opening.width + other.width) / 2;
        if (Math.abs(opening.offset - other.offset) < minDistance - 0.1) {
          issues.push({
            id: `overlap-openings-${opening.id}-${other.id}`,
            severity: "warning",
            message: `Two openings (${opening.kind} and ${other.kind}) overlap on the same wall.`,
            fixSuggestion: "Space out the openings so they don't occupy the same wall space.",
          });
        }
      }
    }
  }

  return issues;
}
