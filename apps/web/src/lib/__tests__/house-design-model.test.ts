import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import { GALLERY, galleryMaterials, galleryPalette } from "../house-design/gallery";
import { commit, redo, startHistory, undo } from "../house-design/history";
import { MATERIALS, MATERIAL_CATEGORIES, getMaterial, materialsIn } from "../house-design/materials";
import { buildDesignModel, geometryKey, mergeRects, openingOutline, withFacadeOpenings, type Prim } from "../house-design/model";
import { DEFAULT_DESIGN, cloneDesign, getAt, normalizeDesign, normalizeDocument, setAt, type HouseDesign } from "../house-design/schema";
import { STYLE_KITS, applyFacadeStyle, designForCategory } from "../house-design/styles";
import { PAINTABLE_PARTS, finishAt, roomFinish, surfaceFor, targetForPart } from "../house-design/surfaces";
import { buildPartGeometries } from "../house-design/three-build";
import { buildSceneGeometry } from "../scene-geometry";

const bareBox: FloorPlan = {
  schemaVersion: 1, projectId: "t", units: "ft",
  plot: { width: 30, length: 40, floors: 1, shape: "rectangle" },
  levels: [{
    id: "ground", elevation: 0, wallHeight: 10,
    rooms: [
      { id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [15, 0], [15, 16], [0, 16]] },
      { id: "bed", type: "bedroom", name: "Bedroom", polygon: [[15, 0], [30, 0], [30, 16], [15, 16]] },
      { id: "kitchen", type: "kitchen", name: "Kitchen", polygon: [[0, 16], [30, 16], [30, 30], [0, 30]] },
    ],
    walls: [], openings: [], furniture: [],
  }],
  metadata: { version: 1, status: "draft" },
};

const twoStorey: FloorPlan = {
  schemaVersion: 1, projectId: "t2", units: "ft",
  plot: { width: 30, length: 40, floors: 2, shape: "rectangle" },
  levels: [
    {
      id: "ground", elevation: 0, wallHeight: 10,
      rooms: [
        { id: "living", type: "living_room", name: "Living", polygon: [[0, 0], [30, 0], [30, 30], [0, 30]] },
      ],
      walls: [{ id: "w1", start: [0, 0], end: [30, 0], thickness: 0.75, height: 10, kind: "exterior" }],
      openings: [
        { id: "d1", wallId: "w1", kind: "door", offset: 8, width: 3.5 },
        { id: "win1", wallId: "w1", kind: "window", offset: 20, width: 6 },
      ],
      furniture: [],
    },
    {
      id: "first", elevation: 10, wallHeight: 10,
      rooms: [
        { id: "bed", type: "bedroom", name: "Bedroom", polygon: [[0, 0], [20, 0], [20, 30], [0, 30]] },
        { id: "bal", type: "balcony", name: "Balcony", polygon: [[20, 0], [30, 0], [30, 30], [20, 30]] },
      ],
      walls: [{ id: "w2", start: [0, 0], end: [20, 0], thickness: 0.75, height: 10, kind: "exterior" }],
      openings: [{ id: "win2", wallId: "w2", kind: "window", offset: 10, width: 6 }],
      furniture: [],
    },
  ],
  metadata: { version: 1, status: "draft" },
};

function model(plan: FloorPlan, change: (d: HouseDesign) => void = () => {}, base = designForCategory("modern"), options = {}) {
  const design = cloneDesign(base);
  change(design);
  const render = withFacadeOpenings(plan, design);
  return buildDesignModel(buildSceneGeometry(render), render, design, options);
}

const parts = (prims: Prim[], name: string) => prims.filter((p) => p.part === name);

