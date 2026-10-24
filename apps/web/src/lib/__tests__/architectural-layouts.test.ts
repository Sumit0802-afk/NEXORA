import { describe, expect, it } from "vitest";
import {
  ARCHITECTURAL_DESIGNS,
  TERRACE_DESIGNS,
  generateArchitecturalPlan,
  type ArchitecturalDesignId,
  type TerraceDesignId,
} from "../architectural-layouts";
import { buildSceneGeometry } from "../scene-geometry";

describe("Architectural Layouts Engine", () => {
  it("provides 8 distinct architectural designs and 6 terrace layouts", () => {
    const designKeys = Object.keys(ARCHITECTURAL_DESIGNS);
    expect(designKeys).toHaveLength(8);
    expect(designKeys).toContain("modern_open");
    expect(designKeys).toContain("family_spacious");
    expect(designKeys).toContain("courtyard");
    expect(designKeys).toContain("l_shaped");
    expect(designKeys).toContain("u_shaped");
    expect(designKeys).toContain("duplex");
    expect(designKeys).toContain("traditional_indian");
    expect(designKeys).toContain("contemporary_luxury");

    const terraceKeys = Object.keys(TERRACE_DESIGNS);
    expect(terraceKeys).toHaveLength(9);
    expect(terraceKeys).toContain("open");
    expect(terraceKeys).toContain("garden");
    expect(terraceKeys).toContain("pergola");
    expect(terraceKeys).toContain("covered");
    expect(terraceKeys).toContain("lounge");
    expect(terraceKeys).toContain("utility");
    expect(terraceKeys).toContain("outdoor_dining");
    expect(terraceKeys).toContain("solar");
    expect(terraceKeys).toContain("traditional_indian");
  });

  const archetypes: ArchitecturalDesignId[] = [
    "modern_open",
    "family_spacious",
    "courtyard",
    "l_shaped",
    "u_shaped",
    "duplex",
    "traditional_indian",
    "contemporary_luxury",
  ];

  archetypes.forEach((id) => {
    it(`generates valid 2-floor plan for archetype: ${id}`, () => {
      const res = generateArchitecturalPlan({
        designId: id,
        terraceId: "garden",
        plotWidth: 30,
        plotLength: 45,
        floors: 2,
        units: "ft",
      });

      expect(res.plan).toBeDefined();
      expect(res.plan.levels).toHaveLength(2);
      expect(res.validationIssues.filter((i) => i.severity === "error")).toHaveLength(0);
      expect(res.metrics.builtUpArea).toBeGreaterThan(0);
      expect(res.metrics.roomCount).toBeGreaterThan(3);

      // Verify 3D geometry engine can build scene geometry from it cleanly
      const sceneGeo = buildSceneGeometry(res.plan);
      expect(sceneGeo.floors.length).toBeGreaterThan(0);
      expect(sceneGeo.walls.length).toBeGreaterThan(0);
    });
  });

  it("supports 3-storey layout with vertically aligned staircase", () => {
    const res = generateArchitecturalPlan({
      designId: "modern_open",
      terraceId: "lounge",
      plotWidth: 32,
      plotLength: 48,
      floors: 3,
      units: "ft",
    });

    expect(res.plan.levels).toHaveLength(3);
    const stairs = res.plan.levels.map((l) => l.rooms.find((r) => r.type === "staircase"));
    expect(stairs[0]).toBeDefined();
    expect(stairs[1]).toBeDefined();
    expect(stairs[2]).toBeDefined();

    // Check vertical alignment: (x, y) coordinates on Ground, First, and Second floors must match
    expect(stairs[0]!.polygon).toEqual(stairs[1]!.polygon);
    expect(stairs[0]!.polygon).toEqual(stairs[2]!.polygon);
  });

  it("applies structural terrace layout differences", () => {
    const openRes = generateArchitecturalPlan({
      designId: "family_spacious",
      terraceId: "open",
      plotWidth: 30,
      plotLength: 40,
      floors: 2,
    });

    const gardenRes = generateArchitecturalPlan({
      designId: "family_spacious",
      terraceId: "garden",
      plotWidth: 30,
      plotLength: 40,
      floors: 2,
    });

    const loungeRes = generateArchitecturalPlan({
      designId: "family_spacious",
      terraceId: "lounge",
      plotWidth: 30,
      plotLength: 40,
      floors: 2,
    });

    // Check that terrace levels have different rooms and geometries
    const openTopRooms = openRes.plan.levels[1].rooms.map((r) => r.name);
    const gardenTopRooms = gardenRes.plan.levels[1].rooms.map((r) => r.name);
    const loungeTopRooms = loungeRes.plan.levels[1].rooms.map((r) => r.name);

    expect(openTopRooms).toContain("Panoramic Open Sky Terrace");
    expect(gardenTopRooms).toContain("Lawn & Planter Garden");
    expect(loungeTopRooms).toContain("Enclosed Glass Sky Lounge");
  });
});
