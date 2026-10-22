import { describe, expect, it } from "vitest";
import { buildSceneGeometry, computeCameraFraming } from "../scene-geometry";
import type { FloorPlan } from "@houseplan/design-schema";

function makePlan(overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    schemaVersion: 1,
    projectId: "test",
    units: "ft",
    plot: { width: 30, length: 40, floors: 1, shape: "rectangle" },
    levels: [
      {
        id: "ground",
        elevation: 0,
        wallHeight: 10,
        rooms: [
          { id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] },
          { id: "bed1", type: "bedroom", name: "Bedroom 1", polygon: [[15, 0], [30, 0], [30, 16], [15, 16]] },
        ],
        walls: [],
        openings: [],
        furniture: [],
      },
    ],
    metadata: { version: 1, status: "draft" },
    ...overrides,
  };
}

describe("buildSceneGeometry", () => {
  it("preserves the 2D plot boundary in the 3D outer footprint", () => {
    const plan = makePlan();
    const geometry = buildSceneGeometry(plan);
    expect(geometry.plotWidth).toBe(plan.plot.width);
    expect(geometry.plotDepth).toBe(plan.plot.length);
  });

  it("places each room's 3D floor at the position and size implied by its 2D polygon", () => {
    const plan = makePlan();
    const geometry = buildSceneGeometry(plan);
    const cx = plan.plot.width / 2;
    const cz = plan.plot.length / 2;

    const living = geometry.floors.find((f) => f.id === "living")!;
    // Living room spans x:[0,15], y:[0,16] -> width 15, depth 16, center (7.5, 8).
    expect(living.width).toBeCloseTo(15);
    expect(living.depth).toBeCloseTo(16);
    expect(living.centerX).toBeCloseTo(7.5 - cx);
    expect(living.centerZ).toBeCloseTo(8 - cz);

    const bed1 = geometry.floors.find((f) => f.id === "bed1")!;
    expect(bed1.width).toBeCloseTo(15);
    expect(bed1.depth).toBeCloseTo(16);
    expect(bed1.centerX).toBeCloseTo(22.5 - cx);
  });

  it("does not duplicate a wall shared by two adjacent rooms", () => {
    const plan = makePlan();
    const geometry = buildSceneGeometry(plan);
    // The living/bed1 shared edge runs from (15,0) to (15,16): centered at
    // plan point (15,8), i.e. world (15-15, 8-20) = (0, -12) once centered.
    const atSharedEdge = geometry.walls.filter(
      (w) => Math.abs(w.centerX - 0) < 0.01 && Math.abs(w.centerZ - -12) < 0.01
    );
    expect(atSharedEdge).toHaveLength(1);
  });

  it("covers every room edge exactly once, merging collinear edges into one wall run", () => {
    const plan = makePlan();
    const geometry = buildSceneGeometry(plan);
    // Front (30) + back (30) + left (16) + shared (16) + right (16): 5 runs, 108 ft of wall in total.
    expect(geometry.walls).toHaveLength(5);
    expect(geometry.walls.reduce((sum, w) => sum + w.length, 0)).toBeCloseTo(108);
  });

  it("uses an explicit Wall record's thickness/height when one exists for that edge", () => {
    const plan = makePlan({
      levels: [
        {
          id: "ground",
          elevation: 0,
          wallHeight: 10,
          rooms: [
            { id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] },
            { id: "bed1", type: "bedroom", name: "Bedroom 1", polygon: [[15, 0], [30, 0], [30, 16], [15, 16]] },
          ],
          walls: [{ id: "w1", start: [15, 0], end: [15, 16], thickness: 0.75, height: 9, kind: "interior" }],
          openings: [],
          furniture: [],
        },
      ],
    });
    const geometry = buildSceneGeometry(plan);
    // The shared edge x = 15 sits at world x = 0.
    const shared = geometry.walls.find((w) => Math.abs(w.centerX) < 0.01 && Math.abs(w.length - 16) < 0.01)!;
    expect(shared.thickness).toBeCloseTo(0.75);
    expect(shared.height).toBeCloseTo(9);
  });

  it("positions a door/window marker at its offset along the correct wall, not an unrelated room", () => {
    const plan = makePlan({
      levels: [
        {
          id: "ground",
          elevation: 0,
          wallHeight: 10,
          rooms: [
            { id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] },
            { id: "bed1", type: "bedroom", name: "Bedroom 1", polygon: [[15, 0], [30, 0], [30, 16], [15, 16]] },
          ],
          walls: [{ id: "w1", start: [15, 0], end: [15, 16], thickness: 0.5, height: 10, kind: "interior" }],
          openings: [{ id: "door1", wallId: "w1", kind: "door", offset: 10, width: 3 }],
          furniture: [],
        },
      ],
    });
    const geometry = buildSceneGeometry(plan);
    expect(geometry.openings).toHaveLength(1);
    const door = geometry.openings[0];
    const cx = plan.plot.width / 2;
    const cz = plan.plot.length / 2;
    // Wall runs (15,0)->(15,16); offset 10 along it is plan point (15,10).
    expect(door.centerX).toBeCloseTo(15 - cx);
    expect(door.centerZ).toBeCloseTo(10 - cz);
    expect(door.kind).toBe("door");
  });

  it("drops an opening whose wallId has no matching wall, rather than mis-placing it", () => {
    const plan = makePlan({
      levels: [
        {
          id: "ground",
          elevation: 0,
          wallHeight: 10,
          rooms: [{ id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] }],
          walls: [],
          openings: [{ id: "orphan", wallId: "missing-wall", kind: "window", offset: 2, width: 3 }],
          furniture: [],
        },
      ],
    });
    const geometry = buildSceneGeometry(plan);
    expect(geometry.openings).toHaveLength(0);
  });

  it("does not mutate the input plan", () => {
    const plan = makePlan();
    const snapshot = JSON.parse(JSON.stringify(plan));
    buildSceneGeometry(plan);
    expect(plan).toEqual(snapshot);
  });

  it("produces only finite, non-NaN numbers for a populated plan", () => {
    const plan = makePlan();
    const geometry = buildSceneGeometry(plan);
    const allNumbers = [
      geometry.plotWidth,
      geometry.plotDepth,
      ...geometry.floors.flatMap((f) => [f.centerX, f.centerZ, f.width, f.depth]),
      ...geometry.walls.flatMap((w) => [w.centerX, w.centerZ, w.length, w.angle, w.thickness, w.height]),
    ];
    for (const n of allNumbers) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("handles an empty plot (no rooms yet) without throwing", () => {
    const plan = makePlan({
      levels: [{ id: "ground", elevation: 0, wallHeight: 10, rooms: [], walls: [], openings: [], furniture: [] }],
    });
    const geometry = buildSceneGeometry(plan);
    expect(geometry.floors).toHaveLength(0);
    expect(geometry.walls).toHaveLength(0);
    expect(geometry.plotWidth).toBe(plan.plot.width);
  });
});

