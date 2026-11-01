import { getMaterial } from "./materials";
import { designForCategory } from "./styles";
import type { ArchCategory, HouseDesign } from "./schema";

/** Built-in designs. Each is a full design, so applying one restyles the current house and leaves the plan as it is. */

export type GalleryDesign = {
  id: string;
  name: string;
  category: ArchCategory;
  summary: string;
  image: string;
  design: HouseDesign;
};

function preset(id: string, name: string, category: ArchCategory, summary: string, tweak: (d: HouseDesign) => void): GalleryDesign {
  const design = designForCategory(category);
  tweak(design);
  return { id, name, category, summary, image: `/images/designs/${id}.jpg`, design };
}

export const GALLERY: GalleryDesign[] = [
  preset("aurora-villa", "Aurora Villa", "modern", "Deep white overhangs over teak screens and full-height glass.", (d) => {
    d.exterior.window.proportion = "full";
    d.exterior.accentCoverage = 0.4;
    d.exterior.details.fins = true;
    d.environment.trees = 5;
  }),
  preset("graphite-house", "Graphite House", "modern", "Charcoal brick volumes with slim bronze frames.", (d) => {
    d.exterior.wall = { materialId: "brick_charcoal", color: "#3C3B3E" };
    d.exterior.accent = { materialId: "wood_oak", color: "#B58F63" };
    d.exterior.roof.fascia = { materialId: "metal_powder", color: "#2B2C33" };
    d.exterior.window.frame = { materialId: "metal_bronze", color: "#6B5138" };
    d.exterior.balcony.slab = { materialId: "metal_powder", color: "#2B2C33" };
    d.environment.path.finish = { materialId: "stone_granite", color: "#8E8C8A" };
  }),
  preset("white-monolith", "White Monolith", "minimalist", "A single seamless volume with recessed glass.", (d) => {
    d.exterior.balcony.projected = false;
    d.environment.trees = 2;
    d.environment.shrubs = 0.2;
    d.environment.ground = { materialId: "ground_gravel", color: "#CFC9BD" };
  }),
  preset("concrete-pavilion", "Concrete Pavilion", "minimalist", "Board-formed concrete with a calm, low profile.", (d) => {
    d.exterior.wall = { materialId: "concrete_board", color: "#A3A19B" };
    d.exterior.roof.fascia = { materialId: "concrete_smooth", color: "#A8A5A0" };
    d.exterior.door.finish = { materialId: "metal_corten", color: "#8A4B2E" };
    d.environment.trees = 3;
  }),
  preset("timber-ridge", "Timber Ridge", "contemporary", "A rising mono-pitch roof over cedar and slate.", (d) => {
    d.exterior.accentCoverage = 0.46;
    d.environment.trees = 6;
    d.environment.surroundings = "woodland";
  }),
  preset("stone-courtyard", "Stone Courtyard", "contemporary", "Warm quartzite walls with a slatted timber entry.", (d) => {
    d.exterior.wall = { materialId: "stone_quartzite", color: "#B9AD9B" };
    d.exterior.accent = { materialId: "wood_teak", color: "#A9764A" };
    d.exterior.accentPlacement = "entry";
    d.exterior.roof.type = "cantilever";
    d.exterior.roof.overhang = 3;
    d.exterior.roof.finish = { materialId: "roof_membrane", color: "#7A7874" };
    d.exterior.roof.fascia = { materialId: "metal_powder", color: "#2B2C33" };
  }),
  preset("palais-limestone", "Palais Limestone", "luxury", "Dressed limestone, quoins and a columned entrance.", (d) => {
    d.environment.hedges = true;
    d.environment.flowers = true;
    d.environment.lighting = { style: "all", color: "#FFD9A0", intensity: 1 };
  }),
  preset("marble-estate", "Marble Estate", "luxury", "Carrara facades, a mansard roof and bronze glazing.", (d) => {
    d.exterior.wall = { materialId: "marble_carrara", color: "#F1EFEA" };
    d.exterior.accent = { materialId: "marble_emperador", color: "#7A5A44" };
    d.exterior.accentPlacement = "entry";
    d.exterior.roof.type = "mansard";
    d.exterior.trim = { materialId: "stone_limestone", color: "#E2DACA" };
    d.exterior.window.glass = { materialId: "glass_bronze", color: "#7B6248" };
    d.environment.hedges = true;
  }),
  preset("heritage-brick", "Heritage Brick", "traditional", "Red brick under a steep gable with shuttered windows.", (d) => {
    d.exterior.window.frame = { materialId: "paint_satin", color: "#EFE9DC" };
    d.environment.flowers = true;
    d.environment.trees = 5;
  }),
  preset("cedar-cottage", "Cedar Cottage", "traditional", "Lapped cedar siding with a timber-columned porch.", (d) => {
    d.exterior.wall = { materialId: "wood_cedar", color: "#C9B597" };
    d.exterior.trim = { materialId: "paint_satin", color: "#F4F0E6" };
    d.exterior.roof.finish = { materialId: "roof_slate", color: "#44474E" };
    d.exterior.door.finish = { materialId: "paint_gloss", color: "#6B2D2A" };
    d.environment.hedges = true;
  }),
  preset("casa-terracotta", "Casa Terracotta", "mediterranean", "Warm stucco, clay tile and arched openings.", (d) => {
    d.environment.trees = 4;
    d.environment.foliage = "#5D7A45";
    d.environment.path.finish = { materialId: "tile_terracotta", color: "#B9673F" };
  }),
  preset("villa-del-mar", "Villa del Mar", "mediterranean", "Whitewashed walls by the water under pale clay.", (d) => {
    d.exterior.wall = { materialId: "paint_limewash", color: "#F4EFE4" };
    d.exterior.roof.finish = { materialId: "roof_clay", color: "#C9805A" };
    d.exterior.window.frame = { materialId: "paint_gloss", color: "#2F5C7A" };
    d.exterior.door.finish = { materialId: "paint_gloss", color: "#2F5C7A" };
    d.environment.surroundings = "waterfront";
    d.environment.ground = { materialId: "ground_sand", color: "#DCC9A3" };
    d.environment.lawn = true;
  }),
];

export function galleryPalette(design: HouseDesign): string[] {
  const ext = design.exterior;
  return [...new Set([ext.wall.color, ext.accent.color, ext.roof.finish.color, ext.trim.color, ext.window.frame.color, ext.door.finish.color].map((c) => c.toUpperCase()))].slice(0, 5);
}

export function galleryMaterials(design: HouseDesign): string[] {
  const ext = design.exterior;
  return [...new Set([ext.wall, ext.accent, ext.roof.finish, ext.window.frame].map((f) => getMaterial(f.materialId).name))];
}

export function getGalleryDesign(id: string | undefined): GalleryDesign | undefined {
  return GALLERY.find((g) => g.id === id);
}
