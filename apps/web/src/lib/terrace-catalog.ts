import type { FurnitureItem, Room, RoomType } from "@houseplan/design-schema";

export type RailingStyle = "glass" | "metal_slats" | "jali" | "baluster" | "solid_parapet";
export type TerraceShadeStructure = "none" | "pergola" | "covered_pavilion" | "sky_lounge" | "solar_rack" | "indian_chhatri";
export type FacadeStyleId = "modern" | "contemporary" | "traditional_indian" | "luxury" | "minimalist";
export type TerraceFlooring = "stone_pavers" | "teak_deck" | "artificial_turf" | "terracotta_tiles" | "polished_granite";

export interface TerraceConfig {
  layoutId: string;
  railingStyle: RailingStyle;
  parapetHeight: number; // in feet (default 3.5)
  shadeStructure: TerraceShadeStructure;
  hasMumty: boolean; // Staircase headhouse enclosure
  flooring: TerraceFlooring;
  outdoorLighting: "solar_bollards" | "perimeter_led" | "warm_sconces" | "festoon";
}

export interface ExteriorConfig {
  facadeStyle: FacadeStyleId;
  hasBoundaryWall: boolean;
  boundaryWallHeight: number; // in feet (default 5.0)
  hasMainGate: boolean;
  hasDrivewayPavers: boolean;
  hasFrontGarden: boolean;
  hasEntrancePortico: boolean;
  balconyRailing: RailingStyle;
  wallCladdingAccent: "none" | "stone_slate" | "timber_louvers" | "terracotta" | "white_marble";
}

export const DEFAULT_TERRACE_CONFIG: TerraceConfig = {
  layoutId: "open",
  railingStyle: "glass",
  parapetHeight: 3.5,
  shadeStructure: "none",
  hasMumty: true,
  flooring: "stone_pavers",
  outdoorLighting: "solar_bollards",
};

export const DEFAULT_EXTERIOR_CONFIG: ExteriorConfig = {
  facadeStyle: "modern",
  hasBoundaryWall: true,
  boundaryWallHeight: 4.5,
  hasMainGate: true,
  hasDrivewayPavers: true,
  hasFrontGarden: true,
  hasEntrancePortico: true,
  balconyRailing: "glass",
  wallCladdingAccent: "timber_louvers",
};

// ── Railing Styles ───────────────────────────────────────────────────

export interface RailingSpec {
  id: RailingStyle;
  name: string;
  description: string;
  color: string;
  opacity: number;
}

export const RAILING_STYLES: RailingSpec[] = [
  { id: "glass", name: "Frameless Glass Balustrade", description: "12mm tempered safety glass with stainless steel posts & handrail", color: "#C8E1F2", opacity: 0.4 },
  { id: "metal_slats", name: "Modern Steel Horizontal Slats", description: "Black powder-coated aluminum horizontal safety slats", color: "#22252A", opacity: 1.0 },
  { id: "jali", name: "Decorative Terracotta/Stone Jali", description: "Perforated traditional architectural screen providing shade and breeze", color: "#C47B4A", opacity: 1.0 },
  { id: "baluster", name: "Classic Architectural Balustrade", description: "Classical cast-stone urn-shaped balusters with molded coping", color: "#E8E2D5", opacity: 1.0 },
  { id: "solid_parapet", name: "Rendered Masonry Parapet", description: "Solid 3.5ft boundary wall with smooth coping stone cap", color: "#ECEAE6", opacity: 1.0 },
];

// ── Terrace Shading Structures ───────────────────────────────────────

export interface ShadingSpec {
  id: TerraceShadeStructure;
  name: string;
  tagline: string;
  description: string;
}

