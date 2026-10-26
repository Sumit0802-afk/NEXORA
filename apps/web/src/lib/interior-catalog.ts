import type { FurnitureItem, Room, RoomInterior, RoomType } from "@houseplan/design-schema";

export type FurnitureCategory =
  | "bedroom"
  | "living_room"
  | "kitchen"
  | "bathroom"
  | "dining_room"
  | "other";

export interface FurnitureCatalogItem {
  type: string;
  name: string;
  category: FurnitureCategory;
  dimensions: { width: number; depth: number; height: number }; // In standard feet
  defaultColor: string;
  defaultSecondaryColor?: string;
  materials: Array<"wood" | "fabric" | "leather" | "metal" | "marble" | "glass" | "ceramic">;
  description: string;
  iconName: string;
}

/** Complete catalog of architectural furniture items */
export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  // ── Bedroom ────────────────────────────────────────────────────────
  {
    type: "bed_king",
    name: "King Bed",
    category: "bedroom",
    dimensions: { width: 6.5, depth: 7.0, height: 3.5 },
    defaultColor: "#4A4D54",
    defaultSecondaryColor: "#F5F5F0",
    materials: ["fabric", "wood", "leather"],
    description: "Spacious master bed with cushioned headboard and mattress",
    iconName: "BedDouble",
  },
  {
    type: "bed_queen",
    name: "Queen Bed",
    category: "bedroom",
    dimensions: { width: 5.2, depth: 6.8, height: 3.2 },
    defaultColor: "#586273",
    defaultSecondaryColor: "#EDECE8",
    materials: ["fabric", "wood"],
    description: "Standard double bed with linen sheets and upholstered back",
    iconName: "Bed",
  },
  {
    type: "wardrobe",
    name: "3-Door Wardrobe",
    category: "bedroom",
    dimensions: { width: 5.0, depth: 2.0, height: 7.0 },
    defaultColor: "#423934",
    defaultSecondaryColor: "#D6D1CA",
    materials: ["wood", "glass", "metal"],
    description: "Floor-to-ceiling modular wardrobe with metallic handles",
    iconName: "FolderKanban",
  },
  {
    type: "nightstand",
    name: "Bedside Nightstand",
    category: "bedroom",
    dimensions: { width: 1.8, depth: 1.6, height: 1.8 },
    defaultColor: "#52443C",
    materials: ["wood", "metal"],
    description: "Compact dual-drawer bedside side table",
    iconName: "Box",
  },
  {
    type: "dresser",
    name: "Dressing Vanity",
    category: "bedroom",
    dimensions: { width: 4.0, depth: 1.8, height: 4.8 },
    defaultColor: "#5A4E46",
    defaultSecondaryColor: "#C9D4E2",
    materials: ["wood", "glass"],
    description: "Vanity table with frameless mirror and drawers",
    iconName: "Maximize2",
  },

  // ── Living Room ───────────────────────────────────────────────────
  {
    type: "sofa_3seater",
    name: "3-Seater Comfort Sofa",
    category: "living_room",
    dimensions: { width: 7.2, depth: 3.2, height: 2.8 },
    defaultColor: "#394350",
    defaultSecondaryColor: "#EAE7DF",
    materials: ["fabric", "leather"],
    description: "Deep-seated lounge sofa with armrests and throw cushions",
    iconName: "Armchair",
  },
  {
    type: "sofa_sectional",
    name: "L-Sectional Sofa",
    category: "living_room",
    dimensions: { width: 8.5, depth: 6.5, height: 2.8 },
    defaultColor: "#484E59",
    defaultSecondaryColor: "#D4CDC3",
    materials: ["fabric", "leather"],
    description: "Spacious corner chaise lounge sofa for open-plan living",
    iconName: "Armchair",
  },
  {
    type: "coffee_table",
    name: "Modern Coffee Table",
    category: "living_room",
    dimensions: { width: 4.0, depth: 2.2, height: 1.4 },
    defaultColor: "#6B584D",
    defaultSecondaryColor: "#222222",
    materials: ["wood", "marble", "glass"],
    description: "Low-profile center coffee table with sleek metal legs",
    iconName: "Minus",
  },
  {
    type: "tv_unit",
    name: "TV Media Console",
    category: "living_room",
    dimensions: { width: 6.5, depth: 1.6, height: 2.0 },
    defaultColor: "#2E2B2A",
    defaultSecondaryColor: "#111111",
    materials: ["wood", "metal", "glass"],
    description: "Wall-facing entertainment cabinet with 65-inch screen stand",
    iconName: "Tv",
  },
  {
    type: "armchair",
    name: "Lounge Armchair",
    category: "living_room",
    dimensions: { width: 3.0, depth: 3.0, height: 2.9 },
    defaultColor: "#C27854",
    materials: ["fabric", "leather", "wood"],
    description: "Cozy upholstered single armchair with tapered legs",
    iconName: "Armchair",
  },
  {
    type: "bookshelf",
    name: "Display Bookshelf",
    category: "living_room",
    dimensions: { width: 3.6, depth: 1.2, height: 6.5 },
    defaultColor: "#4E4138",
    materials: ["wood", "metal"],
    description: "Open vertical shelving tower for books and curated decor",
    iconName: "Library",
  },

  // ── Kitchen ───────────────────────────────────────────────────────
  {
    type: "kitchen_counter",
    name: "Modular Counter & Cabinets",
    category: "kitchen",
    dimensions: { width: 6.0, depth: 2.2, height: 3.0 },
    defaultColor: "#D0D6DC",
    defaultSecondaryColor: "#2C3138",
    materials: ["marble", "wood", "metal"],
    description: "Polished quartz countertop with under-bench storage cabinets",
    iconName: "LayoutGrid",
  },
  {
    type: "kitchen_sink",
    name: "Kitchen Sink Unit",
    category: "kitchen",
    dimensions: { width: 3.5, depth: 2.2, height: 3.0 },
    defaultColor: "#C9D0D6",
    defaultSecondaryColor: "#8D96A0",
    materials: ["metal", "marble"],
    description: "Double-basin stainless steel sink with swivel gooseneck faucet",
    iconName: "Droplet",
  },
  {
    type: "cooktop_oven",
    name: "Range Cooktop & Oven",
    category: "kitchen",
    dimensions: { width: 2.8, depth: 2.2, height: 3.0 },
    defaultColor: "#25272A",
    defaultSecondaryColor: "#E27B38",
    materials: ["metal", "glass"],
    description: "4-burner gas cooktop with built-in convection oven",
    iconName: "Flame",
  },
  {
    type: "refrigerator",
    name: "French-Door Refrigerator",
    category: "kitchen",
    dimensions: { width: 3.2, depth: 2.8, height: 6.2 },
    defaultColor: "#BAC0C6",
    defaultSecondaryColor: "#1A1C1E",
    materials: ["metal"],
    description: "Stainless steel multi-zone refrigerator freezer",
    iconName: "Refrigerator",
  },
  {
    type: "kitchen_island",
    name: "Kitchen Prep Island",
    category: "kitchen",
    dimensions: { width: 5.5, depth: 3.0, height: 3.0 },
    defaultColor: "#E4E8EB",
    defaultSecondaryColor: "#3F3732",
    materials: ["marble", "wood"],
    description: "Central waterfall marble island with prep space and breakfast bar",
    iconName: "Table",
  },

  // ── Bathroom ──────────────────────────────────────────────────────
  {
    type: "toilet",
    name: "Wall-Hung Toilet",
    category: "bathroom",
    dimensions: { width: 1.8, depth: 2.4, height: 2.6 },
    defaultColor: "#F5F8FA",
    materials: ["ceramic"],
    description: "Vitreous china water closet with dual-flush cistern",
    iconName: "Bath",
  },
  {
    type: "vanity_sink",
    name: "Bathroom Vanity & Mirror",
    category: "bathroom",
    dimensions: { width: 3.2, depth: 1.8, height: 2.8 },
    defaultColor: "#DEE5EC",
    defaultSecondaryColor: "#3B424B",
    materials: ["marble", "wood", "glass"],
    description: "Ceramic undermount basin with mirror and toiletries drawer",
    iconName: "Maximize",
  },
  {
    type: "bathtub",
    name: "Freestanding Soaking Tub",
    category: "bathroom",
    dimensions: { width: 5.5, depth: 2.8, height: 2.0 },
    defaultColor: "#F8FBFD",
    materials: ["ceramic"],
    description: "Organic oval soaking bathtub with floor-mounted mixer tap",
    iconName: "Bath",
  },
  {
    type: "shower_stall",
    name: "Glass Shower Enclosure",
    category: "bathroom",
    dimensions: { width: 3.5, depth: 3.5, height: 7.0 },
    defaultColor: "#8EB4D8",
    defaultSecondaryColor: "#2B323C",
    materials: ["glass", "metal"],
    description: "Frameless tempered glass walk-in shower with rain showerhead",
    iconName: "ShowerHead",
  },

  // ── Dining Room ───────────────────────────────────────────────────
  {
    type: "dining_table_6",
    name: "6-Seater Dining Table",
    category: "dining_room",
    dimensions: { width: 6.0, depth: 3.5, height: 2.5 },
    defaultColor: "#57463D",
    materials: ["wood", "marble", "metal"],
    description: "Solid wood family dining table with beveled edge profile",
    iconName: "Table",
  },
  {
    type: "dining_table_4",
    name: "4-Seater Dining Table",
    category: "dining_room",
    dimensions: { width: 4.2, depth: 3.5, height: 2.5 },
    defaultColor: "#5F4E44",
    materials: ["wood", "glass"],
    description: "Compact four-chair breakfast and dining table",
    iconName: "Table",
  },
  {
    type: "dining_chair",
    name: "Dining Chair",
    category: "dining_room",
    dimensions: { width: 1.6, depth: 1.6, height: 3.0 },
    defaultColor: "#4E4038",
    defaultSecondaryColor: "#DED7CC",
    materials: ["wood", "fabric"],
    description: "Ergonomic dining chair with padded fabric seat",
    iconName: "Armchair",
  },

  // ── Study / Office & Decor ────────────────────────────────────────
  {
    type: "office_desk",
    name: "Executive Study Desk",
    category: "other",
    dimensions: { width: 4.8, depth: 2.4, height: 2.5 },
    defaultColor: "#4D3F36",
    defaultSecondaryColor: "#2A2A2A",
    materials: ["wood", "metal"],
    description: "Spacious computer workstation with cable management",
    iconName: "Laptop",
  },
  {
    type: "office_chair",
    name: "Ergonomic Mesh Chair",
    category: "other",
    dimensions: { width: 2.0, depth: 2.0, height: 3.3 },
    defaultColor: "#292E36",
    materials: ["metal", "fabric"],
    description: "Swivel task chair with lumbar support and armrests",
    iconName: "Armchair",
  },
  {
    type: "floor_lamp",
    name: "Arc Floor Lamp",
    category: "other",
    dimensions: { width: 1.8, depth: 1.8, height: 5.8 },
    defaultColor: "#D9C9A8",
    defaultSecondaryColor: "#212121",
    materials: ["metal", "fabric"],
    description: "Curved metal arc lamp with warm ambient glow shade",
    iconName: "Lamp",
  },
  {
    type: "area_rug",
    name: "Plush Area Rug",
    category: "other",
    dimensions: { width: 6.5, depth: 4.5, height: 0.05 },
    defaultColor: "#D9D2C7",
    materials: ["fabric"],
    description: "Soft woven wool rug with subtle geometric texture",
    iconName: "Square",
  },
  {
    type: "indoor_plant",
    name: "Monstera Potted Plant",
    category: "other",
    dimensions: { width: 1.8, depth: 1.8, height: 3.8 },
    defaultColor: "#3B693A",
    defaultSecondaryColor: "#DDD7CD",
    materials: ["ceramic"],
    description: "Lush architectural greenery in a minimalist ceramic pot",
    iconName: "Trees",
  },
  {
    type: "ceiling_light",
    name: "Pendant Chandelier",
    category: "other",
    dimensions: { width: 2.0, depth: 2.0, height: 2.2 },
    defaultColor: "#E0B354",
    materials: ["metal", "glass"],
    description: "Brushed brass contemporary pendant fixture for dining or living",
    iconName: "Sun",
  },
];

