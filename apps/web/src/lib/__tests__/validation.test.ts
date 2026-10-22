import { describe, expect, it } from "vitest";
import { validateDesign } from "../validation";
import type { FloorPlan } from "@houseplan/design-schema";

function makePlan(rooms: FloorPlan["levels"][0]["rooms"], overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    schemaVersion: 1,
    projectId: "test",
    units: "ft",
    plot: { width: 30, length: 40, floors: 1, shape: "rectangle" },
    levels: [{ id: "ground", elevation: 0, wallHeight: 10, rooms, walls: [], openings: [], furniture: [] }],
    metadata: { version: 1, status: "draft" },
    ...overrides,
  };
}

describe("validateDesign", () => {
  it("reports no issues for a clean, in-bounds, non-overlapping layout", () => {
    const plan = makePlan([
      { id: "a", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] },
      { id: "b", type: "bedroom", name: "Bedroom", polygon: [[15, 0], [30, 0], [30, 16], [15, 16]] },
    ]);
    expect(validateDesign(plan)).toHaveLength(0);
  });

  it("flags a room that extends outside the plot", () => {
    const plan = makePlan([{ id: "a", type: "bedroom", name: "Bedroom", polygon: [[25, 0], [40, 0], [40, 10], [25, 10]] }]);
    const issues = validateDesign(plan);
    expect(issues.some((i) => i.id === "outside-plot-a")).toBe(true);
  });

  it("flags a zero-size room instead of silently accepting it", () => {
    const plan = makePlan([{ id: "a", type: "bedroom", name: "Bedroom", polygon: [[5, 5], [5, 5], [5, 5], [5, 5]] }]);
    const issues = validateDesign(plan);
    expect(issues.some((i) => i.id === "invalid-dims-a")).toBe(true);
  });

  it("flags two rooms that overlap, but not two that merely touch", () => {
    const overlapping = makePlan([
      { id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      { id: "b", type: "bedroom", name: "B", polygon: [[5, 0], [15, 0], [15, 10], [5, 10]] },
    ]);
    expect(validateDesign(overlapping).some((i) => i.id.startsWith("overlap-"))).toBe(true);

    const touching = makePlan([
      { id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      { id: "b", type: "bedroom", name: "B", polygon: [[10, 0], [20, 0], [20, 10], [10, 10]] },
    ]);
    expect(touching.levels[0]).toBeTruthy();
    expect(validateDesign(touching).some((i) => i.id.startsWith("overlap-"))).toBe(false);
  });

  it("flags an opening positioned beyond the end of its host wall", () => {
    const plan = makePlan(
      [{ id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
      {
        levels: [
          {
            id: "ground",
            elevation: 0,
            wallHeight: 10,
            rooms: [{ id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
            walls: [{ id: "w1", start: [0, 0], end: [10, 0], thickness: 0.5, height: 10, kind: "interior" }],
            openings: [{ id: "o1", wallId: "w1", kind: "door", offset: 15, width: 3 }],
            furniture: [],
          },
        ],
      }
    );
    const issues = validateDesign(plan);
    expect(issues.some((i) => i.id === "opening-outside-wall-o1")).toBe(true);
  });

  it("warns (not errors) about an opening with no matching wall, since 3D silently drops it", () => {
    const plan = makePlan(
      [{ id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
      {
        levels: [
          {
            id: "ground",
            elevation: 0,
            wallHeight: 10,
            rooms: [{ id: "a", type: "bedroom", name: "A", polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
            walls: [],
            openings: [{ id: "orphan", wallId: "missing", kind: "window", offset: 1, width: 3 }],
            furniture: [],
          },
        ],
      }
    );
    const issue = validateDesign(plan).find((i) => i.id === "orphan-opening-orphan");
    expect(issue?.severity).toBe("warning");
  });
});
