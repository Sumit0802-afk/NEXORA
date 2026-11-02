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
/** A side of the house as seen from the street. */
export type Elevation = "front" | "rear" | "left" | "right";

export const ELEVATIONS: Elevation[] = ["front", "rear", "left", "right"];
export const ELEVATION_LABEL: Record<Elevation, string> = { front: "Front", rear: "Rear", left: "Left side", right: "Right side" };

/** What one object changes from the design it belongs to. Anything left out follows the design. */
export type ObjectOverride = {
  /** Finish by part, since a wall has its outer face, cladding and room linings. */
  finishes?: Record<string, Finish>;
  /** Takes out something the model added. Elements of the 2D plan cannot be hidden here. */
  hidden?: boolean;
  window?: { shape?: WindowShape; grid?: WindowGrid; trim?: WindowTrim };
  door?: { design?: DoorDesign };
  balcony?: { style?: RailingStyle; depth?: number; height?: number };
  roof?: { type?: RoofType; pitch?: number; overhang?: number };
  /** Whether a reference view or the user set this. */
  source?: "reference" | "user";
};

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
      /** Add cantilevered balconies to upper windows on the chosen sides. */
      projected: boolean;
      elevations: Elevation[];
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
  /** Per-object edits by semantic id, kept apart from the design's general settings. */
  overrides: Record<string, ObjectOverride>;
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
      elevations: ["front"],
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
  overrides: {},
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
  id: string;
  kind: "upload" | "gallery";
  name: string;
  /** A downscaled copy of the upload, or the gallery image's public path. */
  src: string;
  width: number;
  height: number;
  galleryId?: string;
};

/** One view of the reference house. Images live in the document's pool, so variations share them. */
export type ReferenceSlot = { elevation: Elevation; imageId: string };

/** How a value was arrived at. Only measured and reviewed values carry a confidence. */
export type ParameterBasis = "measured" | "reviewed" | "style-default" | "preset" | "not-visible";

export type DesignParameter<T> = {
  value: T | null;
  /** 0–1, or null when nothing in the images supports a figure. */
  confidence: number | null;
  basis: ParameterBasis;
  /** The views that contributed. */
  views: Elevation[];
};

/** The structured reading of the reference images. */
export type DesignParameters = {
  schema: 1;
  views: Elevation[];
  style: DesignParameter<ArchCategory>;
  silhouette: DesignParameter<{ widthToHeight: number; roofShare: number }>;
  floors: DesignParameter<number>;
  roof: DesignParameter<{ type: RoofType; pitch: number; color: string }>;
  facade: DesignParameter<{ windowRows: number; windowCount: number; glassShare: number; symmetry: number }>;
  windows: DesignParameter<{ shape: WindowShape; grid: WindowGrid; frame: string; glass: string }>;
  doors: DesignParameter<{ design: DoorDesign; color: string | null }>;
  balconies: DesignParameter<{ style: RailingStyle; elevations: Elevation[] }>;
  materials: DesignParameter<{ wall: string; wallColor: string; accent: string | null; roof: string }>;
  palette: DesignParameter<{ hex: string; share: number }[]>;
  details: DesignParameter<string[]>;
};

export type AttributeReading = {
  id: string;
  label: string;
  value: string;
  /** 0–1. Below 0.5 the studio asks the user to check it. Null means there was nothing to measure. */
  confidence: number | null;
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
  references: ReferenceSlot[];
  reading: ReadingSummary | null;
  parameters: DesignParameters | null;
  /** The floor plan this variation was saved on. */
  planFingerprint: string | null;
};

/** A design that was replaced, kept so it can be restored. */
export type DesignRevision = { id: string; at: string; label: string; design: HouseDesign | null };

/** The base model when the design was generated. The geometry itself is rebuilt from the plan on open. */
export type BaseRecord = {
  planFingerprint: string;
  generatedAt: string;
  /** The reference images this design was generated from. */
  sources: string[];
  rooms: { id: string; level: number; width: number; depth: number }[];
  objects: { id: string; kind: string; elevation: Elevation | null }[];
};

