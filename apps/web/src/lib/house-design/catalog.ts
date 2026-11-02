import type { GalleryDesign } from "./gallery";
import { GALLERY } from "./gallery";
import { getMaterial, MATERIAL_CATEGORIES } from "./materials";
import type { ArchCategory, DoorDesign, Finish, HouseDesign, PorticoStyle, RoofType, WindowGrid, WindowShape, WindowTrim } from "./schema";
import { designForCategory } from "./styles";

/**
 * The browsable design catalog. Each entry is a complete design built from a category's sub-style, a material palette
 * and a layout variant, so applying one changes real geometry and materials. Previews are drawn from that same
 * specification, so a card always shows what its design is.
 */

export type BuildingType = "Single-storey" | "Double-storey" | "Multi-storey" | "Villa" | "Duplex";
export type ElevationView = "Front elevation" | "Rear elevation" | "Side elevation";

export type CatalogDesign = GalleryDesign & {
  categoryId: string;
  categoryName: string;
  subcategory: string;
  buildingType: BuildingType;
  view: ElevationView;
  /** The library family of the wall material, for filtering. */
  material: string;
  /** Higher is newer. */
  added: number;
};

export const BUILDING_TYPES: BuildingType[] = ["Single-storey", "Double-storey", "Multi-storey", "Villa", "Duplex"];

type Palette = { wall: Finish; accent: Finish; roof: Finish; trim: Finish; frame: Finish; door: Finish };
const f = (materialId: string, color: string): Finish => ({ materialId, color });
const pal = (wall: Finish, accent: Finish, roof: Finish, trim: Finish, frame: Finish, door: Finish): Palette => ({ wall, accent, roof, trim, frame, door });

const DARK = f("metal_powder", "#23252B"), BRONZE = f("metal_bronze", "#6B5138"), WHITE = f("paint_satin", "#F2EEE4"), BLACK = f("paint_satin", "#2B2C33");
const TEAK = f("wood_teak", "#A9764A"), WALNUT = f("wood_walnut", "#5B3A26"), OAK = f("wood_oak", "#B58F63"), CEDAR = f("wood_cedar", "#B9976F"), CHAR = f("wood_charred", "#2E2A28");
const MEMBRANE = f("roof_membrane", "#8C8A86"), SEAM = f("roof_seam", "#4A4E55"), SLATE = f("roof_slate", "#44474E"), CLAY = f("roof_clay", "#A9583A"), SHINGLE = f("roof_shingle", "#5C5650"), TILE = f("roof_concrete", "#7C736A");

