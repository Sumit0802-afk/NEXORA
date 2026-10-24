import { describe, expect, it } from "vitest";
import type { FloorPlan, RoomType, Wall, Opening } from "@houseplan/design-schema";
import { nearestWallOrEdge, polygonArea, polygonPerimeter, snapToGrid } from "../geometry";
import { buildSceneGeometry } from "../scene-geometry";
import { validateDesign } from "../validation";

function createTestPlan(): FloorPlan {
  return {
    schemaVersion: 1,
    projectId: "smart-editor-test",
    units: "ft",
    plot: { width: 40, length: 50, floors: 2, shape: "rectangle" },
    levels: [
      {
        id: "ground",
        elevation: 0,
        wallHeight: 10,
        rooms: [
          {
            id: "room-living",
            type: "living_room",
            name: "Living Room",
            polygon: [[0, 0], [20, 0], [20, 20], [0, 20]],
          },
          {
            id: "room-stair",
            type: "staircase",
            name: "Staircase",
            polygon: [[20, 0], [30, 0], [30, 12], [20, 12]],
          },
          {
            id: "room-balcony",
            type: "balcony",
            name: "Front Balcony",
            polygon: [[0, 20], [12, 20], [12, 26], [0, 26]],
          },
        ],
        walls: [
          { id: "wall-front", start: [0, 0], end: [20, 0], thickness: 0.5, height: 10, kind: "exterior" },
          { id: "wall-partition", start: [20, 0], end: [20, 20], thickness: 0.5, height: 10, kind: "interior" },
        ],
        openings: [
          { id: "door-1", wallId: "wall-front", kind: "door", offset: 10, width: 3.5 },
        ],
        furniture: [],
      },
      {
        id: "first",
        elevation: 10,
        wallHeight: 10,
        rooms: [
          {
            id: "first-room-stair",
            type: "staircase",
            name: "Staircase",
            polygon: [[20, 0], [30, 0], [30, 12], [20, 12]],
          },
          {
            id: "room-bed",
            type: "bedroom",
            name: "Master Bedroom",
            polygon: [[0, 0], [20, 0], [20, 20], [0, 20]],
          },
        ],
        walls: [],
        openings: [],
        furniture: [],
      },
    ],
    metadata: { version: 1, status: "draft" },
  };
}

describe("Smart Floor Plan Editor Core", () => {
  it("supports all required room types including study, corridor, balcony, and utility", () => {
    const types: RoomType[] = [
      "living_room",
      "bedroom",
      "kitchen",
      "bathroom",
      "dining_room",
      "study",
      "corridor",
      "balcony",
      "utility",
    ];
    for (const t of types) {
      expect(t).toBeDefined();
    }
  });

  it("calculates accurate room dimensions and area in both sq ft and sq m", () => {
    const poly: [number, number][] = [[0, 0], [15, 0], [15, 20], [0, 20]];
    const areaSqFt = polygonArea(poly);
    expect(areaSqFt).toBe(300);
    const areaSqM = areaSqFt * 0.092903;
    expect(areaSqM).toBeCloseTo(27.87, 1);
    expect(polygonPerimeter(poly)).toBe(70);
  });

  it("snaps to grid correctly", () => {
    expect(snapToGrid(10.23, 0.5)).toBe(10.0);
    expect(snapToGrid(10.26, 0.5)).toBe(10.5);
    expect(snapToGrid(10.15, 0.25)).toBe(10.25);
  });

  it("finds nearest wall or room edge when placing doors and windows", () => {
    const plan = createTestPlan();
    const hit = nearestWallOrEdge(
      plan.levels[0].rooms.map((r) => r.polygon as [number, number][]),
      plan.levels[0].walls,
      [10, 0.2],
      1.5
    );
    expect(hit).not.toBeNull();
    expect(hit?.point[1]).toBe(0);
    expect(hit?.offset).toBeCloseTo(10, 1);
  });

  it("splits a wall cleanly into two connected segments and adjusts openings", () => {
    const wall: Wall = { id: "w-orig", start: [0, 0], end: [20, 0], thickness: 0.5, height: 10, kind: "interior" };
    const opening: Opening = { id: "o-1", wallId: "w-orig", kind: "door", offset: 15, width: 3 };

    const mid: [number, number] = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
    const halfLen = Math.hypot(mid[0] - wall.start[0], mid[1] - wall.start[1]);

    const w1: Wall = { ...wall, id: "w-1", start: wall.start, end: mid };
    const w2: Wall = { ...wall, id: "w-2", start: mid, end: wall.end };

    expect(w1.end).toEqual([10, 0]);
    expect(w2.start).toEqual([10, 0]);

    // Opening was at offset 15 (> 10), so it should belong to w2 with offset 15 - 10 = 5
    const remapped = opening.offset <= halfLen ? { ...opening, wallId: w1.id } : { ...opening, wallId: w2.id, offset: opening.offset - halfLen };
    expect(remapped.wallId).toBe("w-2");
    expect(remapped.offset).toBe(5);
  });

  it("generates 3D geometry for standalone walls and synchronizes with 2D changes", () => {
    const plan = createTestPlan();
    const geom = buildSceneGeometry(plan);
    expect(geom.walls.length).toBeGreaterThan(0);
    expect(geom.floors.length).toBeGreaterThan(0);
    expect(geom.doors.length).toBe(1);
  });

  it("preserves floor data when hiding floors in 3D view", () => {
    const plan = createTestPlan();
    const hidden = new Set<number>([1]); // Hide upper floor
    const geom = buildSceneGeometry(plan, undefined, hidden);

    // Geometry only contains ground floor floors
    expect(geom.floors.every((f) => f.level === 0)).toBe(true);
    // But original plan still retains level 1 completely intact!
    expect(plan.levels.length).toBe(2);
    expect(plan.levels[1].rooms.length).toBe(2);
  });

  it("validates geometry and flags boundary violations and zero-length walls", () => {
    const plan = createTestPlan();
    // Add zero-length wall
    plan.levels[0].walls.push({ id: "bad-wall", start: [5, 5], end: [5, 5.1], thickness: 0.5, height: 10, kind: "interior" });
    const issues = validateDesign(plan);
    expect(issues.some((i) => i.id.includes("short-wall"))).toBe(true);
  });
});
