import { getMaterial } from "./materials";
import { ARCH_CATEGORIES, DEFAULT_DESIGN, cloneDesign, type ArchCategory, type Finish, type HouseDesign } from "./schema";

/** What a facade style means in built form. Choosing one sets these; each can then be changed on its own. */
type StyleKit = {
  details: HouseDesign["exterior"]["details"];
  accentPlacement: HouseDesign["exterior"]["accentPlacement"];
  accentCoverage: number;
  window: Pick<HouseDesign["exterior"]["window"], "shape" | "grid" | "trim" | "proportion">;
  door: HouseDesign["exterior"]["door"]["design"];
  roof: Pick<HouseDesign["exterior"]["roof"], "type" | "pitch" | "overhang" | "parapet">;
  rail: HouseDesign["exterior"]["balcony"]["style"];
};

export const STYLE_KITS: Record<ArchCategory, StyleKit> = {
  modern: {
    details: { plinth: true, cornice: false, stringCourse: false, quoins: false, pilasters: false, fins: false, corbels: false, portico: "canopy" },
    accentPlacement: "entry", accentCoverage: 0.32,
    window: { shape: "rectangular", grid: "vertical", trim: "none", proportion: "tall" },
    door: "flush",
    roof: { type: "cantilever", pitch: 12, overhang: 3, parapet: false },
    rail: "glass",
  },
  minimalist: {
    details: { plinth: false, cornice: false, stringCourse: false, quoins: false, pilasters: false, fins: false, corbels: false, portico: "none" },
    accentPlacement: "none", accentCoverage: 0.2,
    window: { shape: "rectangular", grid: "none", trim: "none", proportion: "tall" },
    door: "flush",
    roof: { type: "flat", pitch: 10, overhang: 0.2, parapet: true },
    rail: "glass",
  },
  contemporary: {
    details: { plinth: true, cornice: false, stringCourse: false, quoins: false, pilasters: false, fins: true, corbels: false, portico: "canopy" },
    accentPlacement: "left", accentCoverage: 0.42,
    window: { shape: "rectangular", grid: "vertical", trim: "none", proportion: "tall" },
    door: "slatted",
    roof: { type: "shed", pitch: 12, overhang: 2.5, parapet: false },
    rail: "metal_slats",
  },
  luxury: {
    details: { plinth: true, cornice: true, stringCourse: true, quoins: true, pilasters: false, fins: false, corbels: false, portico: "columns" },
    accentPlacement: "lower", accentCoverage: 0.5,
    window: { shape: "segmental", grid: "cross", trim: "surround", proportion: "tall" },
    door: "double",
    roof: { type: "hip", pitch: 30, overhang: 1.8, parapet: false },
    rail: "baluster",
  },
  traditional: {
    details: { plinth: true, cornice: true, stringCourse: false, quoins: false, pilasters: false, fins: false, corbels: false, portico: "columns" },
    accentPlacement: "none", accentCoverage: 0.3,
    window: { shape: "rectangular", grid: "colonial", trim: "shutters", proportion: "standard" },
    door: "panelled",
    roof: { type: "gable", pitch: 36, overhang: 1.5, parapet: false },
    rail: "baluster",
  },
  mediterranean: {
    details: { plinth: true, cornice: false, stringCourse: false, quoins: false, pilasters: false, fins: false, corbels: true, portico: "arch" },
    accentPlacement: "lower", accentCoverage: 0.2,
    window: { shape: "arched", grid: "cross", trim: "none", proportion: "tall" },
    door: "arched",
    roof: { type: "hip", pitch: 24, overhang: 2, parapet: false },
    rail: "metal_slats",
  },
};

/** Applies a style's built form and leaves colours and materials alone. */
export function applyFacadeStyle(design: HouseDesign, category: ArchCategory): HouseDesign {
  const kit = STYLE_KITS[category];
  const next = cloneDesign(design);
  next.category = category;
  next.exterior.details = { ...kit.details };
  next.exterior.accentPlacement = kit.accentPlacement;
  next.exterior.accentCoverage = kit.accentCoverage;
  next.exterior.window = { ...next.exterior.window, ...kit.window };
  next.exterior.door.design = kit.door;
  next.exterior.roof = { ...next.exterior.roof, ...kit.roof };
  next.exterior.balcony.style = kit.rail;
  return next;
}