const PALETTES: Record<string, Palette> = {
  snow: pal(f("paint_matte", "#F3F0E8"), TEAK, MEMBRANE, BLACK, DARK, WALNUT),
  ash: pal(f("concrete_smooth", "#A8A5A0"), OAK, MEMBRANE, BLACK, DARK, f("metal_corten", "#8A4B2E")),
  board: pal(f("concrete_board", "#9D9A93"), CEDAR, SEAM, BLACK, BRONZE, WALNUT),
  micro: pal(f("concrete_micro", "#D5D1C8"), f("stone_slate", "#4D5157"), MEMBRANE, BLACK, DARK, OAK),
  char: pal(f("brick_charcoal", "#3C3B3E"), OAK, SEAM, BLACK, BRONZE, TEAK),
  whitebrick: pal(f("brick_white", "#E6E1D8"), CHAR, SLATE, BLACK, DARK, f("paint_gloss", "#27463C")),
  redbrick: pal(f("brick_red", "#9C4B36"), f("stone_limestone", "#D8CFBD"), SLATE, WHITE, WHITE, f("paint_gloss", "#27364F")),
  claybrick: pal(f("brick_clay", "#B57A55"), f("stone_sandstone", "#C9AE85"), CLAY, WHITE, BRONZE, WALNUT),
  limestone: pal(f("stone_limestone", "#DDD3C0"), f("marble_travertine", "#D6C9B2"), SLATE, f("stone_limestone", "#E9E1D1"), BRONZE, WALNUT),
  sandstone: pal(f("stone_sandstone", "#CDB48B"), f("stone_field", "#8F8373"), CLAY, f("stone_limestone", "#E2DACA"), WALNUT.color ? f("wood_walnut", "#4C3222") : BRONZE, f("wood_teak", "#7F5433")),
  field: pal(f("stone_field", "#8E8678"), CEDAR, SHINGLE, f("wood_walnut", "#4C3222"), f("wood_walnut", "#4C3222"), OAK),
  slate: pal(f("stone_slate", "#54585E"), TEAK, SEAM, BLACK, DARK, OAK),
  granite: pal(f("stone_granite", "#8E8C8A"), f("metal_brushed", "#B9BDC2"), MEMBRANE, BLACK, DARK, f("metal_brushed", "#8C9095")),
  quartz: pal(f("stone_quartzite", "#B9AD9B"), TEAK, MEMBRANE, BLACK, BRONZE, WALNUT),
  carrara: pal(f("marble_carrara", "#F1EFEA"), f("marble_emperador", "#7A5A44"), SLATE, f("stone_limestone", "#E2DACA"), BRONZE, WALNUT),
  travertine: pal(f("marble_travertine", "#DCD3C2"), f("marble_nero", "#2A2A2C"), TILE, f("metal_bronze", "#6B5138"), BRONZE, f("metal_bronze", "#6B5138")),
  stucco: pal(f("paint_stucco", "#E9DCC3"), f("tile_terracotta", "#B9673F"), CLAY, f("wood_walnut", "#4C3222"), f("wood_walnut", "#4C3222"), WALNUT),
  lime: pal(f("paint_limewash", "#F4EFE4"), f("tile_zellige", "#3E7C85"), CLAY, f("paint_gloss", "#2F5C7A"), f("paint_gloss", "#2F5C7A"), f("paint_gloss", "#2F5C7A")),
  ochre: pal(f("paint_plaster", "#D9A94F"), f("stone_sandstone", "#B7905F"), CLAY, WHITE, f("wood_teak", "#7F5433"), f("wood_teak", "#7F5433")),
  rose: pal(f("paint_plaster", "#C98A73"), f("stone_sandstone", "#E0C9A4"), TILE, f("paint_satin", "#F3E7D3"), WALNUT, WALNUT),
  cedar: pal(CEDAR, f("stone_field", "#8E8678"), SHINGLE, WHITE, WHITE, f("paint_gloss", "#6B2D2A")),
  blackwood: pal(CHAR, OAK, SEAM, BLACK, DARK, OAK),
  oak: pal(OAK, f("paint_matte", "#EFEBE1"), SEAM, BLACK, DARK, CHAR),
  sage: pal(f("paint_matte", "#A9B39C"), CEDAR, SLATE, WHITE, WHITE, f("paint_gloss", "#3B4A3A")),
  ocean: pal(f("paint_matte", "#CBD9DE"), f("wood_cedar", "#C8B79B"), SHINGLE, WHITE, WHITE, f("paint_gloss", "#2F5C7A")),
  corten: pal(f("metal_corten", "#8A4B2E"), f("concrete_board", "#9D9A93"), SEAM, BLACK, DARK, BLACK),
  steel: pal(f("metal_brushed", "#B9BDC2"), f("glass_blue", "#5E8FB0"), MEMBRANE, DARK, DARK, DARK),
  ivory: pal(f("paint_satin", "#F1E8D6"), f("stone_limestone", "#D8CFBD"), TILE, WHITE, WHITE, f("paint_gloss", "#1F2A44")),
};

type Sub = {
  name: string;
  noun: string;
  roof: RoofType;
  pitch?: number;
  overhang?: number;
  shape?: WindowShape;
  grid?: WindowGrid;
  trim?: WindowTrim;
  door?: DoorDesign;
  portico?: PorticoStyle;
  accent?: HouseDesign["exterior"]["accentPlacement"];
  rail?: HouseDesign["exterior"]["balcony"]["style"];
  details?: Partial<HouseDesign["exterior"]["details"]>;
};

type Category = { id: string; label: string; kit: ArchCategory; palettes: string[]; subs: [Sub, Sub, Sub] };