export const SHADING_STRUCTURES: ShadingSpec[] = [
  { id: "none", name: "Open Sky (No Canopy)", tagline: "Zero overhead obstruction", description: "Full panoramic view of the sky and stars." },
  { id: "pergola", name: "Architectural Timber/Steel Pergola", tagline: "Geometric filtered shade", description: "Sturdy structural posts with cross-rafters supporting climbing flora or canvas." },
  { id: "covered_pavilion", name: "Covered Roof Pavilion", tagline: "All-weather rain & sun shelter", description: "Solid overhead canopy with supporting columns and integrated downlights." },
  { id: "sky_lounge", name: "Glass Enclosed Sky Salon", tagline: "Climate-controlled rooftop room", description: "Frameless glass walls and sliding doors creating an indoor rooftop lounge." },
  { id: "solar_rack", name: "Elevated Solar Panel Rack", tagline: "Clean solar power generation", description: "Elevated galvanized steel rack with tilted photovoltaic solar modules." },
  { id: "indian_chhatri", name: "Traditional Chhatri & Jhula", tagline: "Heritage canopy with swing", description: "Ornate carved stone pavilion featuring a hanging brass/wood swing (jhula)." },
];

// ── Terrace Flooring Options ─────────────────────────────────────────

export interface TerraceFloorSpec {
  id: TerraceFlooring;
  name: string;
  color: string;
  roughness: number;
  description: string;
}

export const TERRACE_FLOOR_OPTIONS: TerraceFloorSpec[] = [
  { id: "stone_pavers", name: "Architectural Granite Pavers", color: "#C5BDB2", roughness: 0.65, description: "Non-slip flamed granite tiles with perimeter slope drainage" },
  { id: "teak_deck", name: "Teak Decking Planks", color: "#9E7348", roughness: 0.72, description: "Weather-resistant tropical hardwood deck over batten subframe" },
  { id: "artificial_turf", name: "Lush Artificial Lawn Turf", color: "#3B753A", roughness: 0.85, description: "High-density UV-stabilized synthetic grass creating a rooftop garden" },
  { id: "terracotta_tiles", name: "Traditional Terracotta Tiles", color: "#C26842", roughness: 0.75, description: "Natural clay roof tiles providing traditional cooling insulation" },
  { id: "polished_granite", name: "Polished Basalt & Marble", color: "#484E59", roughness: 0.35, description: "Modern dark polished stone with luxury contrast" },
];

// ── Facade Style Presets ─────────────────────────────────────────────

export interface FacadePreset {
  id: FacadeStyleId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  cladding: string;
}

export const FACADE_PRESETS: FacadePreset[] = [
  {
    id: "modern",
    name: "Modern Minimalist",
    tagline: "Clean volumes, glass & metal",
    description: "Sleek cantilevered balcony boxes, expansive frameless glass balustrades, charcoal metal fascia trim, and crisp white stucco.",
    accentColor: "#2B2F38",
    cladding: "Charcoal Steel Trim & Smooth Plaster",
  },
  {
    id: "contemporary",
    name: "Contemporary Warmth",
    tagline: "Vertical timber louvers & stone",
    description: "Architectural timber screening louvers, warm stone masonry accents, concealed ambient cove lighting, and balanced asymmetry.",
    accentColor: "#7D5233",
    cladding: "Natural Teak Louvers & Travertine Stone",
  },
  {
    id: "traditional_indian",
    name: "Traditional Indian Heritage",
    tagline: "Jali screens, chhatri & carved stone",
    description: "Perforated stone jali balustrades, projecting chhajjas (sunshades), carved entry pillars, terracotta roof accents, and ornamental brass gate.",
    accentColor: "#A65426",
    cladding: "Terracotta Jali & Dholpur Sandstone",
  },
  {
    id: "luxury",
    name: "Luxury Estate Villa",
    tagline: "Grand marble portico & glass decks",
    description: "Double-height entrance portico, Italian marble facade feature panels, wrap-around illuminated glass terraces, and landscaped perimeter.",
    accentColor: "#303A48",
    cladding: "Carrara White Marble & Architectural Bronze",
  },
  {
    id: "minimalist",
    name: "Monolithic Geometry",
    tagline: "Pure forms, concealed details",
    description: "Unbroken monolithic geometric forms, recessed window reveals, frameless glass railings, and seamless monochrome palettes.",
    accentColor: "#1F1F24",
    cladding: "Architectural Smooth Concrete & Shadow-line Gaps",
  },
];

// ── Terrace Outdoor Furniture & Staging Catalog ─────────────────────

export interface TerraceFurnitureItem {
  type: string;
  name: string;
  category: "seating" | "dining" | "shade" | "planters" | "utility" | "decor";
  dimensions: { width: number; depth: number; height: number };
  defaultColor: string;
  description: string;
}