// ── Room Finishes & Interior Styles ─────────────────────────────────

export interface WallFinishOption {
  id: string;
  name: string;
  color: string;
  roughness: number;
  description: string;
}

export const WALL_FINISHES: WallFinishOption[] = [
  { id: "alabaster", name: "Warm Alabaster", color: "#F7F6F2", roughness: 0.45, description: "Gentle soft white with warm undertones" },
  { id: "greige", name: "Nordic Greige", color: "#E5E1D8", roughness: 0.5, description: "Neutral blend of gray and beige for serene living" },
  { id: "sage", name: "Sage Mist", color: "#BDC8BD", roughness: 0.6, description: "Calming botanical green for bedrooms and studies" },
  { id: "navy", name: "Heritage Navy", color: "#2B3C4E", roughness: 0.4, description: "Deep dramatic accent wall for luxury lounges" },
  { id: "terracotta", name: "Earthy Terracotta", color: "#C67858", roughness: 0.7, description: "Warm clay plaster for traditional and Mediterranean accents" },
  { id: "charcoal", name: "Charcoal Slate", color: "#3C4048", roughness: 0.35, description: "Modern architectural contrast" },
  { id: "venetian", name: "Venetian Stucco", color: "#F3ECD9", roughness: 0.65, description: "Textured artisan plaster with soft reflections" },
  { id: "blush", name: "Cashmere Blush", color: "#E8DBD2", roughness: 0.55, description: "Warm muted rose for dressing and bedrooms" },
];