const CATEGORIES: Category[] = [
  { id: "modern", label: "Modern Architecture", kit: "modern", palettes: ["snow", "ash", "char", "micro", "quartz"], subs: [
    { name: "Cantilever", noun: "Overhang House", roof: "cantilever", overhang: 4 },
    { name: "Glass box", noun: "Glasshouse", roof: "flat", grid: "none", accent: "right" },
    { name: "Split volume", noun: "Split House", roof: "shed", pitch: 10, accent: "left" } ] },
  { id: "minimalist", label: "Minimalist Architecture", kit: "minimalist", palettes: ["snow", "micro", "ash", "ivory", "board"], subs: [
    { name: "Monolith", noun: "Monolith", roof: "flat" },
    { name: "Courtyard", noun: "Quiet Court", roof: "flat", accent: "entry" },
    { name: "Pure gable", noun: "Plain Gable", roof: "gable", pitch: 38, overhang: 0.2, grid: "none" } ] },
  { id: "contemporary", label: "Contemporary Architecture", kit: "contemporary", palettes: ["board", "quartz", "oak", "slate", "whitebrick"], subs: [
    { name: "Screened", noun: "Screen House", roof: "shed", details: { fins: true } },
    { name: "Layered", noun: "Layered Residence", roof: "cantilever", overhang: 3, accent: "upper" },
    { name: "Asymmetric", noun: "Offset House", roof: "gable", pitch: 22, accent: "left" } ] },
  { id: "luxury", label: "Luxury Villas", kit: "luxury", palettes: ["carrara", "limestone", "travertine", "granite", "sandstone"], subs: [
    { name: "Grand estate", noun: "Grand Estate", roof: "hip", pitch: 30 },
    { name: "Mansard villa", noun: "Mansard Villa", roof: "mansard", portico: "columns" },
    { name: "Modern palace", noun: "Palace Villa", roof: "flat", grid: "none", rail: "glass", details: { quoins: false, cornice: true } } ] },
  { id: "traditional", label: "Traditional Houses", kit: "traditional", palettes: ["redbrick", "cedar", "claybrick", "field", "sage"], subs: [
    { name: "Gabled home", noun: "Gable Home", roof: "gable", pitch: 38 },
    { name: "Hipped home", noun: "Hip Cottage", roof: "hip", pitch: 30, trim: "surround" },
    { name: "Porch house", noun: "Porch House", roof: "gable", pitch: 30, portico: "canopy", grid: "cross" } ] },
  { id: "mediterranean", label: "Mediterranean Houses", kit: "mediterranean", palettes: ["stucco", "lime", "ochre", "rose", "sandstone"], subs: [
    { name: "Tuscan", noun: "Tuscan Casa", roof: "hip", pitch: 22 },
    { name: "Spanish", noun: "Hacienda", roof: "gable", pitch: 20, shape: "arched" },
    { name: "Greek island", noun: "Island House", roof: "flat", door: "arched", rail: "solid_parapet" } ] },
  { id: "indian", label: "Indian Architecture", kit: "mediterranean", palettes: ["ochre", "rose", "sandstone", "stucco", "claybrick"], subs: [
    { name: "Haveli", noun: "Haveli", roof: "flat", shape: "arched", rail: "jali", trim: "surround", details: { corbels: true } },
    { name: "Kerala", noun: "Tharavad", roof: "hip", pitch: 34, overhang: 3.5, shape: "rectangular", door: "panelled", rail: "baluster", portico: "columns" },
    { name: "Indo-Saracenic", noun: "Mahal", roof: "flat", shape: "gothic", portico: "arch", rail: "jali", details: { pilasters: true } } ] },
  { id: "scandinavian", label: "Scandinavian Architecture", kit: "contemporary", palettes: ["blackwood", "oak", "snow", "sage", "cedar"], subs: [
    { name: "Nordic barn", noun: "Nordic Barn", roof: "gable", pitch: 42, overhang: 0.4, grid: "none" },
    { name: "Forest cabin", noun: "Forest Hytte", roof: "gable", pitch: 30, overhang: 1.5, door: "flush" },
    { name: "Lakeside", noun: "Lake Stuga", roof: "shed", pitch: 16, grid: "vertical" } ] },
  { id: "industrial", label: "Industrial Architecture", kit: "modern", palettes: ["corten", "redbrick", "char", "steel", "board"], subs: [
    { name: "Loft", noun: "Warehouse Loft", roof: "flat", grid: "colonial", rail: "metal_slats" },
    { name: "Sawtooth", noun: "Works House", roof: "shed", pitch: 20, grid: "cross" },
    { name: "Steel frame", noun: "Foundry House", roof: "cantilever", grid: "colonial", door: "glazed" } ] },
  { id: "colonial", label: "Colonial Architecture", kit: "traditional", palettes: ["ivory", "redbrick", "snow", "ocean", "limestone"], subs: [
    { name: "Georgian", noun: "Georgian House", roof: "hip", pitch: 30, details: { cornice: true, quoins: true } },
    { name: "Bungalow", noun: "Colonial Bungalow", roof: "hip", pitch: 22, overhang: 3, portico: "columns" },
    { name: "Dutch", noun: "Dutch Colonial", roof: "mansard", trim: "shutters" } ] },
  { id: "neoclassical", label: "Neoclassical Architecture", kit: "luxury", palettes: ["limestone", "carrara", "ivory", "travertine", "granite"], subs: [
    { name: "Temple front", noun: "Portico Hall", roof: "gable", pitch: 18, details: { pilasters: true } },
    { name: "Palladian", noun: "Palladian Villa", roof: "hip", pitch: 22, shape: "arched" },
    { name: "Beaux-Arts", noun: "Beaux Hall", roof: "mansard", shape: "segmental", details: { corbels: true } } ] },
  { id: "japanese", label: "Japanese Architecture", kit: "minimalist", palettes: ["blackwood", "oak", "micro", "cedar", "ash"], subs: [
    { name: "Machiya", noun: "Machiya", roof: "gable", pitch: 26, overhang: 2.5, grid: "colonial", door: "slatted" },
    { name: "Minka", noun: "Minka", roof: "hip", pitch: 40, overhang: 3, grid: "cross", door: "slatted" },
    { name: "Concrete zen", noun: "Zen House", roof: "flat", grid: "vertical", accent: "entry", details: { fins: true } } ] },
  { id: "tropical", label: "Tropical Architecture", kit: "contemporary", palettes: ["oak", "stucco", "quartz", "cedar", "sage"], subs: [
    { name: "Balinese", noun: "Bale House", roof: "hip", pitch: 36, overhang: 4, door: "double" },
    { name: "Breezeway", noun: "Breeze House", roof: "cantilever", overhang: 5, door: "slatted", rail: "metal_slats" },
    { name: "Stilted", noun: "Palm Pavilion", roof: "gable", pitch: 32, overhang: 3.5, rail: "baluster" } ] },
  { id: "brutalist", label: "Brutalist Architecture", kit: "minimalist", palettes: ["board", "ash", "granite", "micro", "corten"], subs: [
    { name: "Raw concrete", noun: "Concrete Block", roof: "flat", rail: "solid_parapet", overhang: 1, grid: "cross", details: { plinth: true, stringCourse: true } },
    { name: "Stacked", noun: "Stacked Mass", roof: "cantilever", overhang: 2.5, rail: "solid_parapet", grid: "vertical" },
    { name: "Fortress", noun: "Bastion House", roof: "flat", shape: "round", rail: "solid_parapet", details: { fins: true } } ] },
  { id: "farmhouse", label: "Farmhouse Designs", kit: "traditional", palettes: ["whitebrick", "cedar", "sage", "ivory", "field"], subs: [
    { name: "Modern farmhouse", noun: "Farmstead", roof: "gable", pitch: 40, grid: "cross", trim: "none", door: "glazed" },
    { name: "Barn", noun: "Barn House", roof: "mansard", trim: "none", door: "double" },
    { name: "Wraparound porch", noun: "Porch Farm", roof: "gable", pitch: 34, portico: "columns" } ] },
  { id: "mountain", label: "Mountain Houses", kit: "traditional", palettes: ["field", "blackwood", "slate", "cedar", "oak"], subs: [
    { name: "Alpine chalet", noun: "Chalet", roof: "gable", pitch: 32, overhang: 3.5, rail: "metal_slats", trim: "none" },
    { name: "Stone lodge", noun: "Lodge", roof: "gable", pitch: 42, overhang: 2, trim: "none", details: { corbels: true } },
    { name: "Ridge retreat", noun: "Ridge Retreat", roof: "shed", pitch: 20, overhang: 3, grid: "none", trim: "none" } ] },
  { id: "coastal", label: "Coastal Houses", kit: "contemporary", palettes: ["ocean", "snow", "lime", "cedar", "ivory"], subs: [
    { name: "Beach house", noun: "Beach House", roof: "gable", pitch: 26, door: "glazed", rail: "glass" },
    { name: "Shingle style", noun: "Shingle Cottage", roof: "hip", pitch: 34, grid: "colonial", door: "panelled" },
    { name: "Cliffside", noun: "Cliff House", roof: "cantilever", overhang: 4, grid: "none", rail: "glass" } ] },
  { id: "sustainable", label: "Sustainable Architecture", kit: "contemporary", palettes: ["oak", "sage", "claybrick", "cedar", "board"], subs: [
    { name: "Passive house", noun: "Passive House", roof: "gable", pitch: 35, overhang: 0.8, grid: "none" },
    { name: "Solar orientated", noun: "Solar House", roof: "shed", pitch: 28, grid: "vertical" },
    { name: "Mass timber", noun: "Timber Frame", roof: "cantilever", overhang: 3.5, details: { fins: true } } ] },
  { id: "futuristic", label: "Futuristic Architecture", kit: "modern", palettes: ["steel", "snow", "granite", "char", "micro"], subs: [
    { name: "Parametric", noun: "Vector House", roof: "shed", pitch: 24, details: { fins: true }, grid: "none" },
    { name: "Orbital", noun: "Orbit House", roof: "flat", shape: "round", grid: "none" },
    { name: "Floating deck", noun: "Hover House", roof: "cantilever", overhang: 6, grid: "none", rail: "glass" } ] },
  { id: "smart", label: "Smart Homes", kit: "modern", palettes: ["ash", "snow", "quartz", "steel", "slate"], subs: [
    { name: "Connected villa", noun: "Connected Villa", roof: "flat", door: "glazed", grid: "none" },
    { name: "Solar smart", noun: "Grid House", roof: "shed", pitch: 18, door: "flush" },
    { name: "Compact smart", noun: "Sensor House", roof: "cantilever", overhang: 2.5, accent: "lower" } ] },
];