describe("floor plan stays as drawn", () => {
  it("does not alter the stored plan", () => {
    const before = JSON.stringify(bareBox);
    model(bareBox);
    expect(JSON.stringify(bareBox)).toBe(before);
  });

  it("keeps every room's outline and the plot when generating facade openings", () => {
    const render = withFacadeOpenings(bareBox, DEFAULT_DESIGN);
    expect(render.levels[0].rooms).toEqual(bareBox.levels[0].rooms);
    expect(render.plot).toEqual(bareBox.plot);
  });

  it("never moves or removes an opening the user placed", () => {
    const render = withFacadeOpenings(twoStorey, DEFAULT_DESIGN);
    for (const [i, level] of twoStorey.levels.entries()) {
      for (const opening of level.openings) expect(render.levels[i].openings).toContainEqual(opening);
    }
  });

  it("adds no opening on a wall span that already has one", () => {
    const render = withFacadeOpenings(twoStorey, DEFAULT_DESIGN);
    const frontWalls = render.levels[0].walls.filter((w) => w.start[1] === 0 && w.end[1] === 0);
    expect(frontWalls.map((w) => w.id)).toEqual(["w1"]);
  });

  it("puts windows and a front door on a plan that has none", () => {
    const render = withFacadeOpenings(bareBox, DEFAULT_DESIGN);
    const openings = render.levels[0].openings;
    expect(openings.filter((o) => o.kind === "door")).toHaveLength(1);
    expect(openings.filter((o) => o.kind === "window").length).toBeGreaterThan(2);
    const door = openings.find((o) => o.kind === "door")!;
    const host = render.levels[0].walls.find((w) => w.id === door.wallId)!;
    expect(host.start[1]).toBe(0); // on the street side
  });

  it("can leave blank walls blank", () => {
    const design = cloneDesign(DEFAULT_DESIGN);
    design.exterior.window.fillBlankWalls = false;
    expect(withFacadeOpenings(bareBox, design)).toBe(bareBox);
  });

  it("gives the model rooms of the planned size", () => {
    const render = withFacadeOpenings(bareBox, DEFAULT_DESIGN);
    const before = buildSceneGeometry(bareBox).floors, after = buildSceneGeometry(render).floors;
    expect(after.map((f) => [f.id, f.width, f.depth, f.centerX, f.centerZ])).toEqual(before.map((f) => [f.id, f.width, f.depth, f.centerX, f.centerZ]));
  });
});

describe("roof forms", () => {
  it("builds a flat slab with no sloped planes", () => {
    const m = model(bareBox, (d) => { d.exterior.roof.type = "flat"; });
    expect(parts(m.prims, "roof").every((p) => p.kind === "box")).toBe(true);
  });

  it("raises a ridge above the walls by the pitch", () => {
    const low = model(bareBox, (d) => { d.exterior.roof.type = "gable"; d.exterior.roof.pitch = 20; });
    const high = model(bareBox, (d) => { d.exterior.roof.type = "gable"; d.exterior.roof.pitch = 45; });
    expect(low.roofTop).toBeGreaterThan(10);
    expect(high.roofTop).toBeGreaterThan(low.roofTop + 3);
  });

  it("makes different geometry for each roof type", () => {
    const seen = new Set<string>();
    for (const type of ["flat", "cantilever", "gable", "hip", "shed", "mansard"] as const) {
      seen.add(JSON.stringify(parts(model(bareBox, (d) => { d.exterior.roof.type = type; }).prims, "roof")));
    }
    expect(seen.size).toBe(6);
  });

  it("closes the gable ends and lets the overhang pass the walls", () => {
    const m = model(bareBox, (d) => { d.exterior.roof.type = "gable"; d.exterior.roof.overhang = 3; });
    expect(parts(m.prims, "gableWall").length).toBeGreaterThan(0);
    const xs = parts(m.prims, "roof").flatMap((p) => (p.kind === "polygon" ? p.points.map((q) => q[0]) : []));
    expect(Math.max(...xs)).toBeGreaterThan(15);
  });

  it("roofs a lower wing that the upper floor does not cover", () => {
    const wing: FloorPlan = {
      ...twoStorey,
      levels: [twoStorey.levels[0], { ...twoStorey.levels[1], rooms: [twoStorey.levels[1].rooms[0]] }],
    };
    const m = model(wing, (d) => { d.exterior.roof.type = "hip"; });
    const heights = parts(m.prims, "roof").flatMap((p) => (p.kind === "polygon" ? p.points.map((q) => q[1]) : []));
    expect(Math.min(...heights)).toBeLessThan(11); // over the ground floor
    expect(Math.max(...heights)).toBeGreaterThan(20); // over the first floor
  });

  it("only offers a rooftop terrace on a flat roof reached by stairs", () => {
    expect(model(bareBox, (d) => { d.exterior.roof.type = "flat"; }).walkableRoof).toBe(false);
    const withStairs = cloneDesign(designForCategory("modern"));
    withStairs.exterior.roof.type = "flat";
    withStairs.exterior.roof.parapet = false;
    const plan: FloorPlan = { ...bareBox, levels: [{ ...bareBox.levels[0], rooms: [...bareBox.levels[0].rooms, { id: "s", type: "staircase", name: "Stairs", polygon: [[0, 30], [8, 30], [8, 40], [0, 40]] }] }] };
    expect(buildDesignModel(buildSceneGeometry(plan), plan, withStairs).walkableRoof).toBe(true);
  });
});