export interface FloorMaterialOption {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  category: "wood" | "marble" | "tile" | "stone";
  description: string;
}

export const FLOOR_MATERIALS: FloorMaterialOption[] = [
  { id: "oak_light", name: "Blonde Oak Hardwood", color: "#D7B58A", roughness: 0.55, metalness: 0.01, category: "wood", description: "Natural light European oak planks" },
  { id: "walnut_dark", name: "American Walnut", color: "#614430", roughness: 0.48, metalness: 0.02, category: "wood", description: "Deep chocolate grain with warm satin finish" },
  { id: "chevron_parquet", name: "Chevron Heritage Parquet", color: "#BA9266", roughness: 0.52, metalness: 0.01, category: "wood", description: "Classic Parisian chevron patterned timber" },
  { id: "carrara_marble", name: "Carrara White Marble", color: "#E5EBEE", roughness: 0.18, metalness: 0.08, category: "marble", description: "Polished Italian white marble with soft grey veining" },
  { id: "terrazzo_honed", name: "Honed Quartz Terrazzo", color: "#D4D9DE", roughness: 0.28, metalness: 0.04, category: "tile", description: "Contemporary terrazzo aggregate with neutral stones" },
  { id: "slate_gray", name: "Basalt Slate Tile", color: "#5C6068", roughness: 0.65, metalness: 0.05, category: "tile", description: "Non-slip matte architectural floor tiles" },
  { id: "travertine_beige", name: "Roman Travertine", color: "#DDD3C2", roughness: 0.58, metalness: 0.02, category: "stone", description: "Textured natural limestone with organic warmth" },
  { id: "teak_deck", name: "Teak Decking", color: "#A87C52", roughness: 0.72, metalness: 0.01, category: "wood", description: "Water-resistant nautical timber planks" },
];

