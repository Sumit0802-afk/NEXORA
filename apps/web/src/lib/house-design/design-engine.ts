import type { FloorPlan } from "@houseplan/design-schema";
import { baseGeometry, roomMeasures } from "./geometry-engine";
import { categoryLabel } from "./styles";
import type { FacadeAnalysis } from "./image-analysis";
import { designFromAnalysis, materialForTexture, type DeepReading } from "./interpret";
import { getMaterial } from "./materials";
import { buildDesignModel } from "./model";
import type { SceneObject } from "./objects";
import {
  ELEVATION_LABEL,
  cloneDesign,
  type ArchCategory,
  type BaseRecord,
  type DesignParameter,
  type DesignParameters,
  type Elevation,
  type HouseDesign,
  type ReadingSummary,
  type RoofType,
} from "./schema";

/**
 * Design engine: turns what was read from the reference views into a design for this plan. The main view sets the
 * design as a whole; every other view only changes the objects on its own side of the house, and adds its evidence
 * to the things all views can see, such as the roof.
 */

export type ViewReading = { elevation: Elevation; analysis: FacadeAnalysis; deep: DeepReading | null };

export type ComposeInput = {
  plan: FloorPlan;
  views: ViewReading[];
  /** A gallery design chosen as the main view. It is a complete specification, so it replaces the first reading. */
  preset?: { design: HouseDesign; views: Elevation[] } | null;
};

export type Composition = { design: HouseDesign; reading: ReadingSummary; parameters: DesignParameters };

/** Evidence from one photo is capped lower than perfect; agreement between views can raise it, but never to certainty. */
const CEILING = 0.85;
/** A view has to be at least this sure before it changes a side of the house. */
const SIDE_THRESHOLD = 0.45;

const SLOPED: ReadonlySet<RoofType> = new Set<RoofType>(["gable", "hip", "shed", "mansard"]);
const isSide = (e: Elevation) => e === "left" || e === "right";

function fuseRoof(views: ViewReading[], notes: string[]) {
  const usable = views.filter((v) => v.analysis.found);
  const votes = new Map<RoofType, number>();
  for (const { analysis, elevation } of usable) {
    const type = analysis.roof.value.type;
    // A slope seen edge-on from the side settles what a flat-looking eave line from the front cannot.
    const weight = isSide(elevation) && SLOPED.has(type) ? 1.3 : elevation === "front" ? 1.2 : 1;
    votes.set(type, (votes.get(type) ?? 0) + analysis.roof.confidence * weight);
  }
  const ranked = [...votes.entries()].sort((p, q) => q[1] - p[1]);
  if (!ranked.length) return null;
  const type = ranked[0][0];
  const agreeing = usable.filter((v) => v.analysis.roof.value.type === type);
  const best = agreeing.reduce((p, q) => (q.analysis.roof.confidence > p.analysis.roof.confidence ? q : p));
  let confidence = best.analysis.roof.confidence;
  if (usable.length > 1 && agreeing.length === usable.length) confidence = Math.min(CEILING, confidence + 0.05 * (usable.length - 1));
  if (agreeing.length < usable.length) {
    confidence *= 0.85;
    notes.push(`The views disagree on the roof. ${agreeing.map((v) => ELEVATION_LABEL[v.elevation]).join(" and ")} evidence was used, so check the roof.`);
  }
  const pitches = agreeing.map((v) => v.analysis.roof.value.pitch).sort((p, q) => p - q);
  return { ...best.analysis.roof.value, type, pitch: pitches[Math.floor(pitches.length / 2)], confidence, views: agreeing.map((v) => v.elevation) };
}

function fuseStyle(views: ViewReading[]) {
  const scores = new Map<ArchCategory, number>();
  for (const { analysis, elevation } of views.filter((v) => v.analysis.found)) {
    for (const [style, score] of Object.entries(analysis.style.scores) as [ArchCategory, number][]) {
      scores.set(style, (scores.get(style) ?? 0) + score * (elevation === "front" ? 1.5 : 1));
    }
  }
  const ranked = [...scores.entries()].sort((p, q) => q[1] - p[1]);
  return ranked[0]?.[0] ?? null;
}

