import { describe, expect, it } from "vitest";
import type { FloorPlan } from "@houseplan/design-schema";
import { catalog, catalogCategories, getCatalogDesign, previewImage, searchCatalog } from "../house-design/catalog";
import { baseRecord, composeDesign, matchReport, type ViewReading } from "../house-design/design-engine";
import { baseGeometry, planFingerprint, roomMeasures } from "../house-design/geometry-engine";
import type { FacadeAnalysis } from "../house-design/image-analysis";
import { buildDesignModel, geometryKey } from "../house-design/model";
import { objectFinish, orphanedOverrides, siblingsOf, withObjectFinish, withOverride, withoutOverride } from "../house-design/objects";
import { EMPTY_DOCUMENT, cloneDesign, normalizeDocument, pruneImages, type HouseDesign } from "../house-design/schema";
import { designForCategory } from "../house-design/styles";
import { syncMeshes } from "../house-design/three-build";
import { diffDesigns } from "../house-design/variations";

const house: FloorPlan = {
  schemaVersion: 1, projectId: "h", units: "ft",
  plot: { width: 40, length: 50, floors: 2, shape: "rectangle" },
  levels: [
    {
      id: "ground", elevation: 0, wallHeight: 10,
      rooms: [
        { id: "living", type: "living_room", name: "Living", polygon: [[5, 5], [20, 5], [20, 25], [5, 25]] },
        { id: "kitchen", type: "kitchen", name: "Kitchen", polygon: [[20, 5], [35, 5], [35, 25], [20, 25]] },
      ],
      walls: [{ id: "w1", start: [5, 5], end: [35, 5], thickness: 0.75, height: 10, kind: "exterior" }],
      openings: [
        { id: "front-door", wallId: "w1", kind: "door", offset: 8, width: 3.5 },
        { id: "front-win", wallId: "w1", kind: "window", offset: 22, width: 6 },
      ],
      furniture: [],
    },
    {
      id: "first", elevation: 10, wallHeight: 10,
      rooms: [{ id: "bed", type: "bedroom", name: "Bedroom", polygon: [[5, 5], [35, 5], [35, 25], [5, 25]] }],
      walls: [{ id: "w2", start: [5, 5], end: [35, 5], thickness: 0.75, height: 10, kind: "exterior" }],
      openings: [{ id: "upper-win", wallId: "w2", kind: "window", offset: 15, width: 6 }],
      furniture: [],
    },
  ],
  metadata: { version: 1, status: "draft" },
};

function modelOf(design: HouseDesign) {
  const base = baseGeometry(house, design);
  return buildDesignModel(base.geometry, base.renderPlan, design);
}

const design = () => designForCategory("modern");

describe("semantic objects", () => {
  it("gives every object a unique id", () => {
    const { objects } = modelOf(design());
    expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length);
    expect(objects.length).toBeGreaterThan(10);
  });

  it("keeps ids the same when the model is rebuilt with another look", () => {
    const ids = (d: HouseDesign) => modelOf(d).objects.filter((o) => o.kind === "wall" || o.kind === "window").map((o) => o.id).sort();
    const other = design();
    other.exterior.roof.type = "hip";
    other.exterior.window.shape = "arched";
    expect(ids(other)).toEqual(ids(design()));
  });

  it("names windows and doors after the plan's own openings", () => {
    const ids = modelOf(design()).objects.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["window:front-win", "window:upper-win", "door:front-door"]));
  });

  it("knows which side of the house each object is on", () => {
    const { objects } = modelOf(design());
    expect(objects.find((o) => o.id === "window:front-win")?.elevation).toBe("front");
    const sides = new Set(objects.filter((o) => o.kind === "wall").map((o) => o.elevation));
    expect(sides).toEqual(new Set(["front", "rear", "left", "right"]));
  });

  it("links a window to the wall it sits in", () => {
    const { objects } = modelOf(design());
    const window_ = objects.find((o) => o.id === "window:front-win")!;
    const host = objects.find((o) => o.id === window_.host);
    expect(host?.kind).toBe("wall");
    expect(host?.elevation).toBe("front");
  });

  it("makes each wall individually selectable, with its pieces around openings grouped", () => {
    const m = modelOf(design());
    const walls = m.objects.filter((o) => o.kind === "wall");
    expect(walls.length).toBeGreaterThanOrEqual(8);
    for (const wall of walls) expect(m.prims.some((p) => p.object === wall.id && p.part === "walls")).toBe(true);
  });

  it("has bounds for framing an object", () => {
    for (const object of modelOf(design()).objects) expect(object.bounds).not.toBeNull();
  });

  it("marks model-added openings, which the plan does not contain", () => {
    const { objects } = modelOf(design());
    expect(objects.find((o) => o.id === "window:front-win")?.modelOnly).toBe(false);
    expect(objects.some((o) => o.kind === "window" && o.modelOnly)).toBe(true);
  });
});