export interface CeilingStyleOption {
  id: string;
  name: string;
  description: string;
}

export const CEILING_STYLES: CeilingStyleOption[] = [
  { id: "plain", name: "Smooth Flat Plaster", description: "Clean flush ceiling matching modern architecture" },
  { id: "cove_light", name: "False Ceiling with Cove Lighting", description: "Recessed tray with warm indirect LED perimeter glow" },
  { id: "coffered", name: "Architectural Coffered Grid", description: "Classic recessed geometric panels for high ceilings" },
  { id: "timber_beams", name: "Exposed Timber Beams", description: "Rustic solid wood rafters adding organic character" },
];

export interface LightingOption {
  id: string;
  name: string;
  kelvin: number;
  color: string;
  description: string;
}

export const LIGHTING_OPTIONS: LightingOption[] = [
  { id: "warm", name: "Warm Ambiance (2700K)", kelvin: 2700, color: "#FFE8D0", description: "Cozy golden light ideal for living rooms and bedrooms" },
  { id: "neutral", name: "Natural Daylight (4000K)", kelvin: 4000, color: "#FFF8F0", description: "Balanced neutral light perfect for kitchens, dining, and baths" },
  { id: "cool", name: "Crisp Focus (5000K)", kelvin: 5000, color: "#F0F5FF", description: "High-alert bright light for home offices and studies" },
  { id: "evening", name: "Golden Sunset (2200K)", kelvin: 2200, color: "#FFD0A8", description: "Soft romantic low-intensity evening glow" },
];

// ── Smart Room Geometry & Helpers ────────────────────────────────────

