import type { RailingStyle } from "../terrace-catalog";

/** A customized house: everything that changes how the 3D model looks, and nothing that changes the floor plan. */

export type ArchCategory = "modern" | "minimalist" | "contemporary" | "luxury" | "traditional" | "mediterranean";

export const ARCH_CATEGORIES: { id: ArchCategory; label: string; blurb: string }[] = [
  { id: "modern", label: "Modern", blurb: "Flat planes, large glass and crisp fascia lines" },
  { id: "minimalist", label: "Minimalist", blurb: "Monolithic volumes with almost no visible detail" },
  { id: "contemporary", label: "Contemporary", blurb: "Timber screens, stone and balanced asymmetry" },
  { id: "luxury", label: "Luxury", blurb: "Stone, columns, a grand portico and symmetry" },
  { id: "traditional", label: "Traditional", blurb: "Pitched roofs, brick and framed windows" },
  { id: "mediterranean", label: "Mediterranean", blurb: "Warm stucco, clay roofs and arched openings" },
];

/** A material from the library plus the tint it is painted with. */
export type Finish = { materialId: string; color: string };

export type RoofType = "flat" | "cantilever" | "gable" | "hip" | "shed" | "mansard";
export type WindowShape = "rectangular" | "arched" | "segmental" | "round" | "gothic";
export type WindowGrid = "none" | "vertical" | "cross" | "colonial";
export type WindowTrim = "none" | "surround" | "shutters" | "hood";
export type WindowProportion = "standard" | "tall" | "full";
export type DoorDesign = "flush" | "panelled" | "glazed" | "double" | "slatted" | "arched";
export type AccentPlacement = "none" | "entry" | "left" | "right" | "upper" | "lower" | "front";
export type PorticoStyle = "none" | "canopy" | "columns" | "arch";
export type CeilingStyle = "flat" | "tray" | "beams" | "coffered" | "cove";
export type PathStyle = "none" | "straight" | "stepping";
export type LightingStyle = "none" | "bollards" | "sconces" | "uplights" | "all";
export type Surroundings = "studio" | "suburban" | "urban" | "woodland" | "waterfront";
export type LightingPreview = "day" | "golden" | "night";

export type HouseDesign = {
  schema: 1;
  category: ArchCategory;
  exterior: {
    wall: Finish;
    accent: Finish;
    base: Finish;
    trim: Finish;
    accentPlacement: AccentPlacement;
    /** Share of the street facade covered by the accent, 0.1–1. */
    accentCoverage: number;
    details: {
      plinth: boolean;
      cornice: boolean;
      stringCourse: boolean;
      quoins: boolean;
      pilasters: boolean;
      fins: boolean;
      corbels: boolean;
      portico: PorticoStyle;
    };
    roof: {
      type: RoofType;
      /** Degrees; only sloped roofs use it. */
      pitch: number;
      /** Feet past the wall line. */
      overhang: number;
      parapet: boolean;
      finish: Finish;
      fascia: Finish;
      soffit: Finish;
    };
    window: {
      shape: WindowShape;
      grid: WindowGrid;
      trim: WindowTrim;
      frame: Finish;
      glass: Finish;
      proportion: WindowProportion;
      /** Add windows to blank exterior walls in the model. The 2D plan is not changed. */
      fillBlankWalls: boolean;
    };
    door: { design: DoorDesign; finish: Finish; hardware: string };
    balcony: {
      /** Add cantilevered balconies to upper street-facing windows. */
      projected: boolean;
      depth: number;
      style: RailingStyle;
      height: number;
      rail: Finish;
      slab: Finish;
    };
  };
  interior: {
    wall: Finish;
    /** Null keeps the room-type defaults (timber in living rooms, tile in bathrooms and so on). */
    floor: Finish | null;
    ceiling: Finish;
    ceilingStyle: CeilingStyle;
    door: { design: DoorDesign; finish: Finish };
    rooms: Record<string, RoomFinishes>;
  };
  environment: {
    surroundings: Surroundings;
    ground: Finish;
    lawn: boolean;
    trees: number;
    shrubs: number;
    hedges: boolean;
    flowers: boolean;
    foliage: string;
    flowerColor: string;
    path: { style: PathStyle; width: number; finish: Finish };
    driveway: Finish;
    boundary: Finish;
    lighting: { style: LightingStyle; color: string; intensity: number };
  };
};

export type RoomFinishes = { wall?: Finish; floor?: Finish; ceiling?: Finish; ceilingStyle?: CeilingStyle };