const WORDS = ["Amber", "Birch", "Cobalt", "Dawn", "Ember", "Fern", "Golden", "Harbor", "Ivory", "Juniper", "Kestrel", "Linden", "Meadow", "North", "Onyx", "Pearl", "Quarry", "River", "Saffron", "Tidal", "Umber", "Vale", "Willow", "Zephyr"];

const ROOF_WORD: Record<RoofType, string> = { flat: "flat", cantilever: "deep flat", gable: "gable", hip: "hip", shed: "mono-pitch", mansard: "mansard" };
const VIEWS: ElevationView[] = ["Front elevation", "Rear elevation", "Side elevation"];
const GRIDS: WindowGrid[] = ["none", "vertical", "cross", "colonial"];
const RAILS: HouseDesign["exterior"]["balcony"]["style"][] = ["glass", "metal_slats", "baluster", "jali", "solid_parapet"];
const PER_CATEGORY = 30;

function compose(category: Category, sub: Sub, palette: Palette, variant: number): HouseDesign {
  const d = designForCategory(category.kit);
  const ext = d.exterior;
  ext.wall = { ...palette.wall };
  ext.accent = { ...palette.accent };
  ext.trim = { ...palette.trim };
  ext.window.frame = { ...palette.frame };
  ext.door.finish = { ...palette.door };
  ext.roof.fascia = { ...palette.trim };
  ext.balcony.slab = { ...palette.trim };
  const flat = sub.roof === "flat" || sub.roof === "cantilever";
  ext.roof.type = sub.roof;
  ext.roof.finish = flat ? { ...MEMBRANE, color: palette.roof.color } : { ...palette.roof };
  if (sub.pitch) ext.roof.pitch = sub.pitch;
  if (sub.overhang !== undefined) ext.roof.overhang = sub.overhang;
  if (sub.shape) ext.window.shape = sub.shape;
  if (sub.grid) ext.window.grid = sub.grid;
  if (sub.trim) ext.window.trim = sub.trim;
  if (sub.door) ext.door.design = sub.door;
  if (sub.portico) ext.details.portico = sub.portico;
  if (sub.accent) ext.accentPlacement = sub.accent;
  if (sub.rail) ext.balcony.style = sub.rail;
  Object.assign(ext.details, sub.details);
  // Three layouts of each scheme: as designed, lighter and more open, and more enclosed.
  if (variant === 1) {
    ext.window.proportion = "full";
    ext.window.grid = GRIDS[(GRIDS.indexOf(ext.window.grid) + 1) % GRIDS.length];
    ext.balcony.elevations = ["front", "rear"];
    if (!flat) ext.roof.pitch = Math.min(50, ext.roof.pitch + 6);
    ext.accentCoverage = 0.5;
  } else if (variant === 2) {
    ext.window.proportion = "standard";
    ext.balcony.style = RAILS[(RAILS.indexOf(ext.balcony.style) + 1) % RAILS.length];
    ext.balcony.projected = false;
    if (!flat) ext.roof.pitch = Math.max(12, ext.roof.pitch - 6);
    ext.roof.overhang = Math.round((ext.roof.overhang + 0.7) * 10) / 10;
    if (ext.accentPlacement === "none") ext.accentPlacement = "lower";
  }
  return d;
}