export function getRoomBounds(polygon: [number, number][]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/** Check if a furniture item fits inside a room and test for clearance issues */
export interface ClearanceValidation {
  isInsideRoom: boolean;
  warnings: string[];
  roomArea: number;
  furnitureArea: number;
  freeSpacePercent: number;
  circulationRating: "optimal" | "acceptable" | "crowded";
}

export function validateRoomFurniture(
  room: Room,
  items: FurnitureItem[],
  doorClearanceZones: Array<{ x: number; y: number; radius: number }> = []
): ClearanceValidation {
  const bounds = getRoomBounds(room.polygon);
  const roomArea = bounds.width * bounds.depth;
  const warnings: string[] = [];

  let totalFurnitureArea = 0;

  items.forEach((item) => {
    const isRotated90 = Math.abs(Math.sin(item.rotation || 0)) > 0.7;
    const rawW = isRotated90 ? item.dimensions.depth : item.dimensions.width;
    const rawD = isRotated90 ? item.dimensions.width : item.dimensions.depth;
    const halfW = (rawW * (item.scale?.[0] || 1)) / 2;
    const halfD = (rawD * (item.scale?.[1] || 1)) / 2;
    const itemArea = item.dimensions.width * item.dimensions.depth * (item.scale?.[0] || 1) * (item.scale?.[1] || 1);
    totalFurnitureArea += itemArea;

    const x = item.position[0];
    const y = item.position[1];

    // Boundary check
    if (x - halfW < bounds.minX - 0.2 || x + halfW > bounds.maxX + 0.2 ||
        y - halfD < bounds.minY - 0.2 || y + halfD > bounds.maxY + 0.2) {
      warnings.push(`"${item.name}" extends slightly outside the walls of ${room.name}.`);
    }

    // Door clearance check
    doorClearanceZones.forEach((door, dIdx) => {
      const dist = Math.hypot(x - door.x, y - door.y);
      if (dist < door.radius + 1.0) {
        warnings.push(`"${item.name}" is close to Door #${dIdx + 1}; ensure clearance for door swing.`);
      }
    });
  });

  // Check pairwise overlapping between furniture items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // Skip area rugs from overlapping check (rug sits under furniture)
      if (a.type === "area_rug" || b.type === "area_rug") continue;

      const aW = (a.dimensions.width * (a.scale[0] || 1)) / 2;
      const aD = (a.dimensions.depth * (a.scale[1] || 1)) / 2;
      const bW = (b.dimensions.width * (b.scale[0] || 1)) / 2;
      const bD = (b.dimensions.depth * (b.scale[1] || 1)) / 2;

      const overlapX = Math.abs(a.position[0] - b.position[0]) < aW + bW - 0.3;
      const overlapY = Math.abs(a.position[1] - b.position[1]) < aD + bD - 0.3;

      if (overlapX && overlapY) {
        warnings.push(`"${a.name}" overlaps with "${b.name}".`);
      }
    }
  }

  const freeSpacePercent = Math.max(0, Math.round(((roomArea - totalFurnitureArea) / roomArea) * 100));
  const circulationRating = freeSpacePercent >= 55 ? "optimal" : freeSpacePercent >= 35 ? "acceptable" : "crowded";

  if (circulationRating === "crowded") {
    warnings.push(`Room is heavily furnished (${100 - freeSpacePercent}% covered). Consider removing an item for smoother walkways.`);
  }

  return {
    isInsideRoom: warnings.filter((w) => w.includes("outside")).length === 0,
    warnings,
    roomArea: Math.round(roomArea * 10) / 10,
    furnitureArea: Math.round(totalFurnitureArea * 10) / 10,
    freeSpacePercent,
    circulationRating,
  };
}