export const DEFAULT_DESIGN: HouseDesign = {
  schema: 1,
  category: "modern",
  exterior: {
    wall: { materialId: "paint_matte", color: "#F3F0E8" },
    accent: { materialId: "wood_teak", color: "#A9764A" },
    base: { materialId: "concrete_smooth", color: "#6F6C68" },
    trim: { materialId: "paint_satin", color: "#2B2C33" },
    accentPlacement: "entry",
    accentCoverage: 0.3,
    details: { plinth: true, cornice: false, stringCourse: false, quoins: false, pilasters: false, fins: false, corbels: false, portico: "canopy" },
    roof: {
      type: "flat",
      pitch: 28,
      overhang: 1.5,
      parapet: false,
      finish: { materialId: "roof_membrane", color: "#8C8A86" },
      fascia: { materialId: "paint_satin", color: "#2B2C33" },
      soffit: { materialId: "paint_matte", color: "#EDE9E0" },
    },
    window: {
      shape: "rectangular",
      grid: "vertical",
      trim: "none",
      frame: { materialId: "metal_powder", color: "#23252B" },
      glass: { materialId: "glass_clear", color: "#BFD9E8" },
      proportion: "tall",
      fillBlankWalls: true,
    },
    door: { design: "flush", finish: { materialId: "wood_walnut", color: "#5B3A26" }, hardware: "#1E2024" },
    balcony: {
      projected: true,
      depth: 3.5,
      style: "glass",
      height: 3.5,
      rail: { materialId: "metal_brushed", color: "#C9CDD3" },
      slab: { materialId: "paint_matte", color: "#F3F0E8" },
    },
  },
  interior: {
    wall: { materialId: "paint_matte", color: "#F5F2EC" },
    floor: null,
    ceiling: { materialId: "paint_matte", color: "#FBFAF6" },
    ceilingStyle: "flat",
    door: { design: "panelled", finish: { materialId: "wood_oak", color: "#B58F63" } },
    rooms: {},
  },
  environment: {
    surroundings: "suburban",
    ground: { materialId: "ground_grass", color: "#6E9A55" },
    lawn: true,
    trees: 4,
    shrubs: 0.5,
    hedges: false,
    flowers: false,
    foliage: "#4D7A3F",
    flowerColor: "#D98BA5",
    path: { style: "straight", width: 4, finish: { materialId: "ground_pavers", color: "#BDB5A8" } },
    driveway: { materialId: "ground_pavers", color: "#8F8A82" },
    boundary: { materialId: "paint_matte", color: "#E4DFD4" },
    lighting: { style: "bollards", color: "#FFD9A0", intensity: 1 },
  },
};

export function cloneDesign(design: HouseDesign): HouseDesign {
  return JSON.parse(JSON.stringify(design)) as HouseDesign;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeInto<T>(base: T, saved: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(saved)) return (saved === undefined ? base : (saved as T));
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(saved)) {
    const baseValue = (base as Record<string, unknown>)[key];
    out[key] = baseValue === undefined || baseValue === null ? saved[key] : mergeInto(baseValue, saved[key]);
  }
  return out as T;
}

/** Fills anything a saved design lacks (it may come from an older version) from the defaults. */
export function normalizeDesign(saved: unknown): HouseDesign {
  return mergeInto(cloneDesign(DEFAULT_DESIGN), saved);
}

// ── Stored document ──────────────────────────────────────────────────────────

export type ReferenceImage = {
  kind: "upload" | "gallery";
  name: string;
  /** A downscaled copy of the upload, or the gallery image's public path. */
  src: string;
  width: number;
  height: number;
  galleryId?: string;
};

export type AttributeReading = {
  id: string;
  label: string;
  value: string;
  /** 0–1. Below 0.5 the studio asks the user to check it. */
  confidence: number;
  /** Which inspector section corrects this reading. */
  section: DesignSection;
  swatch?: string;
};

export type ReadingSummary = {
  attributes: AttributeReading[];
  palette: { hex: string; share: number }[];
  notes: string[];
  deepRead: boolean;
};

export type DesignVariation = {
  id: string;
  name: string;
  updatedAt: string;
  thumbnail: string | null;
  design: HouseDesign;
  reference: ReferenceImage | null;
  reading: ReadingSummary | null;
};

export type HouseDesignDocument = {
  version: 1;
  /** Null until a design has been generated or applied; the model then shows the plain 3D house. */
  design: HouseDesign | null;
  /** The result of the last generation, so Reset can return to it. */
  generated: HouseDesign | null;
  reference: ReferenceImage | null;
  reading: ReadingSummary | null;
  variations: DesignVariation[];
  activeVariationId: string | null;
};

export const EMPTY_DOCUMENT: HouseDesignDocument = {
  version: 1,
  design: null,
  generated: null,
  reference: null,
  reading: null,
  variations: [],
  activeVariationId: null,
};

export const MAX_VARIATIONS = 12;

export function normalizeDocument(saved: unknown): HouseDesignDocument {
  if (!isPlainObject(saved)) return { ...EMPTY_DOCUMENT };
  const doc = saved as Partial<HouseDesignDocument>;
  return {
    version: 1,
    design: doc.design ? normalizeDesign(doc.design) : null,
    generated: doc.generated ? normalizeDesign(doc.generated) : null,
    reference: doc.reference ?? null,
    reading: doc.reading ?? null,
    variations: (doc.variations ?? []).map((v) => ({ ...v, design: normalizeDesign(v.design) })),
    activeVariationId: doc.activeVariationId ?? null,
  };
}

export type DesignSection =
  | "reference"
  | "walls"
  | "roof"
  | "windows"
  | "doors"
  | "balcony"
  | "facade"
  | "interior"
  | "environment"
  | "materials"
  | "variations"
  | "export";

/** The studio's internal default view of the plain model, used for "Before" and for a first manual edit. */
export function designOrDefault(design: HouseDesign | null): HouseDesign {
  return design ?? cloneDesign(DEFAULT_DESIGN);
}

/** Sets a value at a dotted path, copying only the objects along the way so old history entries stay intact. */
export function setAt<T extends object>(target: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const root: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  let cursor = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cursor[keys[i]];
    const copy = { ...(isPlainObject(next) ? next : {}) };
    cursor[keys[i]] = copy;
    cursor = copy;
  }
  cursor[keys[keys.length - 1]] = value;
  return root as T;
}

export function getAt<V = unknown>(target: object, path: string): V {
  return path.split(".").reduce<unknown>((value, key) => (isPlainObject(value) ? value[key] : undefined), target) as V;
}