function level(rooms: FloorPlan["levels"][0]["rooms"], extra: Partial<FloorPlan["levels"][0]> = {}) {
  return { id: "ground", elevation: 0, wallHeight: 10, rooms, walls: [], openings: [], furniture: [], ...extra };
}

const rect = (id: string, type: FloorPlan["levels"][0]["rooms"][0]["type"], x0: number, y0: number, x1: number, y1: number) => ({
  id, type, name: id, polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as [number, number][],
});

describe("buildSceneGeometry — wall network", () => {
  it("merges a T-junction into one wall instead of overlapping duplicates", () => {
    // A 30 ft passage over three 10 ft bedrooms: the passage's lower edge and the three bedroom
    // top edges all lie on y = 3.5.
    const plan = makePlan({
      levels: [level([
        rect("hall", "hallway", 0, 0, 30, 3.5),
        rect("b1", "bedroom", 0, 3.5, 10, 15),
        rect("b2", "bedroom", 10, 3.5, 20, 15),
        rect("b3", "bedroom", 20, 3.5, 30, 15),
      ])],
    });
    const geometry = buildSceneGeometry(plan);
    const onLine = geometry.walls.filter((w) => w.angle === 0 && Math.abs(w.centerZ - (3.5 - 20)) < 0.01);
    expect(onLine).toHaveLength(1);
    expect(onLine[0].length).toBeCloseTo(30);
    expect(onLine[0].kind).toBe("interior");
  });

  it("cuts a door out of its wall: two solid pieces plus a lintel at door height", () => {
    const plan = makePlan({
      levels: [level(
        [rect("living", "living_room", 0, 0, 15, 16), rect("bed", "bedroom", 15, 0, 30, 16)],
        {
          walls: [{ id: "w1", start: [15, 0], end: [15, 16], thickness: 0.5, height: 10, kind: "interior" }],
          openings: [{ id: "d1", wallId: "w1", kind: "door", offset: 8, width: 3 }],
        },
      )],
    });
    const geometry = buildSceneGeometry(plan);
    const shared = geometry.walls.filter((w) => Math.abs(w.centerX) < 0.01 && w.angle !== 0);
    const full = shared.filter((w) => w.baseY === 0 && w.height === 10);
    const lintel = shared.find((w) => w.baseY > 0)!;
    expect(full.map((w) => w.length).sort()).toEqual([6.5, 6.5]);
    expect(lintel.baseY).toBeCloseTo(7);
    expect(lintel.length).toBeCloseTo(3);
    expect(lintel.height).toBeCloseTo(3);
    expect(geometry.doors).toHaveLength(1);
    expect(geometry.doors[0].width).toBeCloseTo(3);
    expect(geometry.doors[0].height).toBeCloseTo(7);
  });

  it("cuts a window into an exterior wall with a sill, a lintel and a glass pane", () => {
    const plan = makePlan({
      levels: [level([rect("bed", "bedroom", 0, 0, 12, 12)], {
        walls: [{ id: "front", start: [0, 0], end: [12, 0], thickness: 0.75, height: 10, kind: "exterior" }],
        openings: [{ id: "w1", wallId: "front", kind: "window", offset: 6, width: 4 }],
      })],
    });
    const geometry = buildSceneGeometry(plan);
    const front = geometry.walls.filter((w) => w.angle === 0 && Math.abs(w.centerZ - (0 - 20)) < 0.01);
    const sill = front.find((w) => w.baseY === 0 && w.height < 10)!;
    expect(sill.length).toBeCloseTo(4);
    const lintel = front.find((w) => w.baseY > 0)!;
    expect(sill.height).toBeCloseTo(3);
    expect(lintel.baseY).toBeCloseTo(7);
    expect(front.every((w) => w.kind === "exterior")).toBe(true);
    expect(geometry.windows).toEqual([expect.objectContaining({ baseY: 3, height: 4, width: 4 })]);
  });

  it("gives gardens and parking a low boundary wall, leaves a street gate, and never walls two open spaces apart", () => {
    const plan = makePlan({
      levels: [level([
        rect("parking", "parking", 0, 0, 10, 18),
        rect("garden", "other", 10, 0, 30, 18),
        rect("bed", "bedroom", 0, 18, 30, 30),
      ])],
    });
    const geometry = buildSceneGeometry(plan);
    const street = geometry.walls.filter((w) => w.angle === 0 && Math.abs(w.centerZ - (0 - 20)) < 0.01);
    // Garden front is a low boundary wall; parking front stays open as a gate.
    expect(street).toHaveLength(1);
    expect(street[0].kind).toBe("boundary");
    expect(street[0].length).toBeCloseTo(20);
    expect(street[0].height).toBeLessThan(4);
    // No wall between parking and garden (x = 10, y 0..18).
    expect(geometry.walls.some((w) => Math.abs(w.centerX - (10 - 15)) < 0.01 && w.angle !== 0)).toBe(false);
    // The bedroom behind them is closed by a full-height exterior wall.
    const behind = geometry.walls.find((w) => w.angle === 0 && Math.abs(w.centerZ - (18 - 20)) < 0.01)!;
    expect(behind.kind).toBe("exterior");
    expect(behind.height).toBe(10);
  });

  it("uses metric heights for a metric plan", () => {
    const plan = makePlan({
      units: "m",
      plot: { width: 9, length: 12, floors: 1, shape: "rectangle" },
      levels: [{ ...level([rect("living", "living_room", 0, 0, 5, 5)], {
        walls: [{ id: "w", start: [0, 0], end: [5, 0], thickness: 0.2, height: 3.048, kind: "exterior" }],
        openings: [{ id: "d", wallId: "w", kind: "door", offset: 2.5, width: 0.9 }],
      }), wallHeight: 3.048 }],
    });
    const geometry = buildSceneGeometry(plan);
    expect(geometry.doors[0].height).toBeCloseTo(7 * 0.3048);
    expect(geometry.walls.every((w) => w.baseY + w.height <= 3.048 + 1e-6)).toBe(true);
  });
});

describe("computeCameraFraming", () => {
  it("is a pure function of the geometry's bounds, independent of any viewport/zoom concept", () => {
    const small = buildSceneGeometry(makePlan({ plot: { width: 20, length: 20, floors: 1, shape: "rectangle" } }));
    const large = buildSceneGeometry(makePlan({ plot: { width: 80, length: 80, floors: 1, shape: "rectangle" } }));
    const framingSmall = computeCameraFraming(small);
    const framingLarge = computeCameraFraming(large);
    // A larger plot must be framed from further away so the whole house still fits.
    expect(framingLarge.distance).toBeGreaterThan(framingSmall.distance);
    // Calling it twice for the same geometry must give identical results (no hidden state).
    expect(computeCameraFraming(small)).toEqual(framingSmall);
  });

  it("keeps near/far planes proportional to distance so walls are not clipped", () => {
    const geometry = buildSceneGeometry(makePlan());
    const framing = computeCameraFraming(geometry);
    expect(framing.near).toBeGreaterThan(0);
    expect(framing.far).toBeGreaterThan(framing.distance);
  });
});