export const TERRACE_FURNITURE_CATALOG: TerraceFurnitureItem[] = [
  {
    type: "outdoor_sofa",
    name: "All-Weather Lounge Sofa",
    category: "seating",
    dimensions: { width: 6.8, depth: 3.0, height: 2.6 },
    defaultColor: "#424854",
    description: "Weatherproof teak and powder-coated aluminum sofa with Sunbrella cushions",
  },
  {
    type: "outdoor_coffee_table",
    name: "Outdoor Coffee Table",
    category: "seating",
    dimensions: { width: 3.8, depth: 2.2, height: 1.4 },
    defaultColor: "#574438",
    description: "Solid slatted teak low coffee table with rounded corners",
  },
  {
    type: "sun_lounger",
    name: "Poolside / Sun Lounger",
    category: "seating",
    dimensions: { width: 2.4, depth: 6.5, height: 1.8 },
    defaultColor: "#DED6C8",
    description: "Adjustable backrest sun lounger with weather-resistant fabric",
  },
  {
    type: "outdoor_dining_set",
    name: "6-Seater Outdoor Dining Set",
    category: "dining",
    dimensions: { width: 6.0, depth: 3.5, height: 2.5 },
    defaultColor: "#39332D",
    description: "Heavy aluminum frame dining table with 6 matching outdoor armchairs",
  },
  {
    type: "planter_box",
    name: "Raised Concrete Planter",
    category: "planters",
    dimensions: { width: 5.0, depth: 1.8, height: 2.2 },
    defaultColor: "#5C616B",
    description: "Cast-stone rectangular planter box filled with lush flowering shrubs",
  },
  {
    type: "terracotta_planter",
    name: "Large Terracotta Urn",
    category: "planters",
    dimensions: { width: 2.0, depth: 2.0, height: 3.0 },
    defaultColor: "#B55E38",
    description: "Handcrafted Mediterranean clay urn with dwarf palm or citrus",
  },
  {
    type: "bbq_grill",
    name: "Outdoor Barbecue Station",
    category: "utility",
    dimensions: { width: 4.5, depth: 2.2, height: 3.5 },
    defaultColor: "#22252A",
    description: "Stainless steel gas BBQ grill with side prep counter and storage",
  },
  {
    type: "indian_jhula",
    name: "Traditional Hanging Jhula Swing",
    category: "seating",
    dimensions: { width: 5.5, depth: 3.2, height: 6.5 },
    defaultColor: "#8C4F2B",
    description: "Traditional carved wooden garden swing suspended from an ornate brass arch",
  },
  {
    type: "solar_array",
    name: "Photovoltaic Solar Rack",
    category: "utility",
    dimensions: { width: 7.0, depth: 4.5, height: 4.0 },
    defaultColor: "#1A2538",
    description: "Galvanized steel rack holding 4 high-efficiency mono-perc solar panels",
  },
  {
    type: "water_tank",
    name: "Overhead Water Storage Tanks",
    category: "utility",
    dimensions: { width: 4.5, depth: 3.0, height: 5.5 },
    defaultColor: "#1F2228",
    description: "Dual cylindrical heavy-duty UV-shielded overhead water storage tanks",
  },
  {
    type: "outdoor_parasol",
    name: "Cantilever Patio Umbrella",
    category: "shade",
    dimensions: { width: 8.0, depth: 8.0, height: 8.5 },
    defaultColor: "#EAE3D5",
    description: "Wide circular fabric shade parasol with heavy granite ballast base",
  },
];

export function getTerraceFurnitureById(type: string): TerraceFurnitureItem | undefined {
  return TERRACE_FURNITURE_CATALOG.find((item) => item.type === type);
}

export function getFacadePreset(id: FacadeStyleId): FacadePreset | undefined {
  return FACADE_PRESETS.find((preset) => preset.id === id);
}

export function getRailingSpec(id: RailingStyle): RailingSpec | undefined {
  return RAILING_STYLES.find((spec) => spec.id === id);
}

export function getShadingSpec(id: TerraceShadeStructure): ShadingSpec | undefined {
  return SHADING_STRUCTURES.find((spec) => spec.id === id);
}
