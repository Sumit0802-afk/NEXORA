import { describe, it, expect, vi } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import { generateSingleFloorSvg } from "../export-2d";
import { buildStandaloneThreeScene, prepareSceneForExport } from "../export-3d";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import * as THREE from "three";

const mockPlan: FloorPlan = {
  schemaVersion: 1,
  projectId: "test-villa",
  units: "ft",
  plot: {
    width: 30,
    length: 45,
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
          polygon: [
            [0, 0],
            [16, 0],
            [16, 18],
            [0, 18],
          ],
        },
        {
          id: "r2",
          name: "Kitchen",
          type: "kitchen",
          polygon: [
            [16, 0],
            [30, 0],
            [30, 14],
            [16, 14],
          ],
        },
        {
          id: "r3",
          name: "Staircase",
          type: "staircase",
          polygon: [
            [16, 14],
            [24, 14],
            [24, 24],
            [16, 24],
          ],
        },
      ],
      walls: [
        { id: "w1", start: [0, 0], end: [30, 0], thickness: 0.75, height: 10, kind: "exterior" },
        { id: "w2", start: [30, 0], end: [30, 45], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [
        { id: "d1", wallId: "w1", kind: "door", offset: 8, width: 3.5 },
        { id: "win1", wallId: "w2", kind: "window", offset: 12, width: 4.0 },
      ],
      furniture: [
        {
          id: "furn1",
          type: "sofa_3seater",
          name: "Modern 3-Seater Sofa",
          category: "living_room",
          dimensions: { width: 6.8, depth: 3.0, height: 2.8 },
          position: [8, 9, 0],
        },
      ],
    },
    {
      id: "first",
      elevation: 10,
      wallHeight: 10,
      rooms: [
        {
          id: "r4",
          name: "Master Bedroom",
          type: "bedroom",
          polygon: [
            [0, 0],
            [18, 0],
            [18, 18],
            [0, 18],
          ],
        },
      ],
      walls: [
        { id: "w3", start: [0, 0], end: [30, 0], thickness: 0.75, height: 10, kind: "exterior" },
      ],
      openings: [],
      furniture: [],
    },
  ],
  metadata: {
    status: "draft",
    version: 1,
  },
};

describe("2D Architectural Floor Plan Export Engine", () => {
  it("generates valid SVG floor plan markup with title block and labels", () => {
    const svg = generateSingleFloorSvg(mockPlan, 0, {
      includeLabels: true,
      includeDimensions: true,
      includeTitleBlock: true,
      includeNorthArrow: true,
      northAngle: 45,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Living Room");
    expect(svg).toContain("Kitchen");
    expect(svg).toContain("NEXORA ARCHITECTURAL STUDIO");
    expect(svg).toContain("GROUND FLOOR PLAN");
    expect(svg).toContain("N"); // North arrow
    expect(svg).toContain("30.0 ft"); // Dimension text
  });

  it("supports upper floors and staircase rendering", () => {
    const groundSvg = generateSingleFloorSvg(mockPlan, 0);
    expect(groundSvg).toContain("Staircase");
    expect(groundSvg).toContain("UP");

    const firstSvg = generateSingleFloorSvg(mockPlan, 1);
    expect(firstSvg).toContain("Master Bedroom");
    expect(firstSvg).toContain("FIRST FLOOR PLAN");
  });

  it("honors toggles to exclude labels or dimensions", () => {
    const svgWithoutLabels = generateSingleFloorSvg(mockPlan, 0, {
      includeLabels: false,
      includeDimensions: false,
    });

    expect(svgWithoutLabels).not.toContain("Living Room");
    expect(svgWithoutLabels).not.toContain("30.0 ft");
  });
});

describe("3D House Model Export Engine", () => {
  it("builds a complete Three.js hierarchy for standalone 3D export", () => {
    const root = buildStandaloneThreeScene(mockPlan, {
      scope: "all",
      includeFurniture: true,
      includeRoof: true,
    });

    expect(root).toBeDefined();
    expect(root.children.length).toBeGreaterThan(0);

    // Verify wall, floor, door, window and roof presence
    const hasFloor = root.children.some((c) => c.name.startsWith("Floor_"));
    const hasWall = root.children.some((c) => c.name.startsWith("Wall_"));
    const hasDoor = root.children.some((c) => c.name.startsWith("Door_"));
    const hasRoof = root.children.some((c) => c.name.includes("Roof"));
    const hasFurniture = root.children.some((c) => c.name.startsWith("Furniture_"));

    expect(hasFloor).toBe(true);
    expect(hasWall).toBe(true);
    expect(hasDoor).toBe(true);
    expect(hasRoof).toBe(true);
    expect(hasFurniture).toBe(true);
  });

  it("filters single floor scope in 3D standalone scene", () => {
    const level1Scene = buildStandaloneThreeScene(mockPlan, {
      scope: "single",
      levelIndex: 1,
    });

    const hasGroundFloor = level1Scene.children.some((c) => c.name.includes("Living Room"));
    expect(hasGroundFloor).toBe(false);
  });

  it("exports valid Wavefront OBJ polygon mesh text", () => {
    const scene = buildStandaloneThreeScene(mockPlan);
    const exporter = new OBJExporter();
    const objText = exporter.parse(scene);

    expect(typeof objText).toBe("string");
    expect(objText.length).toBeGreaterThan(100);
    expect(objText).toMatch(/^#|v\s|f\s/m);
  });

  it("prepares live Three.js scene by filtering non-architectural helpers", () => {
    const live = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    mesh.name = "House_Wall";
    live.add(mesh);

    const grid = new THREE.GridHelper(50, 50);
    grid.name = "Grid";
    live.add(grid);

    const camera = new THREE.PerspectiveCamera();
    live.add(camera);

    const cleaned = prepareSceneForExport(live);
    expect(cleaned.children.some((c) => c.name === "House_Wall")).toBe(true);
    expect(cleaned.children.some((c) => c.name === "Grid")).toBe(false);
    expect(cleaned.children.some((c) => c.type.includes("Camera"))).toBe(false);
  });
});
