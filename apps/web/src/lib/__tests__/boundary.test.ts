import { describe, expect, it } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import { boundaryLayout, boundaryOf, withBoundaryConfig } from "../boundary";
import { boundaryPieces } from "../house-design/boundary-model";
import { DEFAULT_DESIGN, cloneDesign } from "../house-design/schema";
import { baseGeometry, roomMeasures } from "../house-design/geometry-engine";
import { buildDesignModel } from "../house-design/model";
import { buildSceneGeometry } from "../scene-geometry";

const plan = (rooms: [string, string, number, number, number, number][], extra: Partial<FloorPlan> = {}): FloorPlan => ({
  schemaVersion: 1, projectId: "b", units: "ft",
  plot: { width: 40, length: 60, floors: 1, shape: "rectangle" },
  levels: [{ id: "g", elevation: 0, wallHeight: 10, walls: [], openings: [], furniture: [],
    rooms: rooms.map(([id, type, x0, y0, x1, y1]) => ({ id, type: type as never, name: id, polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] })) }],
  metadata: { version: 1, status: "draft" },
  ...extra,
});

const inset = plan([["living", "living_room", 8, 12, 32, 40], ["parking", "parking", 8, 0, 20, 12]]);
const len = (r: { from: [number, number]; to: [number, number] }) => Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]);

describe("plot boundary wall", () => {
  it("closes all four sides along the plot line, with the outer face on the line", () => {
    const { runs, settings } = boundaryLayout(inset);
    const t = settings.thickness;
    for (const side of ["front", "rear", "left", "right"]) expect(runs.some((r) => r.side === side)).toBe(true);
    expect(runs.filter((r) => r.side === "rear").reduce((s, r) => s + len(r), 0)).toBeCloseTo(40);
    expect(runs.filter((r) => r.side === "left").reduce((s, r) => s + len(r), 0)).toBeCloseTo(60 - 2 * t);
    for (const r of runs) for (const [x, y] of [r.from, r.to]) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(40);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(60);
    }
  });

  it("meets at the corners with no gap and no overlap", () => {
    const { runs, settings } = boundaryLayout(inset);
    const t = settings.thickness;
    const rear = runs.find((r) => r.side === "rear")!, left = runs.find((r) => r.side === "left")!, right = runs.find((r) => r.side === "right")!;
    expect(rear.from[0]).toBeCloseTo(0); expect(rear.to[0]).toBeCloseTo(40);
    expect(right.from[1]).toBeCloseTo(t); expect(right.to[1]).toBeCloseTo(60 - t);
    expect(left.from[0]).toBeCloseTo(40 - t / 2);
  });

  it("puts the main gate at the parking bay, with pillars and a pedestrian gate", () => {
    const { gates, pillars } = boundaryLayout(inset);
    const main = gates.find((g) => g.kind === "main")!;
    expect((main.from + main.to) / 2).toBeCloseTo(14);
    expect(gates.some((g) => g.kind === "pedestrian")).toBe(true);
    expect(pillars).toHaveLength(4);
  });

  it("leaves the gate open: no front wall crosses it", () => {
    const { runs, gates } = boundaryLayout(inset);
    for (const g of gates) for (const r of runs.filter((x) => x.side === "front")) expect(r.to[0] <= g.from + 0.01 || r.from[0] >= g.to - 0.01).toBe(true);
  });

  it("never runs through the house where it stands on the plot line", () => {
    const touching = plan([["living", "living_room", 0, 20, 40, 60]]);
    const { runs } = boundaryLayout(touching);
    expect(runs.some((r) => r.side === "rear")).toBe(false);
    for (const r of runs.filter((x) => x.side === "left" || x.side === "right")) expect(Math.max(r.from[1], r.to[1])).toBeLessThanOrEqual(20 + 0.01);
  });

  it("reads and saves its settings on the plan", () => {
    const changed = withBoundaryConfig(inset, { boundaryWallHeight: 6, boundaryStyle: "traditional", boundaryColor: "#AA5533", hasPedestrianGate: false, gateCenter: 30 });
    const s = boundaryOf(JSON.parse(JSON.stringify(changed)));
    expect(s).toMatchObject({ height: 6, style: "traditional", color: "#AA5533", pedestrianGate: false, gateCenter: 30 });
    expect(boundaryOf(inset).enabled).toBe(true);
  });

  it("can be removed", () => {
    const off = withBoundaryConfig(inset, { hasBoundaryWall: false });
    expect(boundaryLayout(off).runs).toEqual([]);
    expect(boundaryPieces(off)).toEqual([]);
  });

  it("builds real geometry at ground level for every style", () => {
    for (const style of ["modern", "minimalist", "decorative", "traditional"] as const) {
      const pieces = boundaryPieces(withBoundaryConfig(inset, { boundaryStyle: style }));
      const boxes = pieces.flatMap((p) => p.prims).filter((p) => p.kind === "box");
      expect(boxes.length).toBeGreaterThan(8);
      for (const b of boxes) if (b.kind === "box") expect(b.center[1] - b.size[1] / 2).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it("replaces the old plot-edge pieces instead of doubling them", () => {
    const geometry = buildSceneGeometry(plan([["garden", "other", 0, 0, 40, 20], ["bed", "bedroom", 0, 20, 40, 60]]));
    expect(geometry.walls.some((w) => w.kind === "boundary" && w.level === 0)).toBe(false);
  });

  it("appears as editable objects in the designed house, leaving the rooms alone", () => {
    const design = cloneDesign(DEFAULT_DESIGN);
    const base = baseGeometry(inset, design);
    const { objects } = buildDesignModel(base.geometry, base.renderPlan, design);
    expect(objects.some((o) => o.id === "gate:main" && o.kind === "gate")).toBe(true);
    expect(objects.filter((o) => o.kind === "boundary").length).toBeGreaterThanOrEqual(4);
    expect(roomMeasures(base.geometry)).toEqual(roomMeasures(buildSceneGeometry(inset)));
  });
});