const familyOf = (design: HouseDesign) => {
  const id = getMaterial(design.exterior.wall.materialId).category;
  return MATERIAL_CATEGORIES.find((c) => c.id === id)?.label ?? "Paint";
};

function signature(entry: GalleryDesign, index: number): CatalogDesign {
  const category = CATEGORIES.find((c) => c.kit === entry.category)!;
  const label = CATEGORIES.find((c) => c.id === entry.category)?.label ?? category.label;
  return { ...entry, categoryId: entry.category, categoryName: label, subcategory: "Signature", buildingType: index % 2 ? "Villa" : "Double-storey", view: "Front elevation", material: familyOf(entry.design), added: index };
}

let built: CatalogDesign[] | null = null;

/** Every design. Built on first use, since it is only needed once the gallery opens or a design is applied. */
export function catalog(): CatalogDesign[] {
  if (built) return built;
  const entries = GALLERY.map(signature);
  CATEGORIES.forEach((category, c) => {
    for (let n = 0; n < PER_CATEGORY; n++) {
      const sub = category.subs[n % 3];
      const variant = Math.floor(n / 3) % 3;
      const paletteKey = category.palettes[(Math.floor(n / 9) + (n % 9)) % category.palettes.length];
      const design = compose(category, sub, PALETTES[paletteKey], variant);
      const buildingType = BUILDING_TYPES[(n + c) % BUILDING_TYPES.length];
      const walls = getMaterial(design.exterior.wall.materialId).name.toLowerCase();
      entries.push({
        id: `${category.id}-${sub.name.toLowerCase().replace(/[^a-z]+/g, "-")}-${n + 1}`,
        name: `${WORDS[(Math.floor(n / 3) + c * 3) % WORDS.length]} ${sub.noun}`,
        category: category.kit,
        summary: `${sub.name} design in ${walls} under a ${ROOF_WORD[sub.roof]} roof.`,
        image: "",
        design,
        categoryId: category.id,
        categoryName: category.label,
        subcategory: sub.name,
        buildingType,
        view: VIEWS[n % VIEWS.length],
        material: familyOf(design),
        added: 100 + c * PER_CATEGORY + n,
      });
    }
  });
  built = entries;
  return built;
}