/** The user's place in the design gallery. */
export type GalleryState = { selectedId: string | null; favorites: string[]; recent: string[] };

export type HouseDesignDocument = {
  version: 2;
  gallery: GalleryState;
  /** Null until a design has been generated or applied; the model then shows the plain 3D house. */
  design: HouseDesign | null;
  /** The result of the last generation, so Reset can return to it. */
  generated: HouseDesign | null;
  images: Record<string, ReferenceImage>;
  references: ReferenceSlot[];
  reading: ReadingSummary | null;
  parameters: DesignParameters | null;
  base: BaseRecord | null;
  variations: DesignVariation[];
  activeVariationId: string | null;
  revisions: DesignRevision[];
};

export const EMPTY_DOCUMENT: HouseDesignDocument = {
  version: 2,
  gallery: { selectedId: null, favorites: [], recent: [] },
  design: null,
  generated: null,
  images: {},
  references: [],
  reading: null,
  parameters: null,
  base: null,
  variations: [],
  activeVariationId: null,
  revisions: [],
};

export const MAX_VARIATIONS = 12;
export const MAX_REVISIONS = 10;

type LegacyReference = Omit<ReferenceImage, "id"> & { id?: string };
type LegacyVariation = Partial<DesignVariation> & { reference?: LegacyReference | null };

/** Version 1 kept one image on the document and a copy on every variation. */
function adoptLegacy(reference: LegacyReference | null | undefined, images: Record<string, ReferenceImage>): ReferenceSlot[] {
  if (!reference) return [];
  const known = Object.values(images).find((i) => i.src === reference.src);
  const id = known?.id ?? reference.id ?? `img-${Object.keys(images).length + 1}`;
  if (!known) images[id] = { ...reference, id };
  return [{ elevation: "front", imageId: id }];
}

export function normalizeDocument(saved: unknown): HouseDesignDocument {
  if (!isPlainObject(saved)) return { ...EMPTY_DOCUMENT };
  const doc = saved as Partial<Omit<HouseDesignDocument, "version" | "variations">> & { reference?: LegacyReference | null; variations?: LegacyVariation[] };
  const images: Record<string, ReferenceImage> = { ...doc.images };
  const references = doc.references ?? adoptLegacy(doc.reference, images);
  return {
    version: 2,
    gallery: { selectedId: doc.gallery?.selectedId ?? null, favorites: doc.gallery?.favorites ?? [], recent: doc.gallery?.recent ?? [] },
    design: doc.design ? normalizeDesign(doc.design) : null,
    generated: doc.generated ? normalizeDesign(doc.generated) : null,
    images,
    references,
    reading: doc.reading ?? null,
    parameters: doc.parameters ?? null,
    base: doc.base ?? null,
    variations: (doc.variations ?? []).map((v) => {
      const { reference, ...rest } = v;
      return {
        ...rest, design: normalizeDesign(v.design), references: v.references ?? adoptLegacy(reference, images),
        reading: v.reading ?? null, parameters: v.parameters ?? null, planFingerprint: v.planFingerprint ?? null,
      } as DesignVariation;
    }),
    activeVariationId: doc.activeVariationId ?? null,
    revisions: (doc.revisions ?? []).map((r) => ({ ...r, design: r.design ? normalizeDesign(r.design) : null })),
  };
}

/** Drops images no current view or variation uses, so a replaced photo does not stay in the saved document. */
export function pruneImages(doc: HouseDesignDocument): HouseDesignDocument {
  const used = new Set([...doc.references, ...doc.variations.flatMap((v) => v.references)].map((r) => r.imageId));
  const images = Object.fromEntries(Object.entries(doc.images).filter(([id]) => used.has(id)));
  return Object.keys(images).length === Object.keys(doc.images).length ? doc : { ...doc, images };
}

export type DesignSection =
  | "reference"
  | "objects"
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
