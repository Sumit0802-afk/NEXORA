import { describe, expect, it } from "vitest";
import { buildSceneGeometry, computeCameraFraming } from "../scene-geometry";
import { floorName, floorsLabel } from "../floors";
import type { FloorPlan } from "@houseplan/design-schema";

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function twoFloors(): FloorPlan {
  return {
    schemaVersion: 1,
    projectId: "test",
    units: "ft",
    plot: { width: 30, length: 40, floors: 2, shape: "rectangle" },
    levels: [
      {
        id: "ground", elevation: 0, wallHeight: 10, walls: [], openings: [], furniture: [],
        rooms: [
          { id: "room-living", type: "living_room", name: "Living", polygon: rect(0, 0, 20, 16) },
          { id: "room-stair", type: "staircase", name: "Staircase", polygon: rect(20, 0, 30, 16) },
          { id: "room-yard", type: "other", name: "Back yard", polygon: rect(0, 16, 30, 40) },
        ],
      },
      {
        id: "first", elevation: 10, wallHeight: 10, walls: [], openings: [], furniture: [],
        rooms: [
          { id: "first-room-bed", type: "bedroom", name: "Bedroom 2", polygon: rect(0, 0, 12, 16) },
          { id: "first-room-terrace", type: "other", name: "Terrace", polygon: rect(12, 0, 20, 16) },
          { id: "first-room-stair", type: "staircase", name: "Staircase", polygon: rect(20, 0, 30, 16) },
        ],
      },
    ],
    metadata: { version: 1, status: "generated" },
  };
}

describe("multi-floor scene geometry", () => {
  it("stacks the upper floor at its elevation", () => {
    const g = buildSceneGeometry(twoFloors());
    expect(g.levelCount).toBe(2);
    const bed = g.floors.find((f) => f.id === "first-room-bed")!;
    expect(bed.level).toBe(1);
    expect(bed.baseY).toBe(10);
    const upperWalls = g.walls.filter((w) => w.id.startsWith("first-"));
    expect(upperWalls.length).toBeGreaterThan(0);
    expect(upperWalls.every((w) => w.baseY >= 10)).toBe(true);
    expect(g.walls.filter((w) => !w.id.startsWith("first-")).every((w) => w.baseY < 10)).toBe(true);
  });

  it("hides floors above topLevel", () => {
    const g = buildSceneGeometry(twoFloors(), 0);
    expect(g.levelCount).toBe(1);
    expect(g.floors.every((f) => f.level === 0)).toBe(true);
    expect(g.walls.every((w) => w.baseY + w.height <= 10)).toBe(true);
  });

  it("gives an upstairs terrace edge a parapet, not a full wall", () => {
    const g = buildSceneGeometry(twoFloors());
    // The terrace's rear edge (y = 16) faces open air above the ground-floor yard.
    const parapet = g.walls.find((w) => w.id.startsWith("first-") && w.kind === "boundary" && Math.abs(w.centerZ - (16 - 20)) < 0.01);
    expect(parapet).toBeDefined();
    expect(parapet!.height).toBeLessThan(10);
  });

  it("frames the camera for the full height", () => {
    const one = computeCameraFraming(buildSceneGeometry(twoFloors(), 0));
    const both = computeCameraFraming(buildSceneGeometry(twoFloors()));
    expect(both.distance).toBeGreaterThanOrEqual(one.distance);
  });

  it("names floors", () => {
    expect([0, 1, 2].map(floorName)).toEqual(["Ground floor", "First floor", "Second floor"]);
    expect([1, 2, 3].map(floorsLabel)).toEqual(["G", "G+1", "G+2"]);
  });
});