/** Applies a non-main view to the walls, windows and balconies on its side of the house. */
function applySideView(design: HouseDesign, objects: SceneObject[], view: ViewReading, notes: string[]) {
  const { analysis, elevation } = view;
  const name = ELEVATION_LABEL[elevation].toLowerCase();
  if (!analysis.found) {
    notes.push(`No building was found in the ${name} view, so that side follows the main design.`);
    return;
  }
  const side = objects.filter((o) => o.elevation === elevation);
  const set = (id: string, change: (o: HouseDesign["overrides"][string]) => void) => {
    const entry = (design.overrides[id] ??= { source: "reference" });
    change(entry);
  };
  if (analysis.wall.confidence >= SIDE_THRESHOLD) {
    const finish = { materialId: materialForTexture(view.deep?.wallTexture ?? analysis.wall.value.texture, analysis.wall.value.hex), color: analysis.wall.value.hex };
    for (const wall of side.filter((o) => o.kind === "wall")) set(wall.id, (o) => { o.finishes = { ...o.finishes, walls: finish }; });
  }
  const win = analysis.windows;
  if (win.value.count > 0 && win.confidence >= SIDE_THRESHOLD) {
    for (const pane of side.filter((o) => o.kind === "window")) {
      set(pane.id, (o) => { o.window = { ...o.window, shape: view.deep?.windowShape ?? win.value.shape, grid: view.deep?.windowGrid ?? win.value.grid }; });
    }
  }
  const rail = view.deep?.balcony ?? analysis.balcony.value?.style ?? null;
  if (rail && rail !== "none") {
    const balcony = design.exterior.balcony;
    if (!balcony.projected) balcony.elevations = [];
    balcony.projected = true;
    if (!balcony.elevations.includes(elevation)) balcony.elevations = [...balcony.elevations, elevation];
  }
}

const measured = <T,>(value: T, confidence: number, views: Elevation[]): DesignParameter<T> => ({ value, confidence: Math.min(CEILING, confidence), basis: "measured", views });
const notVisible = <T,>(): DesignParameter<T> => ({ value: null, confidence: null, basis: "not-visible", views: [] });
const fromStyle = <T,>(value: T): DesignParameter<T> => ({ value, confidence: null, basis: "style-default", views: [] });

const DETAIL_NAME: Record<string, string> = { plinth: "Plinth", cornice: "Cornice", stringCourse: "String course", quoins: "Quoins", pilasters: "Pilasters", fins: "Timber fins", corbels: "Corbels" };

function detailList(design: HouseDesign): string[] {
  const { details } = design.exterior;
  const on = Object.entries(details).filter(([key, value]) => key !== "portico" && value).map(([key]) => DETAIL_NAME[key]);
  return details.portico === "none" ? on : [...on, `Portico (${details.portico})`];
}