describe("facade geometry", () => {
  it("shapes windows with a plate inside the plan's rectangular opening", () => {
    const rectangular = model(bareBox, (d) => { d.exterior.window.shape = "rectangular"; });
    const arched = model(bareBox, (d) => { d.exterior.window.shape = "arched"; });
    const plates = (m: typeof arched) => parts(m.prims, "walls").filter((p) => p.kind === "extrude").length;
    expect(plates(rectangular)).toBe(0);
    expect(plates(arched)).toBeGreaterThan(0);
  });

  it("keeps every window shape inside its opening", () => {
    for (const shape of ["rectangular", "arched", "segmental", "round", "gothic"] as const) {
      const outline = openingOutline(shape, 4, 6);
      expect(Math.max(...outline.map((p) => Math.abs(p[0])))).toBeLessThanOrEqual(2.0001);
      expect(Math.max(...outline.map((p) => Math.abs(p[1])))).toBeLessThanOrEqual(3.0001);
    }
  });

  it("adds shutters, hoods and surrounds as real parts", () => {
    expect(parts(model(bareBox, (d) => { d.exterior.window.trim = "shutters"; }).prims, "shutter").length).toBeGreaterThan(0);
    const none = parts(model(bareBox, (d) => { d.exterior.window.trim = "none"; }).prims, "trim").length;
    expect(parts(model(bareBox, (d) => { d.exterior.window.trim = "surround"; }).prims, "trim").length).toBeGreaterThan(none);
  });

  it("changes the front door with its design", () => {
    const flush = parts(model(bareBox, (d) => { d.exterior.door.design = "flush"; }).prims, "door").length;
    const panelled = parts(model(bareBox, (d) => { d.exterior.door.design = "panelled"; }).prims, "door").length;
    expect(panelled).toBeGreaterThan(flush);
    expect(parts(model(bareBox, (d) => { d.exterior.door.design = "glazed"; }).prims, "doorGlass").length).toBeGreaterThan(0);
  });

  it("closes the front door for the facade and opens it for the walkthrough", () => {
    const y = (m: ReturnType<typeof model>) => JSON.stringify(parts(m.prims, "door"));
    expect(y(model(bareBox, () => {}, undefined, { doorsOpen: true }))).not.toBe(y(model(bareBox)));
  });

  it("puts accent cladding only on the street side", () => {
    const m = model(bareBox, (d) => { d.exterior.accentPlacement = "front"; });
    const accents = parts(m.prims, "accent");
    expect(accents.length).toBeGreaterThan(0);
    expect(accents.every((p) => p.kind === "box" && p.center[2] < -19)).toBe(true);
  });

  it("removes the accent when placement is none", () => {
    expect(parts(model(bareBox, (d) => { d.exterior.accentPlacement = "none"; }).prims, "accent")).toHaveLength(0);
  });

  it("hangs balconies only from upper windows, without touching rooms", () => {
    const on = model(twoStorey, (d) => { d.exterior.balcony.projected = true; d.exterior.window.fillBlankWalls = false; });
    const slabs = parts(on.prims, "balconySlab").filter((p) => p.kind === "box" && p.size[1] < 1);
    expect(slabs.length).toBeGreaterThan(0);
    expect(slabs.every((p) => p.kind === "box" && p.center[1] > 9)).toBe(true);
    expect(parts(model(bareBox, (d) => { d.exterior.balcony.projected = true; }).prims, "balconySlab")).toHaveLength(0);
  });

  it("swaps the plan's open-edge parapet for the chosen railing upstairs", () => {
    const glass = model(twoStorey, (d) => { d.exterior.balcony.style = "glass"; d.exterior.balcony.projected = false; });
    const balusters = model(twoStorey, (d) => { d.exterior.balcony.style = "baluster"; d.exterior.balcony.projected = false; });
    expect(parts(glass.prims, "railGlass").length).toBeGreaterThan(0);
    expect(parts(balusters.prims, "railing").length).toBeGreaterThan(parts(glass.prims, "railing").length);
  });

  it("builds every facade style into different geometry", () => {
    const seen = new Set<number>();
    for (const category of Object.keys(STYLE_KITS) as (keyof typeof STYLE_KITS)[]) seen.add(model(bareBox, () => {}, designForCategory(category)).prims.length);
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe("interior and site", () => {
  it("lines each room's walls with that room's own part", () => {
    const m = model(bareBox);
    for (const id of ["living", "bed", "kitchen"]) expect(parts(m.prims, `roomWall:${id}`).length).toBeGreaterThanOrEqual(4);
  });

  it("gives ceiling styles their own geometry", () => {
    const beams = (s: "flat" | "beams" | "coffered") => parts(model(bareBox, (d) => { d.interior.ceilingStyle = s; }).prims, "ceilingBeam").length;
    expect(beams("flat")).toBe(0);
    expect(beams("coffered")).toBeGreaterThan(beams("beams"));
  });

  it("lets one room differ from the house", () => {
    const m = model(bareBox, (d) => { d.interior.rooms.kitchen = { ceilingStyle: "beams" }; });
    expect(parts(m.prims, "ceilingBeam").length).toBeGreaterThan(0);
  });

  it("plants the requested number of trees, the same way each time", () => {
    const trees = (n: number) => parts(model(bareBox, (d) => { d.environment.trees = n; d.environment.surroundings = "suburban"; }).prims, "trunk");
    expect(trees(0)).toHaveLength(0);
    expect(trees(5)).toHaveLength(5);
    expect(trees(5)).toEqual(trees(5));
  });

  it("keeps trees out of the house", () => {
    const m = model(bareBox, (d) => { d.environment.trees = 12; });
    for (const t of parts(m.prims, "trunk")) {
      const [x, , z] = (t as Extract<Prim, { kind: "cylinder" }>).center;
      expect(Math.abs(x) < 15 && z > -20 && z < 10).toBe(false);
    }
  });

  it("runs a path from the door to the street", () => {
    const m = model(bareBox, (d) => { d.environment.path.style = "straight"; });
    expect(parts(m.prims, "path").length).toBeGreaterThan(0);
    expect(m.entry?.street).toBe(true);
    expect(parts(model(bareBox, (d) => { d.environment.path.style = "none"; }).prims, "path")).toHaveLength(0);
  });

  it("only adds a road where the surroundings have one", () => {
    expect(parts(model(bareBox, (d) => { d.environment.surroundings = "suburban"; }).prims, "road")).toHaveLength(1);
    expect(parts(model(bareBox, (d) => { d.environment.surroundings = "woodland"; }).prims, "road")).toHaveLength(0);
  });

  it("switches outdoor lights with the chosen style", () => {
    expect(model(bareBox, (d) => { d.environment.lighting.style = "none"; }).lights).toHaveLength(0);
    expect(model(bareBox, (d) => { d.environment.lighting.style = "all"; }).lights.length).toBeGreaterThan(0);
  });
});

describe("real-time updates", () => {
  it("a colour change does not rebuild geometry", () => {
    const next = setAt(DEFAULT_DESIGN, "exterior.wall", { materialId: "brick_red", color: "#AA0000" });
    expect(geometryKey(next)).toBe(geometryKey(DEFAULT_DESIGN));
  });

  it("a shape change does", () => {
    expect(geometryKey(setAt(DEFAULT_DESIGN, "exterior.roof.type", "gable"))).not.toBe(geometryKey(DEFAULT_DESIGN));
    expect(geometryKey(setAt(DEFAULT_DESIGN, "environment.trees", 9))).not.toBe(geometryKey(DEFAULT_DESIGN));
  });

  it("a colour change reaches the part that uses it", () => {
    const next = setAt(DEFAULT_DESIGN, "exterior.wall.color", "#123456");
    expect(surfaceFor("walls", next, bareBox, "day").color).toBe("#123456");
    expect(surfaceFor("gableWall", next, bareBox, "day").color).toBe("#123456");
  });

  it("lights windows at night and not by day", () => {
    expect(surfaceFor("glass", DEFAULT_DESIGN, bareBox, "day").emissiveIntensity).toBe(0);
    expect(surfaceFor("glass", DEFAULT_DESIGN, bareBox, "night").emissiveIntensity).toBeGreaterThan(0);
  });

  it("merges primitives into one mesh per part", () => {
    const m = model(bareBox);
    const meshes = buildPartGeometries(m.prims);
    expect(meshes.size).toBe(new Set(m.prims.map((p) => p.part)).size);
    for (const geometry of meshes.values()) {
      const position = geometry.getAttribute("position");
      expect(position.count).toBeGreaterThan(0);
      expect(position.count % 3).toBe(0);
      expect(Number.isFinite(position.getX(0) + position.getY(0) + position.getZ(0))).toBe(true);
      expect(geometry.getAttribute("uv").count).toBe(position.count);
    }
  });

  it("builds every gallery design into finite geometry on a two-storey plan", () => {
    for (const entry of GALLERY) {
      for (const geometry of buildPartGeometries(model(twoStorey, () => {}, entry.design).prims).values()) {
        const array = geometry.getAttribute("position").array as Float32Array;
        expect(array.every(Number.isFinite), entry.id).toBe(true);
      }
    }
  });
});

describe("undo and redo", () => {
  const a = designForCategory("modern"), b = designForCategory("luxury"), c = designForCategory("traditional");

  it("steps back and forward", () => {
    let h = commit(commit(startHistory(a), b), c);
    h = undo(h);
    expect(h.present).toBe(b);
    h = undo(h);
    expect(h.present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
  });

  it("drops the redo branch after a new edit", () => {
    const h = commit(undo(commit(startHistory(a), b)), c);
    expect(h.future).toHaveLength(0);
  });

  it("treats a colour drag as a single step", () => {
    let h = startHistory(a);
    h = commit(h, b, "wall", 1000);
    h = commit(h, c, "wall", 1200);
    expect(h.past).toHaveLength(1);
    expect(undo(h).present).toBe(a);
  });

  it("starts a new step after a pause or on another control", () => {
    let h = startHistory(a);
    h = commit(h, b, "wall", 1000);
    h = commit(h, c, "wall", 5000);
    expect(h.past).toHaveLength(2);
    h = commit(h, a, "roof", 5100);
    expect(h.past).toHaveLength(3);
  });

  it("can undo back to the original model", () => {
    expect(undo(commit(startHistory(null), a)).present).toBe(null);
  });
});

describe("design document", () => {
  it("setAt copies only along the path", () => {
    const next = setAt(DEFAULT_DESIGN, "exterior.roof.pitch", 40);
    expect(getAt(next, "exterior.roof.pitch")).toBe(40);
    expect(DEFAULT_DESIGN.exterior.roof.pitch).toBe(28);
    expect(next.interior).toBe(DEFAULT_DESIGN.interior);
  });

  it("creates a per-room override on first edit", () => {
    const next = setAt(DEFAULT_DESIGN, "interior.rooms.kitchen.wall", { materialId: "tile_white", color: "#FFFFFF" });
    expect(next.interior.rooms.kitchen.wall?.materialId).toBe("tile_white");
    expect(Object.keys(DEFAULT_DESIGN.interior.rooms)).toHaveLength(0);
  });

  it("fills in fields an older save does not have", () => {
    const restored = normalizeDesign({ exterior: { wall: { materialId: "brick_red", color: "#A5503A" } } });
    expect(restored.exterior.wall.materialId).toBe("brick_red");
    expect(restored.exterior.roof.type).toBe(DEFAULT_DESIGN.exterior.roof.type);
    expect(restored.environment.trees).toBe(DEFAULT_DESIGN.environment.trees);
  });

  it("survives a save and reload unchanged", () => {
    const design = designForCategory("luxury");
    design.interior.rooms.bed = { wall: { materialId: "wood_oak", color: "#B58F63" }, ceilingStyle: "tray" };
    const doc = normalizeDocument(JSON.parse(JSON.stringify({ design, generated: design, reference: null, reading: null, variations: [], activeVariationId: null })));
    expect(doc.design).toEqual(design);
  });

  it("opens an empty project as empty", () => {
    expect(normalizeDocument({}).design).toBe(null);
    expect(normalizeDocument(undefined).variations).toEqual([]);
  });
});

describe("rooms and parts", () => {
  it("prefers a room override, then the Interior Designer's colour, then the house default", () => {
    const room = { ...bareBox.levels[0].rooms[0], interior: { wallColor: "#ABCDEF" } };
    expect(roomFinish(DEFAULT_DESIGN, room, room.id, "wall").color).toBe("#ABCDEF");
    const custom = setAt(DEFAULT_DESIGN, `interior.rooms.${room.id}.wall`, { materialId: "tile_white", color: "#111111" });
    expect(roomFinish(custom, room, room.id, "wall").color).toBe("#111111");
    expect(roomFinish(DEFAULT_DESIGN, bareBox.levels[0].rooms[1], "bed", "wall")).toEqual(DEFAULT_DESIGN.interior.wall);
  });

  it("keeps sensible floors by room type until a house-wide floor is chosen", () => {
    const bath = { id: "b", type: "bathroom" as const, name: "Bath", polygon: [[0, 0], [1, 0], [1, 1]] as [number, number][] };
    expect(getMaterial(roomFinish(DEFAULT_DESIGN, bath, "b", "floor").materialId).category).toBe("marble");
    const chosen = setAt(DEFAULT_DESIGN, "interior.floor", { materialId: "tile_white", color: "#FFFFFF" });
    expect(roomFinish(chosen, bath, "b", "floor").materialId).toBe("tile_white");
  });

  it("finds what a clicked mesh edits", () => {
    expect(targetForPart("walls")?.path).toBe("exterior.wall");
    expect(targetForPart("roof")?.section).toBe("roof");
    expect(targetForPart("roomFloor:kitchen")).toMatchObject({ path: "interior.rooms.kitchen.floor", roomId: "kitchen", section: "interior" });
  });

  it("points every paintable part at a real finish", () => {
    for (const part of PAINTABLE_PARTS) expect(finishAt(DEFAULT_DESIGN, part.path), part.path).toBeTruthy();
  });

  it("keeps the facade style's colours when the style changes", () => {
    const start = setAt(DEFAULT_DESIGN, "exterior.wall.color", "#123456");
    const next = applyFacadeStyle(start, "mediterranean");
    expect(next.exterior.wall.color).toBe("#123456");
    expect(next.exterior.window.shape).toBe("arched");
    expect(next.category).toBe("mediterranean");
  });
});

describe("library and gallery", () => {
  it("has every requested material family, each with options", () => {
    for (const category of ["wood", "marble", "concrete", "stone", "glass", "brick", "tile", "paint"] as const) {
      expect(materialsIn(category).length, category).toBeGreaterThanOrEqual(4 - (category === "concrete" ? 0 : 0));
    }
    expect(MATERIAL_CATEGORIES.map((c) => c.label)).toEqual(expect.arrayContaining(["Wood", "Marble", "Concrete", "Natural stone", "Glass", "Brick", "Ceramic tiles", "Paint finishes"]));
  });

  it("uses unique material ids", () => {
    expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length);
  });

  it("covers every style with at least two designs", () => {
    for (const category of Object.keys(STYLE_KITS)) expect(GALLERY.filter((g) => g.category === category).length, category).toBeGreaterThanOrEqual(2);
  });

  it("only refers to materials that exist", () => {
    const ids = new Set(MATERIALS.map((m) => m.id));
    for (const entry of GALLERY) {
      JSON.stringify(entry.design, (key, value) => {
        if (key === "materialId") expect(ids.has(value), `${entry.id}: ${value}`).toBe(true);
        return value;
      });
    }
  });

  it("shows a palette and materials for each design", () => {
    for (const entry of GALLERY) {
      expect(galleryPalette(entry.design).length).toBeGreaterThanOrEqual(3);
      expect(galleryMaterials(entry.design).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("visible wording", () => {
  const SRC = path.resolve(__dirname, "../..");
  const files = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/\.(tsx?|css)$/.test(name)) out.push(full);
    }
    return out;
  };

  it('never says "AI" in the house design studio', () => {
    const scanned = [...files(path.join(SRC, "components/house-design")), ...files(path.join(SRC, "lib/house-design")), path.join(SRC, "app/studio/[projectId]/design/page.tsx")];
    for (const file of scanned) expect(/\bA\.?I\b/.test(readFileSync(file, "utf8")), file).toBe(false);
  });
});

describe("mergeRects", () => {
  const r = (x0: number, x1: number, z0: number, z1: number) => ({ x0, x1, z0, z1 });

  it("joins neighbouring rooms into one roof", () => {
    expect(mergeRects([r(0, 10, 0, 10), r(10, 20, 0, 10)])).toEqual([r(0, 20, 0, 10)]);
  });

  it("keeps an L-shape as two pieces", () => {
    expect(mergeRects([r(0, 20, 0, 10), r(0, 10, 10, 20)])).toHaveLength(2);
  });

  it("leaves out what is covered by the floor above", () => {
    const rest = mergeRects([r(0, 20, 0, 10)], [r(0, 10, 0, 10)]);
    expect(rest).toEqual([r(10, 20, 0, 10)]);
  });

  it("returns nothing when everything is covered", () => {
    expect(mergeRects([r(0, 10, 0, 10)], [r(0, 10, 0, 10)])).toEqual([]);
  });
});
