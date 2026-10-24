import { describe, expect, it } from "vitest";
import {
  calculateSolarPosition,
  calculateVastuZone,
  angleToCardinal,
  getDayOfYear,
  performArchitecturalAnalysis,
  SITE_PRESETS,
} from "../architectural-analysis";
import type { FloorPlan } from "@houseplan/design-schema";

function makeAnalysisPlan(): FloorPlan {
  return {
    schemaVersion: 1,
    projectId: "analysis-test",
    units: "ft",
    plot: { width: 40, length: 50, floors: 1, shape: "rectangle" },
    levels: [
      {
        id: "ground",
        elevation: 0,
        wallHeight: 10,
        rooms: [
          // Northeast zone: Living room
          { id: "r-living", type: "living_room", name: "Living Room", polygon: [[20, 0], [40, 0], [40, 20], [20, 20]] },
          // Southeast zone: Kitchen
          { id: "r-kitchen", type: "kitchen", name: "Kitchen", polygon: [[20, 30], [40, 30], [40, 50], [20, 50]] },
          // Southwest zone: Master Bedroom
          { id: "r-master", type: "bedroom", name: "Master Bedroom", polygon: [[0, 30], [20, 30], [20, 50], [0, 50]] },
          // Northwest zone: Bathroom
          { id: "r-bath", type: "bathroom", name: "Guest Bathroom", polygon: [[0, 0], [20, 0], [20, 15], [0, 15]] },
        ],
        walls: [
          { id: "w-north", start: [20, 0], end: [40, 0], thickness: 0.5, height: 10, kind: "exterior" },
          { id: "w-east", start: [40, 0], end: [40, 20], thickness: 0.5, height: 10, kind: "exterior" },
          { id: "w-south", start: [20, 50], end: [40, 50], thickness: 0.5, height: 10, kind: "exterior" },
          { id: "w-west", start: [0, 30], end: [0, 50], thickness: 0.5, height: 10, kind: "exterior" },
        ],
        openings: [
          // Windows in living room on two walls: North and East -> cross ventilation!
          { id: "win-1", wallId: "w-north", kind: "window", offset: 10, width: 4 },
          { id: "win-2", wallId: "w-east", kind: "window", offset: 10, width: 4 },
          // Single window in kitchen
          { id: "win-3", wallId: "w-south", kind: "window", offset: 10, width: 3 },
        ],
        furniture: [],
      },
    ],
    metadata: { version: 1, status: "draft" },
  };
}

describe("Architectural Analysis - Solar Engine", () => {
  it("calculates daytime sun position for New Delhi at solar noon", () => {
    const delhi = SITE_PRESETS.find((c) => c.city === "New Delhi")!;
    const marchEquinox = getDayOfYear(3, 21);
    const sun = calculateSolarPosition(delhi.latitude, marchEquinox, 12.0, 0);

    expect(sun.isDaytime).toBe(true);
    expect(sun.altitudeDeg).toBeGreaterThan(50); // High midday sun
    expect(sun.altitudeDeg).toBeLessThan(75);
    expect(sun.vector3D[1]).toBeGreaterThan(0); // Above horizon
  });

  it("identifies nighttime correctly before sunrise and after sunset", () => {
    const delhi = SITE_PRESETS[0];
    const sunNight = calculateSolarPosition(delhi.latitude, 80, 2.0, 0);
    expect(sunNight.isDaytime).toBe(false);
  });

  it("maps angles accurately to cardinal directions", () => {
    expect(angleToCardinal(0)).toBe("North");
    expect(angleToCardinal(90)).toBe("East");
    expect(angleToCardinal(180)).toBe("South");
    expect(angleToCardinal(270)).toBe("West");
    expect(angleToCardinal(45)).toBe("North-East");
    expect(angleToCardinal(135)).toBe("South-East");
  });
});

describe("Architectural Analysis - Vastu & Ventilation", () => {
  it("computes accurate Vastu zones from plot coordinates", () => {
    // In a 40x50 plot: Center is (20, 25).
    // Northeast is high X, low Y (e.g. 30, 10)
    const neZone = calculateVastuZone([30, 10], 40, 50, 0);
    expect(neZone).toBe("North-East");

    // Southeast is high X, high Y (e.g. 30, 40)
    const seZone = calculateVastuZone([30, 40], 40, 50, 0);
    expect(seZone).toBe("South-East");

    // Southwest is low X, high Y (e.g. 10, 40)
    const swZone = calculateVastuZone([10, 40], 40, 50, 0);
    expect(swZone).toBe("South-West");

    // Northwest is low X, low Y (e.g. 10, 10)
    const nwZone = calculateVastuZone([10, 10], 40, 50, 0);
    expect(nwZone).toBe("North-West");

    // Plot Center (20, 25)
    const centerZone = calculateVastuZone([20, 25], 40, 50, 0);
    expect(centerZone).toBe("Center");
  });

  it("evaluates a floor plan for sunlight, ventilation, and Vastu", () => {
    const plan = makeAnalysisPlan();
    const report = performArchitecturalAnalysis(plan, {
      location: SITE_PRESETS[0],
      northAngleDeg: 0,
      month: 3,
      day: 21,
      solarHour: 11.5,
    });

    expect(report.sunlight.rooms.length).toBe(4);
    expect(report.ventilation.rooms.length).toBe(4);
    expect(report.vastu.rooms.length).toBe(4);

    // Living room has windows on 2 walls (North & East) -> Cross Ventilation!
    const livingVent = report.ventilation.rooms.find((r) => r.roomId === "r-living");
    expect(livingVent?.crossVentilation).toBe(true);
    expect(livingVent?.ventilationType).toBe("Cross-Ventilation");

    // Kitchen is in South-East -> Favorable Vastu placement!
    const kitchenVastu = report.vastu.rooms.find((r) => r.roomId === "r-kitchen");
    expect(kitchenVastu?.zone).toBe("South-East");
    expect(kitchenVastu?.suitability).toBe("Favorable");

    // Master Bedroom is in South-West -> Favorable Vastu placement!
    const masterVastu = report.vastu.rooms.find((r) => r.roomId === "r-master");
    expect(masterVastu?.zone).toBe("South-West");
    expect(masterVastu?.suitability).toBe("Favorable");
  });
});