/** Automatically generates an optimized, coordinated furniture layout for a given room */
export function autoFurnishRoom(room: Room, levelId: string): FurnitureItem[] {
  const bounds = getRoomBounds(room.polygon);
  const { minX, minY, maxX, maxY, width, depth, centerX, centerY } = bounds;
  const items: FurnitureItem[] = [];

  const genId = (type: string) => `furn-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  switch (room.type) {
    case "bedroom": {
      // King or Queen bed positioned against back wall (maxY) facing forward (minY)
      const isLarge = width >= 12 && depth >= 12;
      const bedType = isLarge ? "bed_king" : "bed_queen";
      const bedCatalog = FURNITURE_CATALOG.find((c) => c.type === bedType)!;
      const bedY = maxY - bedCatalog.dimensions.depth / 2 - 0.4;

      items.push({
        id: genId(bedType),
        name: bedCatalog.name,
        category: "bedroom",
        type: bedType,
        roomId: room.id,
        levelId,
        position: [centerX, bedY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...bedCatalog.dimensions },
        material: { color: bedCatalog.defaultColor, secondaryColor: bedCatalog.defaultSecondaryColor },
      });

      // Bedside nightstands on left & right
      const nsCatalog = FURNITURE_CATALOG.find((c) => c.type === "nightstand")!;
      const nsOffset = bedCatalog.dimensions.width / 2 + nsCatalog.dimensions.width / 2 + 0.3;
      if (centerX - nsOffset - nsCatalog.dimensions.width / 2 > minX) {
        items.push({
          id: genId("nightstand-l"),
          name: "Left Nightstand",
          category: "bedroom",
          type: "nightstand",
          roomId: room.id,
          levelId,
          position: [centerX - nsOffset, bedY + 1.2, 0],
          rotation: 0,
          scale: [1, 1, 1],
          dimensions: { ...nsCatalog.dimensions },
          material: { color: nsCatalog.defaultColor },
        });
      }
      if (centerX + nsOffset + nsCatalog.dimensions.width / 2 < maxX) {
        items.push({
          id: genId("nightstand-r"),
          name: "Right Nightstand",
          category: "bedroom",
          type: "nightstand",
          roomId: room.id,
          levelId,
          position: [centerX + nsOffset, bedY + 1.2, 0],
          rotation: 0,
          scale: [1, 1, 1],
          dimensions: { ...nsCatalog.dimensions },
          material: { color: nsCatalog.defaultColor },
        });
      }

      // Wardrobe along side wall
      const wardCatalog = FURNITURE_CATALOG.find((c) => c.type === "wardrobe")!;
      if (width >= 11) {
        items.push({
          id: genId("wardrobe"),
          name: wardCatalog.name,
          category: "bedroom",
          type: "wardrobe",
          roomId: room.id,
          levelId,
          position: [minX + wardCatalog.dimensions.depth / 2 + 0.3, centerY, 0],
          rotation: Math.PI / 2,
          scale: [1, 1, 1],
          dimensions: { ...wardCatalog.dimensions },
          material: { color: wardCatalog.defaultColor },
        });
      }

      // Area rug under bed
      const rugCatalog = FURNITURE_CATALOG.find((c) => c.type === "area_rug")!;
      items.push({
        id: genId("rug"),
        name: rugCatalog.name,
        category: "other",
        type: "area_rug",
        roomId: room.id,
        levelId,
        position: [centerX, bedY - 1.2, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...rugCatalog.dimensions },
        material: { color: "#D9D2C7" },
      });
      break;
    }

    case "living_room": {
      // 3-Seater or sectional sofa
      const isWide = width >= 14 && depth >= 14;
      const sofaType = isWide ? "sofa_sectional" : "sofa_3seater";
      const sofaCatalog = FURNITURE_CATALOG.find((c) => c.type === sofaType)!;
      const sofaY = maxY - sofaCatalog.dimensions.depth / 2 - 0.8;

      items.push({
        id: genId(sofaType),
        name: sofaCatalog.name,
        category: "living_room",
        type: sofaType,
        roomId: room.id,
        levelId,
        position: [centerX, sofaY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...sofaCatalog.dimensions },
        material: { color: sofaCatalog.defaultColor, secondaryColor: sofaCatalog.defaultSecondaryColor },
      });

      // Coffee table in center
      const ctCatalog = FURNITURE_CATALOG.find((c) => c.type === "coffee_table")!;
      const ctY = sofaY - sofaCatalog.dimensions.depth / 2 - ctCatalog.dimensions.depth / 2 - 1.2;
      items.push({
        id: genId("coffee_table"),
        name: ctCatalog.name,
        category: "living_room",
        type: "coffee_table",
        roomId: room.id,
        levelId,
        position: [centerX, ctY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...ctCatalog.dimensions },
        material: { color: ctCatalog.defaultColor },
      });

      // TV unit on front wall
      const tvCatalog = FURNITURE_CATALOG.find((c) => c.type === "tv_unit")!;
      const tvY = minY + tvCatalog.dimensions.depth / 2 + 0.4;
      items.push({
        id: genId("tv_unit"),
        name: tvCatalog.name,
        category: "living_room",
        type: "tv_unit",
        roomId: room.id,
        levelId,
        position: [centerX, tvY, 0],
        rotation: Math.PI,
        scale: [1, 1, 1],
        dimensions: { ...tvCatalog.dimensions },
        material: { color: tvCatalog.defaultColor },
      });

      // Accent plant in corner
      const plantCatalog = FURNITURE_CATALOG.find((c) => c.type === "indoor_plant")!;
      items.push({
        id: genId("plant"),
        name: plantCatalog.name,
        category: "other",
        type: "indoor_plant",
        roomId: room.id,
        levelId,
        position: [maxX - 1.5, maxY - 1.5, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...plantCatalog.dimensions },
        material: { color: plantCatalog.defaultColor },
      });
      break;
    }

    case "kitchen": {
      // Countertop along the rear wall
      const kcCatalog = FURNITURE_CATALOG.find((c) => c.type === "kitchen_counter")!;
      const kcWidth = Math.min(width - 1.0, 7.0);
      items.push({
        id: genId("kitchen_counter"),
        name: kcCatalog.name,
        category: "kitchen",
        type: "kitchen_counter",
        roomId: room.id,
        levelId,
        position: [centerX - 1.0, maxY - kcCatalog.dimensions.depth / 2 - 0.3, 0],
        rotation: 0,
        scale: [kcWidth / kcCatalog.dimensions.width, 1, 1],
        dimensions: { ...kcCatalog.dimensions, width: kcWidth },
        material: { color: kcCatalog.defaultColor },
      });

      // Refrigerator in corner
      const fridgeCatalog = FURNITURE_CATALOG.find((c) => c.type === "refrigerator")!;
      items.push({
        id: genId("fridge"),
        name: fridgeCatalog.name,
        category: "kitchen",
        type: "refrigerator",
        roomId: room.id,
        levelId,
        position: [maxX - fridgeCatalog.dimensions.width / 2 - 0.4, maxY - fridgeCatalog.dimensions.depth / 2 - 0.4, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...fridgeCatalog.dimensions },
        material: { color: fridgeCatalog.defaultColor },
      });

      // Sink on side wall
      const sinkCatalog = FURNITURE_CATALOG.find((c) => c.type === "kitchen_sink")!;
      items.push({
        id: genId("sink"),
        name: sinkCatalog.name,
        category: "kitchen",
        type: "kitchen_sink",
        roomId: room.id,
        levelId,
        position: [minX + sinkCatalog.dimensions.depth / 2 + 0.3, centerY, 0],
        rotation: Math.PI / 2,
        scale: [1, 1, 1],
        dimensions: { ...sinkCatalog.dimensions },
        material: { color: sinkCatalog.defaultColor },
      });
      break;
    }

    case "bathroom": {
      // Vanity washbasin
      const vanityCatalog = FURNITURE_CATALOG.find((c) => c.type === "vanity_sink")!;
      items.push({
        id: genId("vanity"),
        name: vanityCatalog.name,
        category: "bathroom",
        type: "vanity_sink",
        roomId: room.id,
        levelId,
        position: [minX + vanityCatalog.dimensions.width / 2 + 0.4, maxY - vanityCatalog.dimensions.depth / 2 - 0.4, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...vanityCatalog.dimensions },
        material: { color: vanityCatalog.defaultColor },
      });

      // Toilet alongside
      const toiletCatalog = FURNITURE_CATALOG.find((c) => c.type === "toilet")!;
      items.push({
        id: genId("toilet"),
        name: toiletCatalog.name,
        category: "bathroom",
        type: "toilet",
        roomId: room.id,
        levelId,
        position: [maxX - toiletCatalog.dimensions.width / 2 - 0.4, maxY - toiletCatalog.dimensions.depth / 2 - 0.4, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...toiletCatalog.dimensions },
        material: { color: toiletCatalog.defaultColor },
      });

      // Bathtub or shower enclosure
      if (width >= 8 && depth >= 7) {
        const tubCatalog = FURNITURE_CATALOG.find((c) => c.type === "bathtub")!;
        items.push({
          id: genId("bathtub"),
          name: tubCatalog.name,
          category: "bathroom",
          type: "bathtub",
          roomId: room.id,
          levelId,
          position: [centerX, minY + tubCatalog.dimensions.depth / 2 + 0.4, 0],
          rotation: 0,
          scale: [1, 1, 1],
          dimensions: { ...tubCatalog.dimensions },
          material: { color: tubCatalog.defaultColor },
        });
      } else {
        const showerCatalog = FURNITURE_CATALOG.find((c) => c.type === "shower_stall")!;
        items.push({
          id: genId("shower"),
          name: showerCatalog.name,
          category: "bathroom",
          type: "shower_stall",
          roomId: room.id,
          levelId,
          position: [minX + showerCatalog.dimensions.width / 2 + 0.3, minY + showerCatalog.dimensions.depth / 2 + 0.3, 0],
          rotation: 0,
          scale: [1, 1, 1],
          dimensions: { ...showerCatalog.dimensions },
          material: { color: showerCatalog.defaultColor },
        });
      }
      break;
    }

    case "dining_room": {
      // 6 or 4 seater table in the center
      const isLarge = width >= 11 && depth >= 11;
      const tableType = isLarge ? "dining_table_6" : "dining_table_4";
      const tableCatalog = FURNITURE_CATALOG.find((c) => c.type === tableType)!;

      items.push({
        id: genId(tableType),
        name: tableCatalog.name,
        category: "dining_room",
        type: tableType,
        roomId: room.id,
        levelId,
        position: [centerX, centerY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...tableCatalog.dimensions },
        material: { color: tableCatalog.defaultColor },
      });

      // Pendant lamp directly above dining table
      const lampCatalog = FURNITURE_CATALOG.find((c) => c.type === "ceiling_light")!;
      items.push({
        id: genId("pendant"),
        name: lampCatalog.name,
        category: "other",
        type: "ceiling_light",
        roomId: room.id,
        levelId,
        position: [centerX, centerY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...lampCatalog.dimensions },
        material: { color: lampCatalog.defaultColor },
      });
      break;
    }

    case "study": {
      // Office desk
      const deskCatalog = FURNITURE_CATALOG.find((c) => c.type === "office_desk")!;
      const deskY = maxY - deskCatalog.dimensions.depth / 2 - 0.6;
      items.push({
        id: genId("desk"),
        name: deskCatalog.name,
        category: "other",
        type: "office_desk",
        roomId: room.id,
        levelId,
        position: [centerX, deskY, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...deskCatalog.dimensions },
        material: { color: deskCatalog.defaultColor },
      });

      // Ergonomic chair
      const chairCatalog = FURNITURE_CATALOG.find((c) => c.type === "office_chair")!;
      items.push({
        id: genId("chair"),
        name: chairCatalog.name,
        category: "other",
        type: "office_chair",
        roomId: room.id,
        levelId,
        position: [centerX, deskY - deskCatalog.dimensions.depth / 2 - 1.2, 0],
        rotation: 0,
        scale: [1, 1, 1],
        dimensions: { ...chairCatalog.dimensions },
        material: { color: chairCatalog.defaultColor },
      });

      // Bookshelf
      const bookCatalog = FURNITURE_CATALOG.find((c) => c.type === "bookshelf")!;
      items.push({
        id: genId("bookshelf"),
        name: bookCatalog.name,
        category: "living_room",
        type: "bookshelf",
        roomId: room.id,
        levelId,
        position: [minX + bookCatalog.dimensions.depth / 2 + 0.3, centerY, 0],
        rotation: Math.PI / 2,
        scale: [1, 1, 1],
        dimensions: { ...bookCatalog.dimensions },
        material: { color: bookCatalog.defaultColor },
      });
      break;
    }

    default:
      break;
  }

  return items;
}

/** Furniture categories that make sense for a room type (e.g. no beds in a bathroom). */
export function categoriesForRoom(type: RoomType): FurnitureCategory[] {
  switch (type) {
    case "bedroom": return ["bedroom", "other"];
    case "kitchen": return ["kitchen", "dining_room"];
    case "bathroom": return ["bathroom"];
    case "living_room": return ["living_room", "other"];
    case "dining_room": return ["dining_room", "living_room"];
    case "study": return ["other", "living_room"];
    default: return ["other"];
  }
}

/** Catalog items suited to a room type. */
export function catalogForRoom(type: RoomType): FurnitureCatalogItem[] {
  const cats = categoriesForRoom(type);
  return FURNITURE_CATALOG.filter((item) => cats.includes(item.category));
}
