import { describe, it, expect } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import {
  generateOptimalStructuralGrid,
  auditStructuralSystem,
  STRUCTURAL_DISCLAIMER,
} from "../structural";

const testPlan: FloorPlan = {
  schemaVersion: 1,
  projectId: "structural-villa",
  units: "ft",
  plot: {
    width: 30,
    length: 40,
    floors: 2,
    shape: "rectangle",
  },
  levels: [
    {
      id: "ground",
      elevation: 0,
      wallHeight: 10,
      rooms: [
        {
          id: "r1",
          name: "Living Room",
          type: "living_room",
          polygon: [[0, 0], [15, 0], [15, 20], [0, 20]],
        },
        {
          id: "r2",
          name: "Kitchen",
          type: "kitchen",
          polygon: [[15, 0], [30, 0], [30, 20], [15, 20]],
        },
      ],
      walls: [
        { id: "w1", start: [0, 0], end: [30, 0], thickness: 0.75, height: 10, kind: "exterior" },
        { id: "w2", start: [0, 20], end: [30, 20], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [],
      furniture: [],
      columns: [],
      beams: [],
      foundations: [],
    },
    {
      id: "first",
      elevation: 10,
      wallHeight: 10,
      rooms: [
        {
          id: "r3",
          name: "Bed 1",
          type: "bedroom",
          polygon: [[0, 0], [15, 0], [15, 20], [0, 20]],
        },
      ],
      walls: [
        { id: "w3", start: [0, 0], end: [15, 0], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [],
      furniture: [],
      columns: [],
      beams: [],
      foundations: [],
    },
  ],
  metadata: {
    status: "draft",
    version: 1,
  },
};

describe("Structural Planning & Multi-Floor Alignment Engine", () => {
  it("automatically generates columns, beams, and footings from plan geometry", () => {
    const withStructure = generateOptimalStructuralGrid(testPlan);

    const groundCols = withStructure.levels[0].columns!;
    const groundBeams = withStructure.levels[0].beams!;
    const groundFootings = withStructure.levels[0].foundations!;

    expect(groundCols.length).toBeGreaterThanOrEqual(4);
    expect(groundBeams.length).toBeGreaterThanOrEqual(2);
    expect(groundFootings.length).toBe(groundCols.length);

    // Columns should have valid coordinates
    expect(groundCols[0].position[0]).toBeDefined();
    expect(groundCols[0].width).toBeGreaterThan(0);
  });

  it("audits vertical column alignment across multiple floors", () => {
    const withStructure = generateOptimalStructuralGrid(testPlan);
    const report = auditStructuralSystem(withStructure);

    expect(report.totalColumns).toBeGreaterThan(0);
    expect(report.isAligned).toBe(true);
    expect(report.disclaimer).toContain("PRELIMINARY ARCHITECTURAL PLANNING AID");
  });

  it("flags unsupported floating upper columns", () => {
    const withStructure = generateOptimalStructuralGrid(testPlan);

    // Intentionally add a floating upper column with no lower support
    withStructure.levels[1]!.columns!.push({
      id: "floating-col",
      position: [28.5, 38.5], // Far corner with no ground column or wall
      shape: "rectangle",
      width: 0.75,
      depth: 0.75,
      rotation: 0,
      material: "reinforced_concrete",
    });

    const report = auditStructuralSystem(withStructure);
    expect(report.isAligned).toBe(false);

    const unsupported = report.warnings.find((w) => w.type === "unsupported_column");
    expect(unsupported).toBeDefined();
    expect(unsupported?.message).toContain("Floating column on First floor");
  });

  it("flags excessive beam spans exceeding recommended residential limits", () => {
    const withStructure = generateOptimalStructuralGrid(testPlan);

    // Add an excessively long beam (26 ft)
    withStructure.levels[0]!.beams!.push({
      id: "excessive-beam",
      start: [0, 0],
      end: [26, 0],
      width: 0.75,
      depth: 1.25,
      kind: "primary",
    });

    const report = auditStructuralSystem(withStructure);
    const criticalSpan = report.warnings.find(
      (w) => w.type === "long_span" && w.elementId === "excessive-beam"
    );
    expect(criticalSpan).toBeDefined();
    expect(criticalSpan?.message).toContain("beam span");
  });
});
