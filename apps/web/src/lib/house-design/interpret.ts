import type { RailingStyle } from "../terrace-catalog";
import { RAILING_STYLES } from "../terrace-catalog";
import type { FacadeAnalysis, WallTexture } from "./image-analysis";
import { getMaterial } from "./materials";
import { categoryLabel, designForCategory } from "./styles";
import type {
  ArchCategory,
  AttributeReading,
  DoorDesign,
  Finish,
  HouseDesign,
  PorticoStyle,
  ReadingSummary,
  RoofType,
  WindowGrid,
  WindowShape,
  WindowTrim,
} from "./schema";

/** Optional second opinion on the things pixels alone read poorly. Colours always come from the photo itself. */
export type DeepReading = {
  style?: ArchCategory;
  roof?: RoofType;
  pitch?: number;
  windowShape?: WindowShape;
  windowGrid?: WindowGrid;
  windowTrim?: WindowTrim;
  doorDesign?: DoorDesign;
  balcony?: RailingStyle | "none";
  wallTexture?: WallTexture;
  accentTexture?: WallTexture | "none";
  portico?: PorticoStyle;
  notes?: string[];
};

function hue(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

const isWarmEarth = (hex: string) => {
  const { h, s } = hue(hex);
  return h < 42 && s > 0.2;
};
const isRedClay = (hex: string) => {
  const { h, s, l } = hue(hex);
  return (h < 26 || h > 345) && s > 0.28 && l > 0.2 && l < 0.65;
};
const isDark = (hex: string) => hue(hex).l < 0.28;

/** Picks the library material that matches what was read from the wall. */
export function materialForTexture(texture: WallTexture, hex: string): string {
  const { l } = hue(hex);
  switch (texture) {
    case "brick":
      if (l > 0.72) return "brick_white";
      if (l < 0.25) return "brick_charcoal";
      return isRedClay(hex) ? "brick_red" : "brick_clay";
    case "siding":
      return "wood_cedar";
    case "timber":
      return l < 0.2 ? "wood_charred" : l < 0.35 ? "wood_walnut" : l > 0.55 ? "wood_oak" : "wood_teak";
    case "stone":
      return l < 0.4 ? "stone_slate" : l > 0.72 ? "stone_limestone" : isWarmEarth(hex) ? "stone_sandstone" : "stone_field";
    case "concrete":
      return l > 0.7 ? "concrete_micro" : "concrete_panel";
    case "stucco":
      return "paint_stucco";
    default:
      return "paint_matte";
  }
}

function roofFinish(type: RoofType, hex: string): Finish {
  if (type === "flat" || type === "cantilever") return { materialId: "roof_membrane", color: hex };
  if (isRedClay(hex) || (isWarmEarth(hex) && !isDark(hex))) return { materialId: "roof_clay", color: hex };
  if (type === "shed") return { materialId: "roof_seam", color: hex };
  return { materialId: hue(hex).l < 0.3 ? "roof_slate" : "roof_shingle", color: hex };
}

function frameFinish(hex: string): Finish {
  const { l } = hue(hex);
  if (l > 0.7) return { materialId: "paint_satin", color: hex };
  return { materialId: isWarmEarth(hex) && l > 0.16 ? "wood_walnut" : "metal_powder", color: hex };
}

function glassFinish(hex: string, glowing: boolean): Finish {
  if (glowing) return { materialId: "glass_clear", color: "#BFD9E8" };
  const { h, s, l } = hue(hex);
  if (h > 170 && h < 250 && s > 0.14) return { materialId: "glass_blue", color: hex };
  if (h < 45 && s > 0.14) return { materialId: "glass_bronze", color: hex };
  return l < 0.3 ? { materialId: "glass_grey", color: hex } : { materialId: "glass_clear", color: hex };
}

const TEXTURE_NAME: Record<WallTexture, string> = {
  smooth: "Smooth paint", concrete: "Concrete", stucco: "Textured stucco", brick: "Brick", siding: "Horizontal siding", timber: "Timber boards", stone: "Natural stone",
};
const ROOF_NAME: Record<RoofType, string> = {
  flat: "Flat roof", cantilever: "Flat roof with deep overhang", gable: "Gable roof", hip: "Hip roof", shed: "Mono-pitch roof", mansard: "Mansard roof",
};
const SHAPE_NAME: Record<WindowShape, string> = {
  rectangular: "Rectangular", arched: "Arched", segmental: "Segmental arch", round: "Round", gothic: "Pointed arch",
};

export function railingName(style: RailingStyle): string {
  return RAILING_STYLES.find((r) => r.id === style)?.name ?? style;
}

/**
 * Builds the design from a reading: the detected style sets the built form, then every measured attribute that is
 * confident enough replaces the style's default. What stays a default shows up in the reading with a low confidence.
 */
export function designFromAnalysis(
  analysis: FacadeAnalysis,
  options: { levels: number; deep?: DeepReading | null }
): { design: HouseDesign; reading: ReadingSummary } {
  const deep = options.deep ?? null;
  const category = deep?.style ?? analysis.style.value;
  const design = designForCategory(category);
  const ext = design.exterior;
  const attributes: AttributeReading[] = [];
  const notes = [...analysis.warnings, ...(deep?.notes ?? [])];

  attributes.push({
    id: "style", label: "Architectural style", value: categoryLabel(category),
    confidence: deep?.style ? Math.max(analysis.style.confidence, 0.8) : analysis.style.confidence, section: "facade",
  });

  // Walls
  const wallTexture = deep?.wallTexture ?? analysis.wall.value.texture;
  const wallHex = analysis.wall.value.hex;
  if (analysis.found) ext.wall = { materialId: materialForTexture(wallTexture, wallHex), color: wallHex };
  attributes.push({
    id: "wall", label: "Wall finish", value: `${TEXTURE_NAME[wallTexture]}`, confidence: analysis.wall.confidence, section: "walls", swatch: analysis.found ? wallHex : undefined,
  });

  // Accent
  const accentTexture = deep?.accentTexture === "none" ? null : deep?.accentTexture ?? analysis.accent.value?.texture ?? null;
  if (analysis.accent.value && accentTexture) {
    ext.accent = { materialId: materialForTexture(accentTexture, analysis.accent.value.hex), color: analysis.accent.value.hex };
    if (ext.accentPlacement === "none") ext.accentPlacement = "entry";
    if (accentTexture === "timber") ext.details.fins = category === "contemporary" || category === "modern";
    attributes.push({
      id: "accent", label: "Accent material", value: TEXTURE_NAME[accentTexture], confidence: analysis.accent.confidence, section: "walls", swatch: analysis.accent.value.hex,
    });
  } else {
    if (analysis.found) ext.accentPlacement = "none";
    attributes.push({ id: "accent", label: "Accent material", value: "None seen", confidence: analysis.accent.confidence, section: "walls" });
  }

  // Roof
  const roofType = deep?.roof ?? (analysis.roof.confidence >= 0.4 ? analysis.roof.value.type : ext.roof.type);
  ext.roof.type = roofType;
  ext.roof.pitch = deep?.pitch ?? (roofType === "flat" || roofType === "cantilever" ? ext.roof.pitch : analysis.roof.value.pitch);
  if (analysis.found) ext.roof.finish = roofFinish(roofType, analysis.roof.value.hex);
  if (roofType === "flat" || roofType === "cantilever") {
    ext.roof.overhang = roofType === "cantilever" ? Math.max(2, Math.min(5, 2 + analysis.roof.value.overhangRatio * 16)) : ext.roof.overhang;
    if (analysis.found) ext.roof.fascia = { materialId: ext.wall.materialId.startsWith("paint") ? "paint_matte" : ext.roof.fascia.materialId, color: wallHex };
  } else {
    ext.roof.overhang = Math.max(0.8, Math.min(4, 1 + analysis.roof.value.overhangRatio * 14));
  }
  attributes.push({
    id: "roof", label: "Roof", value: ROOF_NAME[roofType], confidence: deep?.roof ? Math.max(analysis.roof.confidence, 0.8) : analysis.roof.confidence, section: "roof", swatch: analysis.found ? analysis.roof.value.hex : undefined,
  });

  // Windows
  const win = analysis.windows.value;
  const shape = deep?.windowShape ?? (analysis.windows.confidence >= 0.4 ? win.shape : ext.window.shape);
  ext.window.shape = shape;
  ext.window.grid = deep?.windowGrid ?? (analysis.windows.confidence >= 0.45 ? win.grid : ext.window.grid);
  if (deep?.windowTrim) ext.window.trim = deep.windowTrim;
  if (analysis.windows.value.count > 0) {
    ext.window.proportion = win.coverage > 0.3 ? "full" : win.coverage > 0.14 ? "tall" : "standard";
    ext.window.frame = frameFinish(win.frameHex);
    ext.window.glass = glassFinish(win.glassHex, win.glowing);
  }
  attributes.push({
    id: "windows", label: "Windows",
    value: win.count > 0 ? `${SHAPE_NAME[shape]}, ${Math.round(win.coverage * 100)}% glass` : SHAPE_NAME[shape],
    confidence: analysis.windows.confidence, section: "windows", swatch: win.count > 0 ? win.frameHex : undefined,
  });

  // Door
  const doorRead = analysis.door.value;
  if (doorRead) {
    const design_: DoorDesign = deep?.doorDesign ?? (doorRead.glazed ? "glazed" : ext.door.design);
    ext.door.design = shape === "arched" && !deep?.doorDesign ? "arched" : design_;
    if (!doorRead.glazed) ext.door.finish = { materialId: isWarmEarth(doorRead.hex) ? "wood_walnut" : "paint_satin", color: doorRead.hex };
  } else if (deep?.doorDesign) {
    ext.door.design = deep.doorDesign;
  }
  attributes.push({
    id: "door", label: "Front door", value: doorRead ? (doorRead.glazed ? "Glazed door" : "Solid door") : "Not visible", confidence: analysis.door.confidence, section: "doors", swatch: doorRead?.hex,
  });

  // Balcony
  const railStyle = deep?.balcony ?? analysis.balcony.value?.style ?? null;
  if (railStyle && railStyle !== "none") {
    ext.balcony.projected = true;
    ext.balcony.style = railStyle;
    if (analysis.balcony.value && railStyle !== "glass") ext.balcony.rail = { materialId: isDark(analysis.balcony.value.hex) ? "metal_powder" : "paint_satin", color: analysis.balcony.value.hex };
    if (analysis.found) ext.balcony.slab = { materialId: ext.wall.materialId, color: wallHex };
    attributes.push({
      id: "balcony", label: "Balcony", value: railingName(railStyle), confidence: deep?.balcony ? 0.8 : analysis.balcony.confidence, section: "balcony",
      swatch: analysis.balcony.value?.hex,
    });
  } else {
    ext.balcony.projected = false;
    attributes.push({ id: "balcony", label: "Balcony", value: "None seen", confidence: deep?.balcony === "none" ? 0.8 : analysis.balcony.confidence, section: "balcony" });
  }
  if (deep?.portico) ext.details.portico = deep.portico;

  // Trim and surroundings follow the photo's own colours.
  const dark = analysis.palette.filter((p) => isDark(p.hex)).sort((p, q) => q.share - p.share)[0];
  if (dark && ext.trim.materialId.startsWith("paint")) ext.trim = { materialId: "paint_satin", color: dark.hex };
  design.environment.trees = Math.round(analysis.landscape.trees * 8);
  design.environment.shrubs = Math.round(Math.min(1, 0.25 + analysis.landscape.lawn) * 100) / 100;
  design.environment.lawn = analysis.landscape.lawn > 0.1 || !analysis.found;

  if (analysis.storeys.confidence >= 0.5 && analysis.storeys.value !== options.levels) {
    notes.push(
      `The photo shows ${analysis.storeys.value} ${analysis.storeys.value === 1 ? "storey" : "storeys"}; your plan has ${options.levels}. Your floor plan was kept and only the appearance changed.`
    );
  }
  if (ext.roof.type !== analysis.roof.value.type && !deep?.roof) notes.push("The roof could not be read clearly, so the style's usual roof was used.");

  return {
    design,
    reading: { attributes, palette: analysis.palette.slice(0, 6), notes: [...new Set(notes)], deepRead: Boolean(deep) },
  };
}

/** Names of the materials on show, for the gallery and the reading card. */
export function materialSummary(design: HouseDesign): string[] {
  const names = [design.exterior.wall, design.exterior.accent, design.exterior.roof.finish, design.exterior.window.frame].map((f) => getMaterial(f.materialId).name);
  return [...new Set(names)];
}