/** The reading as structured data. Anything no view could show is marked so, never given a made-up figure. */
export function readingParameters(views: ViewReading[], design: HouseDesign, fusedRoof: ReturnType<typeof fuseRoof>): DesignParameters {
  const seen = views.filter((v) => v.analysis.found);
  const names = views.map((v) => v.elevation);
  const main = seen[0];
  const ext = design.exterior;
  const reviewed = <T,>(param: DesignParameter<T>, by: boolean): DesignParameter<T> => (by && param.basis === "measured" ? { ...param, basis: "reviewed" } : param);
  const anyDeep = views.some((v) => v.deep);
  if (!main) {
    return {
      schema: 1, views: names, style: fromStyle(design.category), silhouette: notVisible(), floors: notVisible(), roof: notVisible(), facade: notVisible(), windows: notVisible(),
      doors: notVisible(), balconies: notVisible(), materials: notVisible(), palette: notVisible(), details: fromStyle(detailList(design)),
    };
  }
  const a = main.analysis;
  const boxW = a.box.x1 - a.box.x0, boxH = a.box.y1 - a.box.y0;
  const withWindows = seen.filter((v) => v.analysis.windows.value.count > 0);
  const withDoor = seen.filter((v) => v.analysis.door.value);
  const withBalcony = seen.filter((v) => v.analysis.balcony.value);
  const floorView = seen.reduce((p, q) => (q.analysis.storeys.confidence > p.analysis.storeys.confidence ? q : p));
  const door = withDoor[0]?.analysis.door;
  return {
    schema: 1,
    views: names,
    style: reviewed(measured(design.category, a.style.confidence, seen.map((v) => v.elevation)), Boolean(main.deep?.style)),
    silhouette: measured({ widthToHeight: Math.round((boxW / Math.max(boxH, 0.01)) * (a.width / Math.max(a.height, 1)) * 100) / 100, roofShare: Math.round((fusedRoof?.overhangRatio ?? 0) * 100) / 100 }, 0.3 + boxW * boxH * 0.6, [main.elevation]),
    floors: measured(floorView.analysis.storeys.value, floorView.analysis.storeys.confidence, [floorView.elevation]),
    roof: fusedRoof ? reviewed(measured({ type: ext.roof.type, pitch: ext.roof.pitch, color: fusedRoof.hex }, fusedRoof.confidence, fusedRoof.views), Boolean(main.deep?.roof)) : notVisible(),
    facade: measured({ windowRows: a.storeys.value, windowCount: a.windows.value.count, glassShare: Math.round(a.windows.value.coverage * 100) / 100, symmetry: Math.round(a.symmetry * 100) / 100 }, a.windows.confidence, [main.elevation]),
    windows: withWindows.length
      ? reviewed(measured({ shape: ext.window.shape, grid: ext.window.grid, frame: withWindows[0].analysis.windows.value.frameHex, glass: withWindows[0].analysis.windows.value.glassHex }, withWindows[0].analysis.windows.confidence, withWindows.map((v) => v.elevation)), anyDeep)
      : notVisible(),
    doors: door?.value ? measured({ design: ext.door.design, color: door.value.glazed ? null : door.value.hex }, door.confidence, withDoor.map((v) => v.elevation)) : notVisible(),
    balconies: withBalcony.length ? measured({ style: ext.balcony.style, elevations: ext.balcony.elevations }, withBalcony[0].analysis.balcony.confidence, withBalcony.map((v) => v.elevation)) : notVisible(),
    materials: measured({ wall: getMaterial(ext.wall.materialId).name, wallColor: a.wall.value.hex, accent: a.accent.value ? getMaterial(ext.accent.materialId).name : null, roof: getMaterial(ext.roof.finish.materialId).name }, a.wall.confidence, [main.elevation]),
    palette: measured(a.palette.slice(0, 6), 0.7, [main.elevation]),
    details: fromStyle(detailList(design)),
  };
}

function presetParameters(design: HouseDesign, views: Elevation[]): DesignParameters {
  const ext = design.exterior;
  const preset = <T,>(value: T): DesignParameter<T> => ({ value, confidence: null, basis: "preset", views });
  return {
    schema: 1, views,
    style: preset(design.category),
    silhouette: notVisible(), floors: notVisible(),
    roof: preset({ type: ext.roof.type, pitch: ext.roof.pitch, color: ext.roof.finish.color }),
    facade: notVisible(),
    windows: preset({ shape: ext.window.shape, grid: ext.window.grid, frame: ext.window.frame.color, glass: ext.window.glass.color }),
    doors: preset({ design: ext.door.design, color: ext.door.finish.color }),
    balconies: ext.balcony.projected ? preset({ style: ext.balcony.style, elevations: ext.balcony.elevations }) : notVisible(),
    materials: preset({ wall: getMaterial(ext.wall.materialId).name, wallColor: ext.wall.color, accent: getMaterial(ext.accent.materialId).name, roof: getMaterial(ext.roof.finish.materialId).name }),
    palette: notVisible(),
    details: preset(detailList(design)),
  };
}

/** Puts the views in order of how much of the house they should decide: the street front first. */
function ordered(views: ViewReading[]): ViewReading[] {
  const rank: Record<Elevation, number> = { front: 0, rear: 1, left: 2, right: 3 };
  return [...views].sort((p, q) => rank[p.elevation] - rank[q.elevation]);
}