describe("individual edits", () => {
  const frontWall = (d: HouseDesign) => modelOf(d).objects.find((o) => o.kind === "wall" && o.elevation === "front")!;

  it("changes one wall's finish and no other's", () => {
    const base = design();
    const wall = frontWall(base);
    const finish = { materialId: "brick_red", color: "#A5503A" };
    const edited = withObjectFinish(base, [wall.id], "walls", finish);
    expect(objectFinish(edited, wall.id, "walls")).toEqual(finish);
    const other = modelOf(base).objects.find((o) => o.kind === "wall" && o.id !== wall.id)!;
    expect(objectFinish(edited, other.id, "walls")).toBeUndefined();
    expect(base.overrides).toEqual({});
  });

  it("does not rebuild any mesh for a finish change", () => {
    const base = design();
    const before = syncMeshes(new Map(), modelOf(base).prims);
    const edited = withObjectFinish(base, [frontWall(base).id], "walls", { materialId: "brick_red", color: "#A5503A" });
    const after = syncMeshes(before.meshes, modelOf(edited).prims);
    expect(after.built).toBe(0);
  });

  it("leaves shape unchanged by a finish", () => {
    const base = design();
    const a = geometryKey(withObjectFinish(base, ["wall:x"], "walls", { materialId: "brick_red", color: "#A5503A" }));
    const b = geometryKey(withObjectFinish(base, ["wall:x"], "walls", { materialId: "stone_slate", color: "#222222" }));
    expect(a).toBe(b);
  });

  it("rebuilds only the edited window when its shape changes", () => {
    const base = design();
    const before = syncMeshes(new Map(), modelOf(base).prims);
    const edited = withOverride(base, "window:front-win", (o) => ({ ...o, window: { shape: "arched" } }));
    const after = syncMeshes(before.meshes, modelOf(edited).prims);
    expect(after.built).toBeGreaterThan(0);
    expect(after.built).toBeLessThan(8);
    expect(after.reused).toBeGreaterThan(after.built * 10);
    const rebuilt = [...after.meshes.values()].filter((m) => m !== before.meshes.get(m.key));
    expect(new Set(rebuilt.map((m) => m.object))).toEqual(new Set(["window:front-win"]));
  });

  it("changes a window's real geometry, leaving its neighbours alone", () => {
    const shape = (d: HouseDesign, id: string) => JSON.stringify(modelOf(d).prims.filter((p) => p.object === id));
    const base = design();
    const edited = withOverride(base, "window:front-win", (o) => ({ ...o, window: { shape: "round" } }));
    expect(shape(edited, "window:front-win")).not.toBe(shape(base, "window:front-win"));
    expect(shape(edited, "window:upper-win")).toBe(shape(base, "window:upper-win"));
  });

  it("changes one door's design", () => {
    const base = design();
    const edited = withOverride(base, "door:front-door", (o) => ({ ...o, door: { design: "double" } }));
    const leaves = (d: HouseDesign) => modelOf(d).prims.filter((p) => p.object === "door:front-door").length;
    expect(leaves(edited)).not.toBe(leaves(base));
  });

  it("rebuilds the actual roof geometry for a roof change", () => {
    const base = design();
    const roof = modelOf(base).objects.find((o) => o.kind === "roof")!;
    const before = modelOf(base);
    const edited = modelOf(withOverride(base, roof.id, (o) => ({ ...o, roof: { type: "gable", pitch: 35 } })));
    expect(edited.roofTop).toBeGreaterThan(before.roofTop);
    expect(edited.prims.filter((p) => p.object === roof.id).some((p) => p.kind === "polygon")).toBe(true);
  });

  it("edits one balcony on its own, and can take it away", () => {
    const base = design();
    base.exterior.balcony.projected = true;
    const id = "balcony:upper-win";
    const count = (d: HouseDesign) => modelOf(d).prims.filter((p) => p.object === id).length;
    expect(count(base)).toBeGreaterThan(0);
    expect(count(withOverride(base, id, (o) => ({ ...o, hidden: true })))).toBe(0);
    expect(count(withOverride(base, id, (o) => ({ ...o, balcony: { style: "baluster" } })))).toBeGreaterThan(count(base));
  });

  it("removes a model-added window and keeps the plan's own", () => {
    const base = design();
    const added = modelOf(base).objects.find((o) => o.kind === "window" && o.modelOnly)!;
    const after = modelOf(withOverride(base, added.id, (o) => ({ ...o, hidden: true })));
    expect(after.objects.some((o) => o.id === added.id)).toBe(false);
    expect(after.objects.some((o) => o.id === "window:front-win")).toBe(true);
  });

  it("puts a side's balconies on the chosen side", () => {
    const base = design();
    base.exterior.balcony.projected = true;
    base.exterior.balcony.elevations = ["rear"];
    const sides = new Set(modelOf(base).objects.filter((o) => o.kind === "balcony").map((o) => o.elevation));
    expect(sides.has("front")).toBe(false);
  });

  it("lets go of an edit that is reset", () => {
    const base = withOverride(design(), "window:front-win", (o) => ({ ...o, window: { shape: "round" } }));
    expect(withoutOverride(base, "window:front-win").overrides).toEqual({});
  });

  it("finds its neighbours on the same side", () => {
    const { objects } = modelOf(design());
    const pane = objects.find((o) => o.id === "window:front-win")!;
    expect(siblingsOf(pane, objects).every((o) => o.kind === "window" && o.elevation === "front")).toBe(true);
  });

  it("reports edits whose object has left the plan", () => {
    const base = withObjectFinish(design(), ["wall:gone"], "walls", { materialId: "brick_red", color: "#A5503A" });
    expect(orphanedOverrides(base, modelOf(base).objects)).toEqual(["wall:gone"]);
  });
});

