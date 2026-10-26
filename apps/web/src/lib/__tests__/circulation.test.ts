import { describe, expect, it } from "vitest";
import type { FloorPlan, Room } from "@houseplan/design-schema";
import { ARCHITECTURAL_DESIGNS, generateArchitecturalPlan, type ArchitecturalDesignId } from "../architectural-layouts";
import { isTerraceRoom, validateCirculation } from "../circulation";
import { validateDesign } from "../validation";

const rect = (id: string, type: Room["type"], name: string, x0: number, y0: number, x1: number, y1: number): Room => ({
  id, type, name, polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
});

function twoFloor(): FloorPlan {
  const ground = [
    rect("g-hall", "hallway", "Passage", 0, 0, 4, 30),
    rect("g-stair", "staircase", "Staircase", 4, 0, 14, 8),
    rect("g-living", "living_room", "Living", 4, 8, 20, 30),
  ];
  const first = [
    rect("f-hall", "hallway", "Passage", 0, 0, 4, 30),
    rect("f-stair", "staircase", "Staircase", 4, 0, 14, 8),
    rect("f-bed", "bedroom", "Bedroom", 14, 0, 20, 8),
    rect("f-terrace", "other", "Terrace", 4, 8, 20, 30),
  ];
  const lvl = (id: string, elevation: number, rooms: Room[]) => ({ id, elevation, wallHeight: 10, rooms, walls: [], openings: [], furniture: [] });
  return {
    schemaVersion: 1, projectId: "t", units: "ft", plot: { width: 20, length: 30, floors: 2, shape: "rectangle" },
    levels: [lvl("ground", 0, ground), lvl("first", 10, first)], metadata: { version: 1, status: "draft" },
  };
}

describe("validateCirculation", () => {
  it("accepts a stacked, reachable two-floor plan", () => {
    expect(validateCirculation(twoFloor())).toEqual([]);
  });

  it("flags a staircase that does not line up with the one below", () => {
    const p = twoFloor();
    p.levels[1].rooms[1] = rect("f-stair", "staircase", "Staircase", 10, 0, 20, 8);
    p.levels[1].rooms[2] = rect("f-bed", "bedroom", "Bedroom", 4, 0, 10, 8);
    expect(validateCirculation(p).map((i) => i.id).join()).toMatch(/stair-offset/);
  });

  it("flags a missing upper staircase (disconnected floors)", () => {
    const p = twoFloor();
    p.levels[1].rooms = p.levels[1].rooms.filter((r) => r.type !== "staircase");
    expect(validateCirculation(p).some((i) => i.id.startsWith("no-stair"))).toBe(true);
  });

  it("flags floors that do not stack to the right elevation", () => {
    const p = twoFloor();
    p.levels[1].elevation = 12;
    expect(validateCirculation(p).some((i) => i.id.startsWith("elevation-"))).toBe(true);
    p.levels[1].elevation = 10;
    p.levels[0].wallHeight = 0;
    expect(validateCirculation(p).some((i) => i.id.startsWith("height-"))).toBe(true);
  });

  it("flags a walled-in staircase and a terrace that cannot be reached", () => {
    const p = twoFloor();
    // Move the terrace away from everything and wall the stair in with a bedroom + remove the passage.
    p.levels[1].rooms = [
      rect("f-stair", "staircase", "Staircase", 4, 0, 14, 8),
      rect("f-terrace", "other", "Terrace", 14, 20, 20, 30),
    ];
    const ids = validateCirculation(p).map((i) => i.id).join();
    expect(ids).toMatch(/blocked-stair/);
    expect(ids).toMatch(/terrace-blocked/);
  });

  it("does not let people cross a bathroom to reach the terrace", () => {
    const p = twoFloor();
    p.levels[1].rooms = [
      rect("f-stair", "staircase", "Staircase", 0, 0, 10, 8),
      rect("f-bath", "bathroom", "Bath", 0, 8, 10, 16),
      rect("f-terrace", "other", "Terrace", 0, 16, 10, 30),
    ];
    expect(validateCirculation(p).some((i) => i.id.startsWith("terrace-blocked"))).toBe(true);
  });

  it("flags objects outside the plot and objects outside their room", () => {
    const p = twoFloor();
    const item = (id: string, x: number, y: number) => ({
      id, name: "Sofa", category: "seating", type: "outdoor_sofa", roomId: "f-terrace", levelId: "first",
      position: [x, y, 0] as [number, number, number], rotation: 0, scale: [1, 1, 1] as [number, number, number],
      dimensions: { width: 6, depth: 3, height: 2.5 },
    });
    p.levels[1].furniture = [item("ok", 12, 20), item("out", 19.5, 20), item("roomedge", 4.5, 12)];
    const issues = validateCirculation(p);
    expect(issues.find((i) => i.id === "furniture-outside-plot-out")?.severity).toBe("error");
    expect(issues.find((i) => i.id === "furniture-outside-room-roomedge")?.severity).toBe("warning");
    expect(issues.some((i) => i.id.endsWith("-ok"))).toBe(false);
  });

  it("recognises terrace rooms", () => {
    expect(isTerraceRoom(rect("a", "other", "Open Sky Terrace", 0, 0, 1, 1))).toBe(true);
    expect(isTerraceRoom(rect("b", "bedroom", "Terrace Suite", 0, 0, 1, 1))).toBe(false);
  });
});

describe("generated plans have sound vertical circulation", () => {
  const ids = Object.keys(ARCHITECTURAL_DESIGNS) as ArchitecturalDesignId[];
  for (const designId of ids) {
    for (const floors of [1, 2, 3]) {
      it(`${designId} with ${floors} floor(s)`, () => {
        const { plan } = generateArchitecturalPlan({ designId, plotWidth: 40, plotLength: 60, floors });
        const errors = validateCirculation(plan).filter((i) => i.severity === "error");
        expect(errors.map((e) => e.message)).toEqual([]);
        expect(validateDesign(plan).filter((i) => i.id.startsWith("no-stair") || i.id.startsWith("stair-offset"))).toEqual([]);
      });
    }
  }
});
