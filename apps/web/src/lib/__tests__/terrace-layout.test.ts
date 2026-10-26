import { describe, expect, it } from "vitest";
import type { FloorPlan, FurnitureItem, Room } from "@houseplan/design-schema";
import { generateArchitecturalPlan, ARCHITECTURAL_DESIGNS } from "../architectural-layouts";
import { roomRect, validateCirculation } from "../circulation";
import { generateSingleFloorSvg } from "../export-2d";
import { TERRACE_STYLES, applyTerraceStyle, clearTerraceFurniture, findTerraces, terraceItems } from "../terrace-layout";

const rect = (id: string, type: Room["type"], name: string, x0: number, y0: number, x1: number, y1: number): Room => ({
  id, type, name, polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
});

function house(w = 20, l = 30, units: "ft" | "m" = "ft"): FloorPlan {
  const lvl = (id: string, elevation: number, rooms: Room[]) => ({ id, elevation, wallHeight: 10, rooms, walls: [], openings: [], furniture: [] });
  return {
    schemaVersion: 1, projectId: "t", units, plot: { width: w, length: l, floors: 2, shape: "rectangle" },
    levels: [
      lvl("ground", 0, [rect("g-stair", "staircase", "Staircase", 0, 0, 8, 8), rect("g-living", "living_room", "Living", 0, 8, w, l)]),
      lvl("first", 10, [rect("f-stair", "staircase", "Staircase", 0, 0, 8, 8), rect("f-terrace", "other", "Terrace", 0, 8, w, l)]),
    ],
    metadata: { version: 1, status: "draft" },
  } as FloorPlan;
}

describe("terrace styles", () => {
  for (const style of TERRACE_STYLES) {
    it(`${style.id} stays inside the terrace, off the path and without overlaps`, () => {
      const plan = house();
      const area = findTerraces(plan)[0];
      const { plan: out } = applyTerraceStyle(plan, area, style.id);
      const items = terraceItems(out, area);
      expect(items.length).toBeGreaterThan(2);
      const r = roomRect(area.room);
      for (const f of items) {
        const odd = Math.round(f.rotation / (Math.PI / 2)) % 2 !== 0;
        const w = (odd ? f.dimensions.depth : f.dimensions.width) * f.scale[0];
        const d = (odd ? f.dimensions.width : f.dimensions.depth) * f.scale[2];
        expect(f.position[0] - w / 2).toBeGreaterThanOrEqual(r.minX - 1e-6);
        expect(f.position[0] + w / 2).toBeLessThanOrEqual(r.maxX + 1e-6);
        expect(f.position[1] - d / 2).toBeGreaterThanOrEqual(r.minY - 1e-6);
        expect(f.position[1] + d / 2).toBeLessThanOrEqual(r.maxY + 1e-6);
      }
      expect(validateCirculation(out).filter((i) => i.severity === "error")).toEqual([]);
    });
  }

  it("replaces earlier terrace furniture and can clear it", () => {
    const plan = house();
    const area = findTerraces(plan)[0];
    const a = applyTerraceStyle(plan, area, "party").plan;
    const b = applyTerraceStyle(a, area, "compact").plan;
    expect(terraceItems(b, area).length).toBeLessThan(terraceItems(a, area).length);
    expect(terraceItems(clearTerraceFurniture(b, area), area)).toHaveLength(0);
  });

  it("skips pieces that do not fit a small terrace", () => {
    const plan = house(10, 14);
    const area = findTerraces(plan)[0];
    const res = applyTerraceStyle(plan, area, "party");
    expect(res.skipped.length).toBeGreaterThan(0);
  });

  it("shrinks pieces to fit a typical 8.5 x 10 ft terrace instead of dropping most of them", () => {
    const plan = house(30, 40);
    plan.levels[1].rooms = [rect("f-stair", "staircase", "Staircase", 0, 0, 8, 8), rect("f-terrace", "other", "Terrace", 0, 8, 8.5, 18)];
    const area = findTerraces(plan)[0];
    const res = applyTerraceStyle(plan, area, "luxury_lounge");
    expect(terraceItems(res.plan, area).length).toBeGreaterThanOrEqual(4);
  });

  it("scales sizes for metric plans", () => {
    const plan = house(6, 9, "m");
    const area = findTerraces(plan)[0];
    const items = terraceItems(applyTerraceStyle(plan, area, "compact").plan, area) as FurnitureItem[];
    expect(items.every((f) => f.dimensions.width < 4)).toBe(true);
  });

  it("works on every generated architectural family with a terrace", () => {
    for (const d of Object.values(ARCHITECTURAL_DESIGNS)) {
      const { plan } = generateArchitecturalPlan({ designId: d.id as never, plotWidth: 40, plotLength: 60, floors: 2 });
      for (const area of findTerraces(plan)) {
        const out = applyTerraceStyle(plan, area, "modern_minimalist").plan;
        expect(validateCirculation(out).filter((i) => i.severity === "error" && i.id.startsWith("furniture"))).toEqual([]);
      }
    }
  });

  it("draws the terrace furniture in 2D exports of the terrace floor only", () => {
    const plan = house();
    const area = findTerraces(plan)[0];
    const { plan: out } = applyTerraceStyle(plan, area, "indian_family");
    const upper = generateSingleFloorSvg(out, 1);
    const ground = generateSingleFloorSvg(out, 0);
    expect(upper).toContain("Hanging Jhula");
    expect(ground).not.toContain("Hanging Jhula");
  });
});