describe("floor plan stays as drawn", () => {
  it("keeps room sizes through any design", () => {
    const rooms = (d: HouseDesign) => roomMeasures(baseGeometry(house, d).geometry);
    const before = rooms(design());
    for (const style of ["luxury", "mediterranean", "traditional"] as const) {
      const d = designForCategory(style);
      d.exterior.roof.type = "mansard";
      expect(rooms(withOverride(d, "window:front-win", (o) => ({ ...o, window: { shape: "gothic" } })))).toEqual(before);
    }
  });

  it("keeps the fingerprint through designs, and changes it when the layout changes", () => {
    const before = planFingerprint(house);
    baseGeometry(house, designForCategory("luxury"));
    expect(planFingerprint(house)).toBe(before);
    const moved = JSON.parse(JSON.stringify(house)) as FloorPlan;
    moved.levels[0].rooms[0].polygon[1][0] = 22;
    expect(planFingerprint(moved)).not.toBe(before);
  });

  it("ignores furniture in the fingerprint", () => {
    const furnished = JSON.parse(JSON.stringify(house)) as FloorPlan;
    furnished.levels[0].furniture = [{ id: "s", type: "sofa", position: [10, 10], rotation: 0, dimensions: { width: 6, depth: 3, height: 3 } } as never];
    expect(planFingerprint(furnished)).toBe(planFingerprint(house));
  });

  it("records the base model with the sources it came from", () => {
    const record = baseRecord(house, design(), ["b", "a"]);
    expect(record.planFingerprint).toBe(planFingerprint(house));
    expect(record.sources).toEqual(["a", "b"]);
    expect(record.rooms).toHaveLength(3);
    expect(record.objects.length).toBeGreaterThan(10);
  });
});

function analysis(change: (a: FacadeAnalysis) => void = () => {}): FacadeAnalysis {
  const a: FacadeAnalysis = {
    found: true, width: 360, height: 240, box: { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.9 }, skyShare: 0.2, greeneryShare: 0.1,
    palette: [{ hex: "#E6DCCB", share: 0.5 }, { hex: "#8C4A32", share: 0.2 }],
    wall: { value: { hex: "#E6DCCB", texture: "stucco" }, confidence: 0.7 },
    accent: { value: null, confidence: 0.3 },
    roof: { value: { type: "hip", pitch: 28, hex: "#8C4A32", overhangRatio: 0.06 }, confidence: 0.6 },
    windows: { value: { count: 4, coverage: 0.2, shape: "rectangular", grid: "cross", aspect: 1.4, frameHex: "#2B2C33", glassHex: "#334455", glowing: false }, confidence: 0.6 },
    door: { value: { hex: "#5B3A26", glazed: false, aspect: 2 }, confidence: 0.5 },
    balcony: { value: null, confidence: 0.3 },
    storeys: { value: 2, confidence: 0.55 },
    symmetry: 0.7,
    landscape: { lawn: 0.3, trees: 0.2 },
    style: { value: "mediterranean", confidence: 0.5, scores: { modern: 0.1, minimalist: 0.1, contemporary: 0.2, luxury: 0.2, traditional: 0.3, mediterranean: 0.6 } },
    warnings: [],
  };
  change(a);
  return a;
}

