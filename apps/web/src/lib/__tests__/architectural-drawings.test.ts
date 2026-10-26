import { describe, it, expect } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import {
  generateElevationsSvg,
  generateSectionsSvg,
  generateSchedulesSvg,
  wrapWithArchitecturalSheetBorder,
  DEFAULT_SHEET_META,
} from "../architectural-drawings";

const testPlan: FloorPlan = {
  schemaVersion: 1,
  projectId: "drawing-test-home",
  units: "ft",
  plot: {
    width: 32,
    length: 50,
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
          name: "Grand Living",
          type: "living_room",
          polygon: [[0, 0], [18, 0], [18, 20], [0, 20]],
          interior: { floorMaterial: "Italian Marble", wallFinish: "Emulsion Paint" },
        },
        {
          id: "r2",
          name: "Dining & Stair",
          type: "staircase",
          polygon: [[18, 0], [32, 0], [32, 20], [18, 20]],
          interior: { floorMaterial: "Hardwood Parquet" },
        },
      ],
      walls: [
        { id: "w1", start: [0, 0], end: [32, 0], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [
        { id: "d1", wallId: "w1", kind: "door", offset: 10, width: 4.0, height: 7.0 },
        { id: "w1", wallId: "w1", kind: "window", offset: 22, width: 5.0, height: 4.0, sillHeight: 3.0 },
      ],
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
          name: "Master Suite",
          type: "bedroom",
          polygon: [[0, 0], [18, 0], [18, 20], [0, 20]],
        },
      ],
      walls: [
        { id: "w2", start: [0, 0], end: [32, 0], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [
        { id: "w2", wallId: "w2", kind: "window", offset: 10, width: 4.5, height: 4.0, sillHeight: 3.0 },
      ],
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

describe("Architectural Drawing Sheets Engine", () => {
  it("generates 4-facade building elevations with datums and title block", () => {
    const svg = generateElevationsSvg(testPlan, DEFAULT_SHEET_META);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("North / Front Elevation");
    expect(svg).toContain("South / Rear Elevation");
    expect(svg).toContain("West / Left Side Elevation");
    expect(svg).toContain("East / Right Side Elevation");
    expect(svg).toContain("PLINTH");
    expect(svg).toContain("ROOF TOP");
    expect(svg).toContain("A-201");
    expect(svg).toContain("BUILDING ELEVATIONS");
  });

  it("generates building cross-sections slicing through floors, stairs, and footings", () => {
    const svg = generateSectionsSvg(testPlan, DEFAULT_SHEET_META);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("CROSS SECTION A-A");
    expect(svg).toContain("CROSS SECTION B-B");
    expect(svg).toContain("R.C.C. PLINTH BEAM");
    expect(svg).toContain("TERRACE ROOF SLAB");
    expect(svg).toContain("WAIST SLAB");
    expect(svg).toContain("A-301");
  });

  it("generates architectural schedules for doors, windows, and room finishes", () => {
    const svg = generateSchedulesSvg(testPlan, DEFAULT_SHEET_META);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("DOOR SCHEDULE");
    expect(svg).toContain("WINDOW SCHEDULE");
    expect(svg).toContain("ROOM FINISH & AREA SCHEDULE");
    expect(svg).toContain("Grand Living");
    expect(svg).toContain("Italian Marble");
    expect(svg).toContain("A-401");
  });

  it("wraps drawings with professional architectural sheet border and title block", () => {
    const borderSvg = wrapWithArchitecturalSheetBorder(
      "<circle cx='50' cy='50' r='20' />",
      1200,
      800,
      DEFAULT_SHEET_META
    );
    expect(borderSvg).toContain("NEXORA ARCHITECTURAL STUDIO");
    expect(borderSvg).toContain("DRAWING SHEET");
    expect(borderSvg).toContain("A-101");
    expect(borderSvg).toContain("PRELIMINARY");
  });
});
