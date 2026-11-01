/** The material library. A material is a pattern, a default tint and how it reflects light; `info` is shown to the user. */

export type MaterialCategory =
  | "wood"
  | "marble"
  | "concrete"
  | "stone"
  | "glass"
  | "brick"
  | "tile"
  | "paint"
  | "roofing"
  | "metal"
  | "ground";

export type TexturePattern =
  | "plain"
  | "plaster"
  | "stucco"
  | "concrete"
  | "concrete_panel"
  | "board_formed"
  | "planks_vertical"
  | "planks_horizontal"
  | "floorboards"
  | "marble"
  | "marble_dark"
  | "brick"
  | "ashlar"
  | "ledgestone"
  | "fieldstone"
  | "granite"
  | "tile_grid"
  | "mosaic"
  | "roof_tile"
  | "shingle"
  | "standing_seam"
  | "grass"
  | "gravel"
  | "pavers"
  | "cobble";

export type MaterialDef = {
  id: string;
  name: string;
  category: MaterialCategory;
  pattern: TexturePattern;
  color: string;
  roughness: number;
  metalness: number;
  /** Size of one texture tile in feet. */
  tile: number;
  opacity?: number;
  info: string;
};

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string }[] = [
  { id: "wood", label: "Wood" },
  { id: "marble", label: "Marble" },
  { id: "concrete", label: "Concrete" },
  { id: "stone", label: "Natural stone" },
  { id: "glass", label: "Glass" },
  { id: "brick", label: "Brick" },
  { id: "tile", label: "Ceramic tiles" },
  { id: "paint", label: "Paint finishes" },
  { id: "roofing", label: "Roofing" },
  { id: "metal", label: "Metal" },
  { id: "ground", label: "Ground" },
];

const m = (
  id: string,
  name: string,
  category: MaterialCategory,
  pattern: TexturePattern,
  color: string,
  roughness: number,
  metalness: number,
  tile: number,
  info: string,
  opacity?: number
): MaterialDef => ({ id, name, category, pattern, color, roughness, metalness, tile, info, opacity });