const view = (elevation: ViewReading["elevation"], change?: (a: FacadeAnalysis) => void): ViewReading => ({ elevation, analysis: analysis(change), deep: null });

describe("several reference views", () => {
  it("keeps a side view to its own side of the house", () => {
    const { design: d } = composeDesign({
      plan: house,
      views: [view("front"), view("rear", (a) => { a.wall.value = { hex: "#7A3B2E", texture: "brick" }; a.windows.value.shape = "arched"; })],
    });
    const { objects } = modelOf(d);
    const rearWalls = objects.filter((o) => o.kind === "wall" && o.elevation === "rear");
    const frontWalls = objects.filter((o) => o.kind === "wall" && o.elevation === "front");
    expect(rearWalls.length).toBeGreaterThan(0);
    for (const wall of rearWalls) expect(d.overrides[wall.id]?.finishes?.walls.materialId).toMatch(/^brick/);
    for (const wall of frontWalls) expect(d.overrides[wall.id]).toBeUndefined();
    for (const pane of objects.filter((o) => o.kind === "window" && o.elevation === "rear")) expect(d.overrides[pane.id]?.window?.shape).toBe("arched");
    expect(d.overrides["window:front-win"]).toBeUndefined();
  });

  it("does not let an unsure view change its side", () => {
    const { design: d } = composeDesign({ plan: house, views: [view("front"), view("rear", (a) => { a.wall.confidence = 0.2; a.windows.confidence = 0.2; })] });
    expect(Object.keys(d.overrides)).toEqual([]);
  });

  it("marks reference edits as coming from a reference", () => {
    const { design: d } = composeDesign({ plan: house, views: [view("front"), view("rear")] });
    expect(Object.values(d.overrides).every((o) => o.source === "reference")).toBe(true);
  });

  it("lets a side view settle a roof the front cannot show", () => {
    const flatFront = (a: FacadeAnalysis) => { a.roof.value.type = "flat"; a.roof.confidence = 0.45; };
    const gableSide = (a: FacadeAnalysis) => { a.roof.value.type = "gable"; a.roof.value.pitch = 34; a.roof.confidence = 0.6; };
    const { design: d, reading } = composeDesign({ plan: house, views: [view("front", flatFront), view("left", gableSide)] });
    expect(d.exterior.roof.type).toBe("gable");
    expect(d.exterior.roof.pitch).toBe(34);
    expect(reading.notes.join(" ")).toMatch(/disagree/);
  });

  it("gains a little confidence when views agree, and never reaches certainty", () => {
    const sure = (a: FacadeAnalysis) => { a.roof.confidence = 0.85; };
    const { parameters } = composeDesign({ plan: house, views: [view("front", sure), view("rear", sure), view("left", sure), view("right", sure)] });
    expect(parameters.roof.confidence).toBeLessThanOrEqual(0.85);
    const one = composeDesign({ plan: house, views: [view("front")] }).parameters.roof.confidence!;
    const two = composeDesign({ plan: house, views: [view("front"), view("rear")] }).parameters.roof.confidence!;
    expect(two).toBeGreaterThan(one);
  });

  it("adds balconies only on the side that shows them", () => {
    const { design: d } = composeDesign({ plan: house, views: [view("front"), view("rear", (a) => { a.balcony = { value: { style: "glass", hex: "#CCCCCC" }, confidence: 0.6 }; })] });
    expect(d.exterior.balcony.projected).toBe(true);
    expect(d.exterior.balcony.elevations).toEqual(["rear"]);
  });

  it("says so when there is no front view", () => {
    const { reading } = composeDesign({ plan: house, views: [view("rear")] });
    expect(reading.notes.join(" ")).toMatch(/no front view/);
  });

  it("says so when a view shows no building", () => {
    const { reading, design: d } = composeDesign({ plan: house, views: [view("front"), view("left", (a) => { a.found = false; })] });
    expect(reading.notes.join(" ")).toMatch(/No building was found in the left side view/);
    expect(Object.keys(d.overrides)).toEqual([]);
  });

  it("applies a rear photo on top of a gallery design", () => {
    const preset = designForCategory("luxury");
    const { design: d, parameters } = composeDesign({ plan: house, views: [view("rear")], preset: { design: preset, views: ["front"] } });
    expect(d.category).toBe("luxury");
    expect(Object.keys(d.overrides).length).toBeGreaterThan(0);
    expect(parameters.views).toEqual(["front", "rear"]);
    expect(preset.overrides).toEqual({});
  });
});