/** The materials a style usually starts from, before a photo or a preset colours it. */
const STYLE_FINISHES: Record<ArchCategory, { wall: Finish; accent: Finish; base: Finish; trim: Finish; roof: Finish; fascia: Finish; frame: Finish; door: Finish }> = {
  modern: {
    wall: { materialId: "paint_matte", color: "#F3F0E8" }, accent: { materialId: "wood_teak", color: "#A9764A" },
    base: { materialId: "concrete_smooth", color: "#6F6C68" }, trim: { materialId: "paint_satin", color: "#2B2C33" },
    roof: { materialId: "roof_membrane", color: "#8C8A86" }, fascia: { materialId: "paint_matte", color: "#F3F0E8" },
    frame: { materialId: "metal_powder", color: "#23252B" }, door: { materialId: "wood_walnut", color: "#5B3A26" },
  },
  minimalist: {
    wall: { materialId: "concrete_micro", color: "#E9E6DF" }, accent: { materialId: "concrete_smooth", color: "#B9B6AF" },
    base: { materialId: "concrete_smooth", color: "#CFCAC0" }, trim: { materialId: "paint_matte", color: "#E9E6DF" },
    roof: { materialId: "roof_membrane", color: "#BDBAB3" }, fascia: { materialId: "concrete_micro", color: "#E9E6DF" },
    frame: { materialId: "metal_powder", color: "#2A2A2E" }, door: { materialId: "paint_satin", color: "#2A2A2E" },
  },
  contemporary: {
    wall: { materialId: "paint_plaster", color: "#E7E2D8" }, accent: { materialId: "wood_cedar", color: "#B07A4C" },
    base: { materialId: "stone_slate", color: "#5C5F63" }, trim: { materialId: "metal_powder", color: "#2B2C33" },
    roof: { materialId: "roof_seam", color: "#3B3F46" }, fascia: { materialId: "metal_powder", color: "#2B2C33" },
    frame: { materialId: "metal_powder", color: "#23252B" }, door: { materialId: "wood_cedar", color: "#8E5E38" },
  },
  luxury: {
    wall: { materialId: "stone_limestone", color: "#E6DDCB" }, accent: { materialId: "stone_sandstone", color: "#CDB991" },
    base: { materialId: "stone_granite", color: "#7D7B7A" }, trim: { materialId: "marble_carrara", color: "#F1EFEA" },
    roof: { materialId: "roof_slate", color: "#44474E" }, fascia: { materialId: "marble_carrara", color: "#F1EFEA" },
    frame: { materialId: "metal_bronze", color: "#4C3A2A" }, door: { materialId: "wood_walnut", color: "#4A2E1E" },
  },
  traditional: {
    wall: { materialId: "brick_red", color: "#A5503A" }, accent: { materialId: "paint_satin", color: "#EFE9DC" },
    base: { materialId: "stone_field", color: "#8D8275" }, trim: { materialId: "paint_satin", color: "#EFE9DC" },
    roof: { materialId: "roof_shingle", color: "#54514F" }, fascia: { materialId: "paint_satin", color: "#EFE9DC" },
    frame: { materialId: "paint_satin", color: "#EFE9DC" }, door: { materialId: "paint_gloss", color: "#27343F" },
  },
  mediterranean: {
    wall: { materialId: "paint_stucco", color: "#EAD9B8" }, accent: { materialId: "stone_sandstone", color: "#C9AF84" },
    base: { materialId: "stone_field", color: "#A08D73" }, trim: { materialId: "paint_stucco", color: "#F1E7D2" },
    roof: { materialId: "roof_clay", color: "#B4593A" }, fascia: { materialId: "wood_walnut", color: "#6A4630" },
    frame: { materialId: "wood_walnut", color: "#5A3B28" }, door: { materialId: "wood_walnut", color: "#5A3B28" },
  },
};

/** A complete starting design for a category. */
export function designForCategory(category: ArchCategory): HouseDesign {
  const finishes = STYLE_FINISHES[category];
  const next = applyFacadeStyle(cloneDesign(DEFAULT_DESIGN), category);
  next.exterior.wall = { ...finishes.wall };
  next.exterior.accent = { ...finishes.accent };
  next.exterior.base = { ...finishes.base };
  next.exterior.trim = { ...finishes.trim };
  next.exterior.roof.finish = { ...finishes.roof };
  next.exterior.roof.fascia = { ...finishes.fascia };
  next.exterior.roof.soffit = { materialId: "paint_matte", color: finishes.wall.color };
  next.exterior.window.frame = { ...finishes.frame };
  next.exterior.door.finish = { ...finishes.door };
  // Masonry and timber walls make poor slab edges, so those houses use their trim there and on balusters.
  const paintedWall = getMaterial(finishes.wall.materialId).pattern === "plain" || category === "mediterranean" || category === "minimalist";
  next.exterior.balcony.slab = { ...(paintedWall ? finishes.wall : finishes.trim) };
  if (STYLE_KITS[category].rail === "baluster") next.exterior.balcony.rail = { ...finishes.trim };
  else if (STYLE_KITS[category].rail === "metal_slats") next.exterior.balcony.rail = { materialId: "metal_powder", color: "#26282D" };
  return next;
}

export function categoryLabel(category: ArchCategory): string {
  return ARCH_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}