export function composeDesign({ plan, views, preset }: ComposeInput): Composition {
  const sorted = ordered(views);
  const notes: string[] = [];
  let design: HouseDesign, reading: ReadingSummary, parameters: DesignParameters;
  let sideViews: ViewReading[];

  if (preset) {
    design = cloneDesign(preset.design);
    reading = {
      attributes: [{ id: "style", label: "Architectural style", value: categoryLabel(design.category), confidence: null, section: "facade" }],
      palette: [], notes: [], deepRead: false,
    };
    parameters = presetParameters(design, preset.views);
    sideViews = sorted;
  } else {
    const main = sorted.find((v) => v.analysis.found) ?? sorted[0];
    const fused = fuseRoof(sorted, notes);
    const analysis: FacadeAnalysis = {
      ...main.analysis,
      style: { ...main.analysis.style, value: fuseStyle(sorted) ?? main.analysis.style.value },
      roof: fused ? { value: { type: fused.type, pitch: fused.pitch, hex: fused.hex, overhangRatio: fused.overhangRatio }, confidence: fused.confidence } : main.analysis.roof,
    };
    ({ design, reading } = designFromAnalysis(analysis, { levels: plan.levels.length, deep: main.deep }));
    sideViews = sorted.filter((v) => v !== main);
    if (main.elevation !== "front") notes.push(`There is no front view, so the ${ELEVATION_LABEL[main.elevation].toLowerCase()} view set the whole house.`);
    parameters = readingParameters(sorted, design, fused);
  }

  if (sideViews.length) {
    const base = baseGeometry(plan, design);
    const { objects } = buildDesignModel(base.geometry, base.renderPlan, design);
    for (const view of sideViews) applySideView(design, objects, view, notes);
    if (!preset) parameters = { ...parameters, balconies: parameters.balconies.value ? { ...parameters.balconies, value: { ...parameters.balconies.value, elevations: design.exterior.balcony.elevations } } : parameters.balconies };
    else parameters.views = [...new Set([...parameters.views, ...sideViews.map((v) => v.elevation)])];
  }
  return { design, reading: { ...reading, notes: [...new Set([...reading.notes, ...notes])] }, parameters };
}

/** A record of the model a design produced, kept with the project so later changes to the plan can be noticed. */
export function baseRecord(plan: FloorPlan, design: HouseDesign, sources: string[]): BaseRecord {
  const base = baseGeometry(plan, design);
  const { objects } = buildDesignModel(base.geometry, base.renderPlan, design);
  return {
    planFingerprint: base.fingerprint, generatedAt: new Date().toISOString(), sources: [...sources].sort(),
    rooms: roomMeasures(base.geometry), objects: objects.map(({ id, kind, elevation }) => ({ id, kind, elevation })),
  };
}

export type MatchRow = { id: string; label: string; reference: string; model: string; agrees: boolean };

function colourDistance(a: string, b: string): number {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.hypot(channel(a, 0) - channel(b, 0), channel(a, 1) - channel(b, 1), channel(a, 2) - channel(b, 2));
}

/**
 * Compares the reference reading with the same reading taken from a render of the model. Only measured values are
 * compared, so the result says what the two images share, not how close the model is to the real house.
 */
export function matchReport(parameters: DesignParameters, render: FacadeAnalysis): MatchRow[] {
  const rows: MatchRow[] = [];
  const roof = parameters.roof.value;
  if (roof && parameters.roof.basis !== "preset") {
    rows.push({ id: "roof", label: "Roof form", reference: roof.type, model: render.roof.value.type, agrees: roof.type === render.roof.value.type });
  }
  const windows = parameters.windows.basis === "preset" ? null : parameters.windows.value;
  if (windows) rows.push({ id: "windows", label: "Window shape", reference: windows.shape, model: render.windows.value.shape, agrees: windows.shape === render.windows.value.shape });
  const floors = parameters.floors.value;
  if (floors !== null) rows.push({ id: "floors", label: "Floors", reference: String(floors), model: String(render.storeys.value), agrees: floors === render.storeys.value });
  const wall = parameters.materials.basis === "measured" ? parameters.materials.value?.wallColor : null;
  if (wall) rows.push({ id: "wall", label: "Wall colour", reference: wall, model: render.wall.value.hex, agrees: colourDistance(wall, render.wall.value.hex) < 40 });
  return rows;
}