describe("design parameters", () => {
  it("covers everything the reading must return, as plain JSON", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    const keys = ["style", "silhouette", "floors", "roof", "facade", "windows", "doors", "balconies", "materials", "palette", "details"];
    expect(Object.keys(parameters)).toEqual(expect.arrayContaining(keys));
    expect(JSON.parse(JSON.stringify(parameters))).toEqual(parameters);
  });

  it("marks what no image showed, with no figure", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front", (a) => { a.door = { value: null, confidence: 0.2 }; })] });
    expect(parameters.doors).toEqual({ value: null, confidence: null, basis: "not-visible", views: [] });
    expect(parameters.balconies.basis).toBe("not-visible");
  });

  it("gives no confidence to what comes from the style and not the image", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    expect(parameters.details.basis).toBe("style-default");
    expect(parameters.details.confidence).toBeNull();
  });

  it("gives a photo with no building no measured values", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front", (a) => { a.found = false; })] });
    expect(parameters.roof.basis).toBe("not-visible");
    expect(parameters.floors.value).toBeNull();
  });

  it("gives a gallery design no invented confidence", () => {
    const { parameters, reading } = composeDesign({ plan: house, views: [], preset: { design: designForCategory("modern"), views: ["front"] } });
    expect(parameters.style.basis).toBe("preset");
    expect(parameters.style.confidence).toBeNull();
    expect(reading.attributes[0].confidence).toBeNull();
  });

  it("never reports a measured value as certain", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    for (const value of Object.values(parameters)) {
      if (typeof value === "object" && value && "confidence" in value && value.confidence !== null) expect(value.confidence).toBeLessThanOrEqual(0.85);
    }
  });
});

describe("match check", () => {
  it("compares only what was measured", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    const rows = matchReport(parameters, analysis());
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(["roof", "windows", "floors", "wall"]));
  });

  it("has nothing to compare for a gallery design, which was not measured", () => {
    const { parameters } = composeDesign({ plan: house, views: [], preset: { design: designForCategory("modern"), views: ["front"] } });
    expect(matchReport(parameters, analysis())).toEqual([]);
  });

  it("flags a wall colour that drifted from the reference", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    const rows = matchReport(parameters, analysis((a) => { a.wall.value.hex = "#556677"; }));
    expect(rows.find((r) => r.id === "wall")?.agrees).toBe(false);
  });

  it("reports a difference when the render differs", () => {
    const { parameters } = composeDesign({ plan: house, views: [view("front")] });
    const rows = matchReport(parameters, analysis((a) => { a.roof.value.type = "flat"; }));
    expect(rows.find((r) => r.id === "roof")?.agrees).toBe(false);
  });
});

describe("variations", () => {
  it("lists what differs between two designs", () => {
    const a = design(), b = cloneDesign(a);
    b.exterior.roof.type = "gable";
    b.exterior.wall = { materialId: "brick_red", color: "#A5503A" };
    expect(diffDesigns(a, b).map((d) => d.id).sort()).toEqual(["roof", "wall"]);
  });

  it("finds no difference between a design and its copy", () => {
    expect(diffDesigns(design(), cloneDesign(design()))).toEqual([]);
  });

  it("counts individual edits as a difference", () => {
    const a = design();
    expect(diffDesigns(a, withOverride(a, "window:front-win", (o) => ({ ...o, window: { shape: "round" } }))).map((d) => d.id)).toEqual(["edits"]);
  });

  it("shares the same floor plan across every variation", () => {
    const rooms = (d: HouseDesign) => JSON.stringify(roomMeasures(baseGeometry(house, d).geometry));
    const looks = (["modern", "luxury", "traditional"] as const).map(designForCategory);
    expect(new Set(looks.map(rooms)).size).toBe(1);
  });
});