export const MATERIALS: MaterialDef[] = [
  m("wood_teak", "Teak cladding", "wood", "planks_vertical", "#A9764A", 0.55, 0, 4, "Oiled vertical teak boards"),
  m("wood_walnut", "Walnut", "wood", "planks_vertical", "#5B3A26", 0.5, 0, 4, "Dark walnut with a satin finish"),
  m("wood_oak", "Natural oak", "wood", "planks_vertical", "#B58F63", 0.6, 0, 4, "Pale European oak"),
  m("wood_cedar", "Cedar siding", "wood", "planks_horizontal", "#B07A4C", 0.68, 0, 4, "Horizontal lapped cedar"),
  m("wood_charred", "Charred timber", "wood", "planks_vertical", "#2D2A29", 0.72, 0, 4, "Shou sugi ban blackened boards"),
  m("wood_floor_oak", "Oak floorboards", "wood", "floorboards", "#C9A67C", 0.5, 0, 6, "Wide-plank oak flooring"),
  m("wood_floor_walnut", "Walnut floorboards", "wood", "floorboards", "#6E4A32", 0.46, 0, 6, "Rich walnut flooring"),
  m("wood_deck", "Teak decking", "wood", "floorboards", "#A98258", 0.7, 0, 5, "Grooved outdoor decking"),

  m("marble_carrara", "Carrara", "marble", "marble", "#F1EFEA", 0.2, 0.02, 7, "White Italian marble with grey veining"),
  m("marble_calacatta", "Calacatta gold", "marble", "marble", "#F6EEDF", 0.18, 0.02, 7, "Warm white with gold veining"),
  m("marble_emperador", "Emperador", "marble", "marble", "#7A5A44", 0.22, 0.02, 7, "Polished chocolate marble"),
  m("marble_nero", "Nero Marquina", "marble", "marble_dark", "#22222A", 0.16, 0.04, 7, "Black marble with white veins"),
  m("marble_travertine", "Travertine", "marble", "ashlar", "#D9CBB2", 0.42, 0.01, 6, "Honed travertine slabs"),

  m("concrete_smooth", "Polished concrete", "concrete", "concrete", "#A8A5A0", 0.5, 0.02, 8, "Smooth cast finish"),
  m("concrete_panel", "Precast panels", "concrete", "concrete_panel", "#B0ADA6", 0.6, 0.02, 10, "Large panels with tie holes"),
  m("concrete_board", "Board-formed", "concrete", "board_formed", "#9C9A95", 0.72, 0.01, 6, "Timber-imprinted concrete"),
  m("concrete_micro", "Microcement", "concrete", "plaster", "#CFCAC0", 0.46, 0.01, 8, "Seamless troweled coating"),

  m("stone_sandstone", "Sandstone ashlar", "stone", "ashlar", "#D3BE96", 0.78, 0, 6, "Dressed sandstone blocks"),
  m("stone_limestone", "Limestone", "stone", "ashlar", "#E2DACA", 0.7, 0, 6, "Pale cut limestone"),
  m("stone_slate", "Slate ledgestone", "stone", "ledgestone", "#5C5F63", 0.82, 0.01, 5, "Stacked split-face slate"),
  m("stone_quartzite", "Quartzite ledge", "stone", "ledgestone", "#B9AD9B", 0.76, 0.01, 5, "Warm stacked stone"),
  m("stone_field", "Fieldstone", "stone", "fieldstone", "#9A8E7E", 0.88, 0, 7, "Random rubble masonry"),
  m("stone_granite", "Flamed granite", "stone", "granite", "#7D7B7A", 0.62, 0.02, 5, "Speckled flamed granite"),

  m("glass_clear", "Clear glass", "glass", "plain", "#BFD9E8", 0.04, 0.1, 8, "Low-iron double glazing", 0.36),
  m("glass_grey", "Grey tinted", "glass", "plain", "#5F6B73", 0.05, 0.2, 8, "Solar-control grey glazing", 0.55),
  m("glass_bronze", "Bronze tinted", "glass", "plain", "#7B6248", 0.05, 0.2, 8, "Warm bronze solar glazing", 0.55),
  m("glass_blue", "Blue reflective", "glass", "plain", "#4F7FA3", 0.03, 0.4, 8, "Reflective coated glazing", 0.6),
  m("glass_frosted", "Frosted", "glass", "plain", "#E4ECEE", 0.5, 0, 8, "Acid-etched privacy glass", 0.7),

  m("brick_red", "Red brick", "brick", "brick", "#A5503A", 0.86, 0, 3, "Traditional fired clay"),
  m("brick_white", "Painted brick", "brick", "brick", "#ECE7DD", 0.74, 0, 3, "Limewashed brickwork"),
  m("brick_clay", "Exposed clay", "brick", "brick", "#BC7A52", 0.84, 0, 3, "Soft sand-faced clay brick"),
  m("brick_charcoal", "Charcoal brick", "brick", "brick", "#3C3B3E", 0.8, 0, 3, "Dark engineering brick"),

  m("tile_white", "White ceramic", "tile", "tile_grid", "#F1F0EC", 0.22, 0.02, 4, "Glazed 12 in square tile"),
  m("tile_porcelain", "Grey porcelain", "tile", "tile_grid", "#BDBBB6", 0.34, 0.02, 4, "Large-format matte porcelain"),
  m("tile_terracotta", "Terracotta", "tile", "tile_grid", "#B9673F", 0.7, 0, 4, "Handmade clay floor tile"),
  m("tile_mosaic", "Blue mosaic", "tile", "mosaic", "#4E86A6", 0.26, 0.02, 3, "Small glazed mosaic"),
  m("tile_zellige", "Zellige", "tile", "mosaic", "#E7DFCF", 0.24, 0.02, 3, "Handmade glazed tile"),

  m("paint_matte", "Matte paint", "paint", "plain", "#F3F0E8", 0.86, 0, 8, "Flat emulsion"),
  m("paint_satin", "Satin paint", "paint", "plain", "#2B2C33", 0.42, 0, 8, "Wipeable satin"),
  m("paint_gloss", "Gloss enamel", "paint", "plain", "#1F2430", 0.14, 0.02, 8, "High-gloss enamel"),
  m("paint_limewash", "Limewash", "paint", "plaster", "#EFE6D6", 0.9, 0, 9, "Soft mottled mineral paint"),
  m("paint_stucco", "Textured stucco", "paint", "stucco", "#E8D9BE", 0.92, 0, 5, "Hand-troweled exterior render"),
  m("paint_plaster", "Smooth plaster", "paint", "plaster", "#F0ECE3", 0.8, 0, 9, "Fine lime plaster"),

  m("roof_clay", "Clay barrel tile", "roofing", "roof_tile", "#B4593A", 0.74, 0, 5, "Traditional terracotta tile"),
  m("roof_concrete", "Concrete tile", "roofing", "roof_tile", "#6C6C70", 0.78, 0, 5, "Interlocking concrete tile"),
  m("roof_slate", "Natural slate", "roofing", "shingle", "#44474E", 0.66, 0.02, 4, "Split slate courses"),
  m("roof_shingle", "Asphalt shingle", "roofing", "shingle", "#54514F", 0.9, 0, 4, "Architectural shingle"),
  m("roof_seam", "Standing seam", "roofing", "standing_seam", "#3B3F46", 0.4, 0.6, 6, "Folded metal sheet roofing"),
  m("roof_membrane", "Flat membrane", "roofing", "concrete", "#8C8A86", 0.86, 0, 10, "Single-ply flat roof covering"),

  m("metal_powder", "Powder coat", "metal", "plain", "#23252B", 0.42, 0.55, 8, "Durable coated aluminium"),
  m("metal_brushed", "Brushed steel", "metal", "plain", "#C9CDD3", 0.3, 0.9, 8, "Stainless steel"),
  m("metal_bronze", "Anodised bronze", "metal", "plain", "#6B5138", 0.36, 0.8, 8, "Dark bronze anodised aluminium"),
  m("metal_corten", "Corten steel", "metal", "plaster", "#8A4B2E", 0.8, 0.3, 9, "Weathering steel with a rust patina"),

  m("ground_grass", "Lawn", "ground", "grass", "#6E9A55", 0.95, 0, 14, "Mown grass"),
  m("ground_gravel", "Gravel", "ground", "gravel", "#B4AB9B", 0.95, 0, 5, "Raked pea gravel"),
  m("ground_pavers", "Stone pavers", "ground", "pavers", "#BDB5A8", 0.8, 0, 6, "Large-format pavers"),
  m("ground_cobble", "Cobblestone", "ground", "cobble", "#8E8981", 0.85, 0, 5, "Setts laid in rows"),
  m("ground_asphalt", "Asphalt", "ground", "gravel", "#4A4B4F", 0.92, 0, 4, "Road surfacing"),
  m("ground_sand", "Sand", "ground", "gravel", "#DCC9A3", 0.96, 0, 6, "Fine sand and shell"),
];

const BY_ID = new Map(MATERIALS.map((def) => [def.id, def]));

export function getMaterial(id: string): MaterialDef {
  return BY_ID.get(id) ?? BY_ID.get("paint_matte")!;
}

export function materialsIn(category: MaterialCategory): MaterialDef[] {
  return MATERIALS.filter((def) => def.category === category);
}