export function catalogCategories(): { id: string; label: string; subcategories: string[] }[] {
  return CATEGORIES.map((c) => ({ id: c.id, label: c.label, subcategories: c.subs.map((s) => s.name) }));
}

export function getCatalogDesign(id: string | undefined): CatalogDesign | undefined {
  return id ? catalog().find((e) => e.id === id) : undefined;
}

export type CatalogQuery = { text: string; categoryId: string | null; subcategory: string | null; material: string | null; buildingType: string | null; sort: "recent" | "name" };

export function searchCatalog(entries: CatalogDesign[], q: CatalogQuery): CatalogDesign[] {
  const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
  const found = entries.filter((e) => {
    if (q.categoryId && e.categoryId !== q.categoryId) return false;
    if (q.subcategory && e.subcategory !== q.subcategory) return false;
    if (q.material && e.material !== q.material) return false;
    if (q.buildingType && e.buildingType !== q.buildingType) return false;
    const text = `${e.name} ${e.categoryName} ${e.subcategory} ${e.summary}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return found.sort((a, b) => (q.sort === "name" ? a.name.localeCompare(b.name) : b.added - a.added));
}

function windowMark(x: number, y: number, w: number, h: number, shape: WindowShape, frame: string, grid: WindowGrid): string {
  const glass = 'fill="url(#g)"';
  const stroke = `stroke="${frame}" stroke-width="2"`;
  const bars = grid === "none" ? "" : `<path d="M${x + w / 2} ${y}V${y + h}${grid === "cross" || grid === "colonial" ? `M${x} ${y + h / 2}H${x + w}` : ""}" ${stroke} fill="none"/>`;
  if (shape === "round") return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2}" ${glass} ${stroke}/>`;
  if (shape === "arched" || shape === "gothic" || shape === "segmental") {
    const rise = shape === "segmental" ? w * 0.18 : w / 2;
    const top = shape === "gothic" ? `L${x + w / 2} ${y - rise}L${x + w} ${y}` : `Q${x + w / 2} ${y - rise * 1.5} ${x + w} ${y}`;
    return `<path d="M${x} ${y + h}V${y}${top}V${y + h}Z" ${glass} ${stroke}/>${bars}`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${glass} ${stroke}/>${bars}`;
}

function roofMark(type: RoofType, x: number, w: number, top: number, pitch: number, reach: number, color: string, fascia: string, wall: string): string {
  const rise = Math.min(90, (w / 2) * Math.tan((pitch * Math.PI) / 180));
  const l = x - reach, r = x + w + reach;
  switch (type) {
    case "flat": return `<rect x="${l}" y="${top - 10}" width="${r - l}" height="3" fill="${color}"/><rect x="${l}" y="${top - 7}" width="${r - l}" height="8" fill="${fascia}"/>`;
    case "cantilever": return `<rect x="${l - 14}" y="${top - 15}" width="${r - l + 28}" height="3" fill="${color}"/><rect x="${l - 14}" y="${top - 12}" width="${r - l + 28}" height="13" fill="${fascia}"/>`;
    case "gable": return `<path d="M${x} ${top}L${x + w / 2} ${top - rise}L${x + w} ${top}Z" fill="${wall}"/><path d="M${l} ${top + 6}L${x + w / 2} ${top - rise - 4}L${r} ${top + 6}" fill="none" stroke="${color}" stroke-width="9"/>`;
    case "hip": return `<path d="M${l} ${top + 3}L${x + w * 0.28} ${top - rise * 0.7}H${x + w * 0.72}L${r} ${top + 3}Z" fill="${color}"/>`;
    case "shed": return `<path d="M${l} ${top + 3}V${top - 4}L${r} ${top - rise * 0.8}V${top + 3}Z" fill="${color}"/>`;
    default: return `<path d="M${l} ${top + 3}L${x + 14} ${top - 42}H${x + w - 14}L${r} ${top + 3}Z" fill="${color}"/><rect x="${x + 12}" y="${top - 46}" width="${w - 24}" height="5" fill="${fascia}"/>`;
  }
}

/** A drawn elevation of the design as an image URL, made from the same values the 3D model uses. */
export function previewImage(entry: CatalogDesign): string {
  if (entry.image) return entry.image;
  const ext = entry.design.exterior;
  const storeys = entry.buildingType === "Single-storey" ? 1 : entry.buildingType === "Multi-storey" ? 3 : 2;
  const side = entry.view === "Side elevation";
  const w = side ? 250 : entry.buildingType === "Villa" ? 400 : 340;
  const fh = storeys === 3 ? 70 : 88;
  const ground = 262, x = (640 - w) / 2, top = ground - storeys * fh;
  const reach = ext.roof.overhang * 6;
  const columns = Math.max(2, Math.round(w / 95));
  const tall = ext.window.proportion === "full" ? 0.72 : ext.window.proportion === "tall" ? 0.6 : 0.42;
  const parts: string[] = [];
  parts.push(`<rect x="${x}" y="${top}" width="${w}" height="${ground - top}" fill="${ext.wall.color}"/>`);
  const accentW = w * ext.accentCoverage;
  if (ext.accentPlacement === "lower") parts.push(`<rect x="${x}" y="${ground - fh}" width="${w}" height="${fh}" fill="${ext.accent.color}"/>`);
  else if (ext.accentPlacement === "upper") parts.push(`<rect x="${x}" y="${top}" width="${w}" height="${fh}" fill="${ext.accent.color}"/>`);
  else if (ext.accentPlacement !== "none") parts.push(`<rect x="${ext.accentPlacement === "right" ? x + w - accentW : ext.accentPlacement === "left" ? x : x + (w - accentW) / 2}" y="${top}" width="${accentW}" height="${ground - top}" fill="${ext.accent.color}"/>`);
  if (ext.details.fins) for (let i = 0; i < 9; i++) parts.push(`<rect x="${x + 8 + i * 9}" y="${top + 4}" width="3" height="${ground - top - 8}" fill="${ext.accent.color}" opacity=".8"/>`);
  if (ext.details.plinth) parts.push(`<rect x="${x - 2}" y="${ground - 10}" width="${w + 4}" height="10" fill="${ext.trim.color}" opacity=".75"/>`);
  for (let s = 0; s < storeys; s++) {
    const y = top + s * fh + fh * 0.18, h = fh * tall;
    for (let c = 0; c < columns; c++) {
      const cw = w / columns, wx = x + c * cw + cw * 0.2, ww = cw * 0.6;
      const isDoor = s === storeys - 1 && c === Math.floor(columns / 2);
      if (isDoor) {
        const dh = fh * 0.8;
        parts.push(`<rect x="${wx}" y="${ground - dh}" width="${ww}" height="${dh}" fill="${entry.view === "Rear elevation" ? "url(#g)" : ext.door.finish.color}" stroke="${entry.view === "Rear elevation" ? ext.door.finish.color : ext.trim.color}" stroke-width="2"/>${ext.door.design === "double" ? `<path d="M${wx + ww / 2} ${ground - dh}V${ground}" stroke="${ext.trim.color}"/>` : ext.door.design === "glazed" ? `<rect x="${wx + ww * 0.25}" y="${ground - dh * 0.85}" width="${ww / 2}" height="${dh * 0.6}" fill="url(#g)"/>` : ""}`);
      } else parts.push(windowMark(wx, y, ww, h, ext.window.shape, ext.window.frame.color, ext.window.grid));
    }
    if (s < storeys - 1 && ext.balcony.projected) {
      const by = top + (s + 1) * fh;
      parts.push(`<rect x="${x + w * 0.1}" y="${by - 3}" width="${w * 0.8}" height="5" fill="${ext.trim.color}"/><rect x="${x + w * 0.1}" y="${by - 22}" width="${w * 0.8}" height="19" fill="${ext.balcony.style === "glass" ? "#CFE3EE" : ext.balcony.rail.color}" opacity=".55"/>`);
    }
  }
  if (ext.details.cornice) parts.push(`<rect x="${x - 4}" y="${top}" width="${w + 8}" height="6" fill="${ext.trim.color}"/>`);
  if (ext.details.stringCourse) parts.push(`<rect x="${x}" y="${ground - fh - 2}" width="${w}" height="4" fill="${ext.trim.color}"/>`);
  if (ext.details.quoins || ext.details.pilasters) for (const qx of [x, x + w - 8]) parts.push(`<rect x="${qx}" y="${top}" width="8" height="${ground - top}" fill="${ext.trim.color}" opacity=".7"/>`);
  if (ext.details.corbels) for (let i = 0; i < 10; i++) parts.push(`<rect x="${x + 6 + (i * (w - 12)) / 10}" y="${top + 1}" width="5" height="6" fill="${ext.trim.color}"/>`);
  if (ext.window.trim !== "none") for (let c = 0; c < columns; c++) parts.push(`<rect x="${x + c * (w / columns) + 4}" y="${top + fh * 0.1}" width="${w / columns - 8}" height="3" fill="${ext.trim.color}"/>`);
  parts.push(roofMark(ext.roof.type, x, w, top, ext.roof.pitch, reach, ext.roof.finish.color, ext.roof.fascia.color, ext.wall.color));
  if (ext.details.portico !== "none" && !side) parts.push(`<rect x="${320 - 52}" y="${ground - fh * 0.98}" width="104" height="7" fill="${ext.trim.color}"/>${ext.details.portico === "canopy" ? "" : `<rect x="${320 - 48}" y="${ground - fh * 0.95}" width="7" height="${fh * 0.95}" fill="${ext.trim.color}"/><rect x="${320 + 41}" y="${ground - fh * 0.95}" width="7" height="${fh * 0.95}" fill="${ext.trim.color}"/>`}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 340"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9C8E6"/><stop offset="1" stop-color="#F4EFE2"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FB4CC"/><stop offset="1" stop-color="#34495A"/></linearGradient></defs><rect width="640" height="262" fill="url(#s)"/><rect y="262" width="640" height="78" fill="${entry.design.environment.ground.color}"/><path d="M270 340L300 262H340L370 340Z" fill="#CFC8BA"/>${parts.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