describe("stored document", () => {
  const image = { kind: "upload" as const, name: "a.jpg", src: "data:image/jpeg;base64,AAAA", width: 10, height: 10 };

  it("moves a saved single reference into the image pool", () => {
    const doc = normalizeDocument({ version: 1, design: design(), reference: image, variations: [{ id: "v", name: "One", design: design(), reference: image }] });
    expect(doc.version).toBe(2);
    expect(doc.references).toHaveLength(1);
    expect(doc.references[0].elevation).toBe("front");
    expect(Object.keys(doc.images)).toHaveLength(1);
    expect(doc.variations[0].references[0].imageId).toBe(doc.references[0].imageId);
    expect(doc.variations[0]).not.toHaveProperty("reference");
  });

  it("gives an older design the fields it lacks", () => {
    const old = JSON.parse(JSON.stringify(design()));
    delete old.overrides;
    delete old.exterior.balcony.elevations;
    const doc = normalizeDocument({ design: old });
    expect(doc.design?.overrides).toEqual({});
    expect(doc.design?.exterior.balcony.elevations).toEqual(["front"]);
  });

  it("keeps reference edits through a save and reopen", () => {
    const d = withObjectFinish(design(), ["wall:a"], "walls", { materialId: "brick_red", color: "#A5503A" });
    const reopened = normalizeDocument(JSON.parse(JSON.stringify({ ...EMPTY_DOCUMENT, design: d, generated: d })));
    expect(reopened.design?.overrides["wall:a"].finishes?.walls.materialId).toBe("brick_red");
  });

  it("drops images nothing uses, and keeps what a variation still needs", () => {
    const pool = { a: { ...image, id: "a" }, b: { ...image, id: "b" }, c: { ...image, id: "c" } };
    const doc = normalizeDocument({ images: pool, references: [{ elevation: "front", imageId: "a" }], variations: [{ id: "v", name: "V", design: design(), references: [{ elevation: "rear", imageId: "b" }] }] });
    expect(Object.keys(pruneImages(doc).images).sort()).toEqual(["a", "b"]);
  });
});

describe("design catalog", () => {
  const all = catalog();
  const query = { text: "", categoryId: null, subcategory: null, material: null, buildingType: null, sort: "recent" as const };

  it("has at least 500 entries with unique ids and names", () => {
    expect(all.length).toBeGreaterThanOrEqual(500);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(new Set(all.map((e) => e.name)).size).toBe(all.length);
  });

  it("makes every entry a different design, not a repeat", () => {
    expect(new Set(all.map((e) => JSON.stringify(e.design))).size).toBe(all.length);
  });

  it("gives each entry its own preview", () => {
    expect(new Set(all.map(previewImage)).size).toBe(all.length);
  });

  it("has all twenty categories, each with subcategories", () => {
    const categories = catalogCategories();
    expect(categories).toHaveLength(20);
    for (const c of categories) for (const s of c.subcategories) expect(all.some((e) => e.categoryId === c.id && e.subcategory === s)).toBe(true);
  });

  it("builds a sample of entries into geometry without moving a room", () => {
    const rooms = JSON.stringify(roomMeasures(baseGeometry(house, design()).geometry));
    for (const e of all.filter((_, i) => i % 17 === 0)) {
      const m = modelOf(e.design);
      expect(m.objects.length).toBeGreaterThan(10);
      expect(JSON.stringify(roomMeasures(baseGeometry(house, e.design).geometry))).toBe(rooms);
    }
  });

  it("searches by name and style, and filters", () => {
    expect(searchCatalog(all, { ...query, text: "haveli" }).every((e) => e.categoryId === "indian")).toBe(true);
    expect(searchCatalog(all, { ...query, text: "japanese" }).length).toBeGreaterThan(0);
    expect(searchCatalog(all, { ...query, categoryId: "coastal", subcategory: "Cliffside" }).every((e) => e.subcategory === "Cliffside")).toBe(true);
    expect(searchCatalog(all, { ...query, buildingType: "Villa" }).every((e) => e.buildingType === "Villa")).toBe(true);
    expect(searchCatalog(all, { ...query, text: "zzzz" })).toEqual([]);
  });

  it("sorts alphabetically", () => {
    const names = searchCatalog(all, { ...query, sort: "name" }).map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("finds entries by id", () => {
    expect(getCatalogDesign(all[300].id)).toBe(all[300]);
    expect(getCatalogDesign("aurora-villa")?.image).toContain("aurora-villa");
  });

  it("keeps the gallery state through a save", () => {
    const doc = normalizeDocument({ gallery: { selectedId: "x", favorites: ["a"], recent: ["b"] } });
    expect(doc.gallery).toEqual({ selectedId: "x", favorites: ["a"], recent: ["b"] });
    expect(normalizeDocument({}).gallery.selectedId).toBeNull();
  });
});
