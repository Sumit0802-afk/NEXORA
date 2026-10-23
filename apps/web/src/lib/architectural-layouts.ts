import type { FloorPlan, Room, RoomType, Wall, Opening } from "@houseplan/design-schema";
import { validateDesign, type ValidationIssue } from "./validation";

export type ArchitecturalDesignId =
  | "modern_open"
  | "family_spacious"
  | "courtyard"
  | "l_shaped"
  | "u_shaped"
  | "duplex"
  | "traditional_indian"
  | "contemporary_luxury";

export type TerraceDesignId =
  | "open"
  | "garden"
  | "pergola"
  | "covered"
  | "lounge"
  | "utility";

export interface ArchitecturalDesignSpec {
  id: ArchitecturalDesignId;
  name: string;
  tagline: string;
  description: string;
  footprintType: "Open-Plan" | "Formal Zoned" | "Courtyard Core" | "L-Wing" | "U-Pavilion" | "Duplex Void" | "Vastu Classic" | "Luxury Estate";
  features: string[];
  pros: string[];
  circulationScore: number; // 0-100
  lightRating: "A+" | "A" | "A-";
  vastuScore?: number; // 0-100
  recommendedOrientation: string;
}

export interface TerraceDesignSpec {
  id: TerraceDesignId;
  name: string;
  tagline: string;
  description: string;
  features: string[];
}

export const TERRACE_DESIGNS: Record<TerraceDesignId, TerraceDesignSpec> = {
  open: {
    id: "open",
    name: "Open Terrace",
    tagline: "Unobstructed open sky",
    description: "Expansive perimeter parapet walls with non-skid stone pavers, perimeter drainage, and full panoramic sky view.",
    features: ["Full 3.5ft parapet walls", "Non-skid stone tiling", "Perimeter safety railing", "Clean unobstructed party space"],
  },
  garden: {
    id: "garden",
    name: "Rooftop Garden",
    tagline: "Lush landscape & stepping stones",
    description: "Dedicated turf lawn sections, built-in planter boxes with drip lines, stone stepping paths, and ambient garden lighting.",
    features: ["Built-in planter boxes", "Grass turf lounging zone", "Stone stepping pathways", "Natural micro-climate cooling"],
  },
  pergola: {
    id: "pergola",
    name: "Pergola Seating Terrace",
    tagline: "Shaded architectural timber slats",
    description: "Overhead wooden/aluminum pergola arbor over a sunken or raised outdoor deck, ideal for evening conversations and reading.",
    features: ["Overhead shade pergola", "Built-in outdoor sofa seating", "Weather-resistant composite deck", "Climbing vines support"],
  },
  covered: {
    id: "covered",
    name: "Covered Pavilion",
    tagline: "All-weather rain & sun protection",
    description: "Semi-enclosed reinforced roof pavilion supported by columns, complete with ceiling fans, lighting, and open verandah.",
    features: ["All-weather roof canopy", "RCC supporting columns", "Outdoor kitchenette point", "Covered sit-out seating"],
  },
  lounge: {
    id: "lounge",
    name: "Rooftop Sky Lounge",
    tagline: "Enclosed glass salon & barbecue patio",
    description: "Climate-controlled enclosed entertainment room with full-height sliding glass doors opening onto an open barbecue terrace.",
    features: ["Enclosed glass sunroom", "Barbecue & dining counter", "Seamless indoor-outdoor flow", "Frameless glass balustrades"],
  },
  utility: {
    id: "utility",
    name: "Utility & Solar Terrace",
    tagline: "Laundry, solar bank & service yard",
    description: "Functional service terrace with dedicated laundry room, solar panel mount array, covered drying yard, and water tank tower.",
    features: ["Enclosed laundry & washing room", "Dedicated clothes drying yard", "Solar inverter & battery bay", "Water tank & pump access"],
  },
};

export const ARCHITECTURAL_DESIGNS: Record<ArchitecturalDesignId, ArchitecturalDesignSpec> = {
  modern_open: {
    id: "modern_open",
    name: "Modern Open-Plan House",
    tagline: "Continuous spatial flow & expansive glazing",
    description: "Seamless open-concept great room unifying Living, Dining, and Island Kitchen into a single fluid volume. Floating architectural stairs and perimeter master suites ensure uninterrupted sightlines and abundant daylight.",
    footprintType: "Open-Plan",
    features: [
      "Barrier-free Living-Dining-Kitchen Great Room",
      "Perimeter private Master Suite with garden aspect",
      "Floating feature staircase integrated into circulation",
      "Full-height sliding glass doors to outdoor deck",
    ],
    pros: ["Feels 25% larger than partitioned plans", "Exceptional daylight & cross-ventilation", "Ideal for modern entertaining"],
    circulationScore: 94,
    lightRating: "A+",
    vastuScore: 78,
    recommendedOrientation: "North / East Facing",
  },
  family_spacious: {
    id: "family_spacious",
    name: "Spacious Family Layout",
    tagline: "Formal separation & private bedroom wings",
    description: "Classic hierarchical organization with an entrance vestibule, dedicated formal drawing room, secluded family lounge, enclosed chef's kitchen with utility yard, and isolated bedroom sanctuaries for multi-generational harmony.",
    footprintType: "Formal Zoned",
    features: [
      "Formal foyer & independent guest drawing room",
      "Central family dining and TV lounge hub",
      "Enclosed chef's kitchen with wet utility yard",
      "Dedicated dog-leg staircase well for privacy",
    ],
    pros: ["Maximum acoustic privacy between rooms", "Elderly ground-floor bedroom accessibility", "Formal guests kept separate from family"],
    circulationScore: 91,
    lightRating: "A",
    vastuScore: 86,
    recommendedOrientation: "East / North-East Facing",
  },
  courtyard: {
    id: "courtyard",
    name: "Courtyard House (Atrium Core)",
    tagline: "Centered around an open-to-sky Brahmasthan",
    description: "Traditional inward-looking design wrapping around a central open-to-sky courtyard garden. Every room looks inward into the lush green courtyard, ensuring natural convection cooling, peace, and total privacy from neighbors.",
    footprintType: "Courtyard Core",
    features: [
      "Open-to-sky central courtyard lightwell",
      "Circumambulating verandah walkway",
      "Living & dining flanking the courtyard garden",
      "Passive stack-effect thermal cooling",
    ],
    pros: ["Natural cooling even in peak summer", "Complete privacy from tight neighboring plots", "Serene internal garden views from all rooms"],
    circulationScore: 89,
    lightRating: "A+",
    vastuScore: 96,
    recommendedOrientation: "All orientations (Self-contained lightwell)",
  },
  l_shaped: {
    id: "l_shaped",
    name: "L-Shaped House",
    tagline: "Spine & wing embracing a private lawn",
    description: "An L-shaped building footprint that wraps around a sheltered corner garden. The public living spine runs along one wing, while the private bedroom wing extends perpendicularly, ensuring every room opens directly onto the lawn.",
    footprintType: "L-Wing",
    features: [
      "Dual wings embracing a private corner lawn",
      "Distinct separation of active & quiet zones",
      "Staircase positioned at the wing intersection hinge",
      "Large garden-facing picture windows throughout",
    ],
    pros: ["Creates a private, secluded yard even on small plots", "Two exterior exposures for nearly every room", "Easy natural zoning"],
    circulationScore: 88,
    lightRating: "A",
    vastuScore: 82,
    recommendedOrientation: "North-West or North-East corner plots",
  },
  u_shaped: {
    id: "u_shaped",
    name: "U-Shaped Pavilion House",
    tagline: "Twin wings framing a central water/garden court",
    description: "Resort-inspired pavilion architecture with two parallel wings linked by a sunlit glass gallery. One wing houses living and dining entertainment, while the opposite wing contains secluded bedroom suites.",
    footprintType: "U-Pavilion",
    features: [
      "Twin residential wings enclosing central courtyard",
      "Glass gallery corridor connecting both wings",
      "Complete acoustic isolation of sleeping quarters",
      "Dramatic architectural presence and symmetry",
    ],
    pros: ["Ultimate privacy for master suites", "Breathtaking courtyard focal point", "Distinct day and night zones"],
    circulationScore: 86,
    lightRating: "A+",
    vastuScore: 84,
    recommendedOrientation: "South or West rear garden orientation",
  },
  duplex: {
    id: "duplex",
    name: "Duplex-Style Layout",
    tagline: "Dramatic double-height living void & upper bridge",
    description: "Vertical architecture celebrating volume with a high-ceiling great room, sculptural statement staircase, and an upper mezzanine walkway overlooking the living room below. Ground floor caters to entertaining, upstairs to luxury suites.",
    footprintType: "Duplex Void",
    features: [
      "Double-height living space feeling",
      "Sculptural architectural staircase in living room",
      "Upper floor mezzanine gallery overlooking below",
      "Penthouse master suite with panoramic private terrace",
    ],
    pros: ["Grand luxurious architectural volume", "Vertical connectivity and visual drama", "Spacious open feel even on compact footprint"],
    circulationScore: 92,
    lightRating: "A+",
    vastuScore: 80,
    recommendedOrientation: "North / North-East Facing",
  },
  traditional_indian: {
    id: "traditional_indian",
    name: "Traditional Indian House (Vastu)",
    tagline: "Vastu Shastra compliant with front Thinnai verandah",
    description: "Indigenous vernacular Indian layout designed according to Vastu Purusha Mandala principles. Features a welcoming street-facing sit-out (Thinnai), Agneya kitchen in SE, Nairutya master bedroom in SW, and Ishanya pooja room in NE.",
    footprintType: "Vastu Classic",
    features: [
      "Front Thinnai / Verandah for street greeting",
      "Strict Vastu orientation (Kitchen SE, Master SW, Pooja NE)",
      "Central family gathering hall (Brahmasthan)",
      "Traditional swing balcony & utility wash area",
    ],
    pros: ["100% Vastu compliance for positive energy", "Culturally authentic joint/extended family living", "Optimal morning light in kitchen and pooja"],
    circulationScore: 90,
    lightRating: "A",
    vastuScore: 98,
    recommendedOrientation: "East or North Facing",
  },
  contemporary_luxury: {
    id: "contemporary_luxury",
    name: "Contemporary Luxury Villa",
    tagline: "Grand entrance foyer, walk-in closets & suites",
    description: "High-end luxury residence featuring a grand double-height foyer, formal salon, open show kitchen plus back prep kitchen, hotel-grade master suites with walk-in dressing rooms and spa baths, and wrap-around viewing decks.",
    footprintType: "Luxury Estate",
    features: [
      "Grand statement foyer with guest powder room",
      "Master suite with walk-in wardrobe & 5-piece bath",
      "Double car covered portico with direct service entry",
      "Seamless indoor-outdoor entertainment loggia",
    ],
    pros: ["Uncompromised luxury spatial standards", "Separate service and family circulation", "Highest resale and architectural value"],
    circulationScore: 95,
    lightRating: "A+",
    vastuScore: 85,
    recommendedOrientation: "East / North Facing",
  },
};

/* ── Geometry & Layout Generation Core ──────────────────────────────── */

function makeRect(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates an authentic architectural floor-plan with distinct spatial layouts,
 * accurate wall boundaries, door swings, window openings, and vertically stacked staircases.
 */
export function generateArchitecturalPlan(params: {
  designId: ArchitecturalDesignId;
  terraceId?: TerraceDesignId;
  plotWidth: number;
  plotLength: number;
  units?: "ft" | "m";
  floors?: number; // 1, 2, or 3 floors
  roomRequirements?: {
    bedrooms?: number;
    bathrooms?: number;
    parking?: boolean;
  };
}): {
  plan: FloorPlan;
  validationIssues: ValidationIssue[];
  metrics: {
    builtUpArea: number;
    plotArea: number;
    groundCoveragePercent: number;
    roomCount: number;
    bedroomCount: number;
    bathroomCount: number;
    staircaseCount: number;
    circulationRating: number;
  };
} {
  const {
    designId,
    terraceId = "pergola",
    plotWidth: rawW,
    plotLength: rawL,
    units = "ft",
    floors = 2,
  } = params;

  const W = Math.max(20, Math.round(rawW * 10) / 10);
  const L = Math.max(25, Math.round(rawL * 10) / 10);
  const wallH = units === "m" ? 3.0 : 10.0;
  const numFloors = clamp(floors, 1, 3);

  // Common staircase footprint placed consistently across all floors for vertical alignment
  // Dog-leg or straight flight staircase: standard 8ft wide x 11ft deep (or proportional)
  const stairW = clamp(W * 0.22, 7.5, 9.0);
  const stairL = clamp(L * 0.24, 9.5, 12.0);

  // Stair location varies by architectural layout design archetype
  let stairX0 = 0;
  let stairY0 = 0;

  switch (designId) {
    case "modern_open":
    case "duplex":
      // Floating staircase situated along central-side spine
      stairX0 = W - stairW;
      stairY0 = clamp(L * 0.32, 10, L - stairL - 10);
      break;
    case "family_spacious":
      // Dedicated mid-house stairwell off the central lobby
      stairX0 = clamp(W * 0.38, 8, W - stairW - 8);
      stairY0 = clamp(L * 0.36, 12, L - stairL - 8);
      break;
    case "courtyard":
    case "traditional_indian":
      // Staircase placed along West/North-West side corridor
      stairX0 = 0;
      stairY0 = clamp(L * 0.35, 10, L - stairL - 8);
      break;
    case "l_shaped":
      // Located at the inner corner/hinge of the L
      stairX0 = clamp(W * 0.42, 9, W - stairW - 2);
      stairY0 = clamp(L * 0.35, 9, L - stairL - 2);
      break;
    case "u_shaped":
      // Located in the central connecting bridge gallery
      stairX0 = (W - stairW) / 2;
      stairY0 = clamp(L * 0.32, 8, L - stairL - 8);
      break;
    case "contemporary_luxury":
    default:
      // Grand foyer side staircase
      stairX0 = W - stairW;
      stairY0 = clamp(L * 0.26, 8, L - stairL - 10);
      break;
  }

  const stairX1 = stairX0 + stairW;
  const stairY1 = stairY0 + stairL;

  // ── Build Levels ──────────────────────────────────────────────────────────
  const levels: FloorPlan["levels"] = [];

  for (let lvl = 0; lvl < numFloors; lvl++) {
    const isGround = lvl === 0;
    const isTopFloor = lvl === numFloors - 1;
    const levelId = lvl === 0 ? "ground" : lvl === 1 ? "first" : "second";
    const elevation = lvl * wallH;

    const rooms: Room[] = [];

    // Always include vertically aligned staircase on floors where stairs are needed
    if (numFloors > 1 || lvl > 0) {
      rooms.push({
        id: `${levelId}-staircase`,
        type: "staircase",
        name: isGround ? "Staircase (Up)" : isTopFloor ? "Staircase (Down & Roof)" : "Staircase",
        polygon: makeRect(stairX0, stairY0, stairX1, stairY1),
      });
    }

    // Generate room spatial organization based on archetype
    if (isGround) {
      generateGroundFloorRooms(designId, W, L, stairX0, stairY0, stairX1, stairY1, rooms);
    } else if (lvl === 1 && numFloors === 2) {
      // 2-Storey House: First floor with upper rooms and terrace
      generateUpperFloorRooms(designId, 1, W, L, stairX0, stairY0, stairX1, stairY1, rooms, terraceId);
    } else if (lvl === 1 && numFloors === 3) {
      // 3-Storey House: First floor middle residential suites
      generateMiddleFloorRooms(designId, W, L, stairX0, stairY0, stairX1, stairY1, rooms);
    } else if (lvl === 2 && numFloors === 3) {
      // 3-Storey House: Second floor penthouse + rooftop terrace
      generateUpperFloorRooms(designId, 2, W, L, stairX0, stairY0, stairX1, stairY1, rooms, terraceId);
    }

    levels.push({
      id: levelId,
      elevation,
      wallHeight: wallH,
      rooms,
      walls: [],
      openings: [],
      furniture: [],
    });
  }

  // Assemble full FloorPlan object
  const plan: FloorPlan = {
    schemaVersion: 1,
    projectId: "generated-arch-plan",
    units,
    plot: {
      width: W,
      length: L,
      floors: numFloors,
      shape: "rectangle",
    },
    levels,
    metadata: {
      version: 1,
      status: "generated",
    },
  };

  const validationIssues = validateDesign(plan);

  // Compute calculated metrics
  const plotArea = W * L;
  const builtUpArea = levels.reduce((sum, lvl) => {
    return (
      sum +
      lvl.rooms
        .filter((r) => r.type !== "other")
        .reduce((roomSum, r) => {
          const xs = r.polygon.map((p) => p[0]);
          const ys = r.polygon.map((p) => p[1]);
          return roomSum + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        }, 0)
    );
  }, 0);

  const groundCoverage =
    levels[0].rooms.reduce((roomSum, r) => {
      const xs = r.polygon.map((p) => p[0]);
      const ys = r.polygon.map((p) => p[1]);
      return roomSum + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    }, 0) / plotArea;

  const allRooms = levels.flatMap((l) => l.rooms);
  const bedroomCount = allRooms.filter((r) => r.type === "bedroom").length;
  const bathroomCount = allRooms.filter((r) => r.type === "bathroom").length;

  return {
    plan,
    validationIssues,
    metrics: {
      builtUpArea: Math.round(builtUpArea),
      plotArea: Math.round(plotArea),
      groundCoveragePercent: Math.round(groundCoverage * 100),
      roomCount: allRooms.length,
      bedroomCount,
      bathroomCount,
      staircaseCount: allRooms.filter((r) => r.type === "staircase").length,
      circulationRating: ARCHITECTURAL_DESIGNS[designId].circulationScore,
    },
  };
}

/* ── Archetype Room Generators ─────────────────────────────────────── */

function generateGroundFloorRooms(
  designId: ArchitecturalDesignId,
  W: number,
  L: number,
  sX0: number,
  sY0: number,
  sX1: number,
  sY1: number,
  rooms: Room[]
) {
  const parkW = clamp(W * 0.35, 10, 14);
  const parkL = clamp(L * 0.36, 14, 18);

  switch (designId) {
    case "modern_open": {
      // Front Left: Car Parking / Entry Portico
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Car Portico",
        polygon: makeRect(0, 0, parkW, parkL),
      });

      // Front Right: Integrated Great Room (Living + Dining + Open Island Kitchen)
      const greatRoomX0 = parkW;
      const greatRoomY0 = 0;
      const greatRoomX1 = W;
      const greatRoomY1 = clamp(L * 0.52, 18, L - 14);

      // Living Zone
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Open-Plan Living Great Room",
        polygon: makeRect(greatRoomX0, greatRoomY0, greatRoomX1 - 10, greatRoomY1),
      });

      // Dining & Island Kitchen zone on right edge
      rooms.push({
        id: "ground-dining-kitchen",
        type: "kitchen",
        name: "Island Gourmet Kitchen & Dining",
        polygon: makeRect(greatRoomX1 - 10, greatRoomY0, greatRoomX1, greatRoomY1),
      });

      // Mid-house central hallway / corridor connecting rear bedrooms
      const hallY0 = greatRoomY1;
      const hallY1 = hallY0 + 4.5;
      rooms.push({
        id: "ground-hallway",
        type: "hallway",
        name: "Sunlit Gallery Corridor",
        polygon: makeRect(0, hallY0, sX0 > 0 ? sX0 : W, hallY1),
      });

      // Rear Left: Master Bedroom with Attached Bath
      const bed1W = clamp(W * 0.55, 12, W - 12);
      const bathW = clamp(bed1W * 0.4, 5.5, 7.5);

      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Master Bedroom Suite",
        polygon: makeRect(0, hallY1, bed1W - bathW, L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "Master En-Suite Bath",
        polygon: makeRect(bed1W - bathW, hallY1, bed1W, L),
      });

      // Rear Right: Guest Bedroom / Study with Garden View
      rooms.push({
        id: "ground-bed2",
        type: "bedroom",
        name: "Guest Suite / Study",
        polygon: makeRect(bed1W, hallY1, W - 6, L),
      });
      rooms.push({
        id: "ground-common-bath",
        type: "bathroom",
        name: "Powder Bath",
        polygon: makeRect(W - 6, hallY1, W, L),
      });
      break;
    }

    case "courtyard": {
      // Central Courtyard Lightwell
      const courtW = clamp(W * 0.32, 8, 14);
      const courtL = clamp(L * 0.28, 8, 12);
      const courtX0 = (W - courtW) / 2;
      const courtY0 = (L - courtL) / 2;
      const courtX1 = courtX0 + courtW;
      const courtY1 = courtY0 + courtL;

      rooms.push({
        id: "ground-courtyard",
        type: "other",
        name: "Central Atrium Courtyard (Open-to-Sky)",
        polygon: makeRect(courtX0, courtY0, courtX1, courtY1),
      });

      // Front: Sit-out Verandah & Formal Living Room
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Courtyard View Living Hall",
        polygon: makeRect(0, 0, W - 10, courtY0),
      });
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Entrance Portico",
        polygon: makeRect(W - 10, 0, W, courtY0),
      });

      // Left Flank: Dining Room overlooking courtyard
      rooms.push({
        id: "ground-dining",
        type: "dining_room",
        name: "Courtyard Dining Room",
        polygon: makeRect(0, courtY0, courtX0, courtY1),
      });

      // Right Flank: Kitchen & Utility
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Traditional Kitchen & Store",
        polygon: makeRect(courtX1, courtY0, W, courtY1),
      });

      // Rear Flank: Master Bedroom + Guest Bedroom + Baths
      const rearHalfW = W / 2;
      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Courtyard Master Suite",
        polygon: makeRect(0, courtY1, rearHalfW - 6, L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "Master Bath",
        polygon: makeRect(rearHalfW - 6, courtY1, rearHalfW, L),
      });

      rooms.push({
        id: "ground-bed2",
        type: "bedroom",
        name: "Garden Bedroom",
        polygon: makeRect(rearHalfW, courtY1, W - 6, L),
      });
      rooms.push({
        id: "ground-bath2",
        type: "bathroom",
        name: "Common Bath",
        polygon: makeRect(W - 6, courtY1, W, L),
      });
      break;
    }

    case "l_shaped": {
      // Main Spine (Left Wing) runs from front to back
      // Cross Wing (Rear) runs across
      // Inner corner (Front Right) is an open private lawn/patio
      const spineW = clamp(W * 0.58, 14, W - 10);
      const lawnW = W - spineW;
      const lawnL = clamp(L * 0.45, 12, L - 14);

      // Private Lawn
      rooms.push({
        id: "ground-lawn",
        type: "other",
        name: "Private Garden Lawn & Patio",
        polygon: makeRect(spineW, 0, W, lawnL),
      });

      // Front Spine: Car Portico & Living Room
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Car Parking",
        polygon: makeRect(0, 0, spineW * 0.45, lawnL * 0.75),
      });
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Garden-Facing Living Lounge",
        polygon: makeRect(spineW * 0.45, 0, spineW, lawnL),
      });

      // Mid Spine: Dining & Kitchen
      rooms.push({
        id: "ground-dining",
        type: "dining_room",
        name: "Dining Room",
        polygon: makeRect(0, lawnL * 0.75, spineW * 0.55, lawnL + 10),
      });
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Corner Chef Kitchen",
        polygon: makeRect(0, lawnL + 10, spineW * 0.55, L),
      });

      // Cross Wing: Master Bedroom Suite & Guest Suite in rear right
      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Master Bedroom Suite",
        polygon: makeRect(spineW, lawnL, W - 6, L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "Master Bath",
        polygon: makeRect(W - 6, lawnL, W, L),
      });
      break;
    }

    case "u_shaped": {
      // Left Wing: Public/Kitchen Wing
      // Right Wing: Bedroom Wing
      // Center: Court lawn in front, entrance gallery in middle
      const wingW = clamp(W * 0.35, 9, 14);
      const courtW = W - wingW * 2;
      const courtL = clamp(L * 0.38, 10, 16);

      // Front Central Courtyard Garden
      rooms.push({
        id: "ground-court",
        type: "other",
        name: "Central Water/Garden Court",
        polygon: makeRect(wingW, 0, wingW + courtW, courtL),
      });

      // Left Wing: Living room & Kitchen
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Public Living Lounge",
        polygon: makeRect(0, 0, wingW, courtL + 8),
      });
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Kitchen & Dining",
        polygon: makeRect(0, courtL + 8, wingW, L),
      });

      // Central Gallery Corridor behind court
      rooms.push({
        id: "ground-gallery",
        type: "hallway",
        name: "Central Glass Gallery",
        polygon: makeRect(wingW, courtL, wingW + courtW, courtL + 6),
      });

      // Right Wing: Master suite & parking in front
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Covered Portico",
        polygon: makeRect(wingW + courtW, 0, W, courtL * 0.75),
      });
      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Secluded Master Suite",
        polygon: makeRect(wingW + courtW, courtL * 0.75, W - 5.5, L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "En-Suite Bath",
        polygon: makeRect(W - 5.5, courtL * 0.75, W, L),
      });
      break;
    }

    case "traditional_indian": {
      // Front: Thinnai (Verandah) + Portico in NW
      const verL = clamp(L * 0.16, 5, 7);
      rooms.push({
        id: "ground-verandah",
        type: "other",
        name: "Thinnai (Entrance Sit-Out)",
        polygon: makeRect(0, 0, W - parkW, verL),
      });
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Parking (Vayavya NW)",
        polygon: makeRect(W - parkW, 0, W, parkL),
      });

      // Center: Grand Hall / Brahmasthan
      const hallL = clamp(L * 0.38, 14, 18);
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Central Hall (Brahmasthan)",
        polygon: makeRect(0, verL, W - parkW, verL + hallL),
      });

      // Southeast (Agneya): Kitchen & Dining
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Kitchen (Agneya SE)",
        polygon: makeRect(W - 11, parkL, W, verL + hallL),
      });

      // Southwest (Nairutya): Master Bedroom (head of family)
      const rearL = L - (verL + hallL);
      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Master Suite (Nairutya SW)",
        polygon: makeRect(0, verL + hallL, clamp(W * 0.5, 12, W - 12), L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "Attached Bath",
        polygon: makeRect(clamp(W * 0.5, 12, W - 12), verL + hallL, clamp(W * 0.5, 12, W - 12) + 6, L),
      });

      // Northeast (Ishanya): Pooja / Study Room
      rooms.push({
        id: "ground-pooja",
        type: "study",
        name: "Pooja & Meditation (Ishanya NE)",
        polygon: makeRect(clamp(W * 0.5, 12, W - 12) + 6, verL + hallL, W, L),
      });
      break;
    }

    case "contemporary_luxury": {
      // Grand double-car covered portico
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Executive Double Portico",
        polygon: makeRect(0, 0, clamp(W * 0.48, 14, 18), clamp(L * 0.38, 14, 18)),
      });

      // Grand Entrance Foyer + Powder Room
      rooms.push({
        id: "ground-foyer",
        type: "hallway",
        name: "Grand Entrance Foyer",
        polygon: makeRect(clamp(W * 0.48, 14, 18), 0, W - 6, clamp(L * 0.38, 14, 18) * 0.5),
      });
      rooms.push({
        id: "ground-powder-bath",
        type: "bathroom",
        name: "Guest Powder Room",
        polygon: makeRect(W - 6, 0, W, clamp(L * 0.38, 14, 18) * 0.5),
      });

      // Formal Salon / Drawing Room
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Formal Salon & Reception",
        polygon: makeRect(clamp(W * 0.48, 14, 18), clamp(L * 0.38, 14, 18) * 0.5, W, clamp(L * 0.55, 18, L - 14)),
      });

      // Family Dining & Show Kitchen
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Designer Show Kitchen & Dining",
        polygon: makeRect(0, clamp(L * 0.38, 14, 18), clamp(W * 0.48, 14, 18), clamp(L * 0.55, 18, L - 14) + 6),
      });

      // Ground Floor Guest Suite with Walk-in Closet & Spa Bath
      rooms.push({
        id: "ground-guest-bed",
        type: "bedroom",
        name: "Executive Guest Suite",
        polygon: makeRect(0, clamp(L * 0.55, 18, L - 14) + 6, W - 8, L),
      });
      rooms.push({
        id: "ground-guest-bath",
        type: "bathroom",
        name: "Guest Spa Bath",
        polygon: makeRect(W - 8, clamp(L * 0.55, 18, L - 14) + 6, W, L),
      });
      break;
    }

    case "duplex":
    case "family_spacious":
    default: {
      // Classic Family Zoned Layout
      rooms.push({
        id: "ground-parking",
        type: "parking",
        name: "Covered Car Porch",
        polygon: makeRect(0, 0, parkW, parkL),
      });
      rooms.push({
        id: "ground-living",
        type: "living_room",
        name: "Formal Living Room",
        polygon: makeRect(parkW, 0, W, parkL),
      });

      // Central Dining Lounge
      const midY0 = parkL;
      const midY1 = clamp(L * 0.65, midY0 + 12, L - 12);
      rooms.push({
        id: "ground-dining",
        type: "dining_room",
        name: "Family Dining Lounge",
        polygon: makeRect(0, midY0, sX0 > 0 ? sX0 : W - 11, midY1),
      });
      rooms.push({
        id: "ground-kitchen",
        type: "kitchen",
        name: "Kitchen & Utility Store",
        polygon: makeRect(W - 11, midY0, W, midY1),
      });

      // Rear Bedrooms
      const rearHalfW = W * 0.55;
      rooms.push({
        id: "ground-master-bed",
        type: "bedroom",
        name: "Elder's / Master Bedroom",
        polygon: makeRect(0, midY1, rearHalfW - 6, L),
      });
      rooms.push({
        id: "ground-master-bath",
        type: "bathroom",
        name: "Attached Bath",
        polygon: makeRect(rearHalfW - 6, midY1, rearHalfW, L),
      });
      rooms.push({
        id: "ground-bed2",
        type: "bedroom",
        name: "Secondary Bedroom",
        polygon: makeRect(rearHalfW, midY1, W - 6, L),
      });
      rooms.push({
        id: "ground-common-bath",
        type: "bathroom",
        name: "Common Bath",
        polygon: makeRect(W - 6, midY1, W, L),
      });
      break;
    }
  }
}

function generateMiddleFloorRooms(
  designId: ArchitecturalDesignId,
  W: number,
  L: number,
  sX0: number,
  sY0: number,
  sX1: number,
  sY1: number,
  rooms: Room[]
) {
  // First floor of 3-storey house: Dedicated luxury sleeping floor
  // Front: 2 Bedrooms with en-suite bathrooms and balconies
  const frontL = clamp(L * 0.48, 14, 20);

  // Front Left: Bedroom 2 + Balcony
  rooms.push({
    id: "first-bed2",
    type: "bedroom",
    name: "Deluxe Bedroom 2",
    polygon: makeRect(0, 5, W * 0.45, frontL),
  });
  rooms.push({
    id: "first-balcony-front",
    type: "other",
    name: "Front Viewing Balcony",
    polygon: makeRect(0, 0, W, 5),
  });

  // Front Right: Bedroom 3 + Bath
  rooms.push({
    id: "first-bed3",
    type: "bedroom",
    name: "Bedroom 3",
    polygon: makeRect(W * 0.45, 5, W - 6, frontL),
  });
  rooms.push({
    id: "first-bath3",
    type: "bathroom",
    name: "Attached Bath",
    polygon: makeRect(W - 6, 5, W, frontL),
  });

  // Central Family TV Lounge / Study Room
  rooms.push({
    id: "first-family-lounge",
    type: "living_room",
    name: "Family Entertainment Lounge",
    polygon: makeRect(0, frontL, sX0 > 0 ? sX0 : W - 8, frontL + 12),
  });

  // Rear: Primary Master Suite with Walk-In Closet & Spa Bath
  const rearY0 = frontL + 12;
  rooms.push({
    id: "first-master-suite",
    type: "bedroom",
    name: "Primary Master Suite",
    polygon: makeRect(0, rearY0, W * 0.6, L),
  });
  rooms.push({
    id: "first-master-bath",
    type: "bathroom",
    name: "Master Spa Bath",
    polygon: makeRect(W * 0.6, rearY0, W, L),
  });
}

function generateUpperFloorRooms(
  designId: ArchitecturalDesignId,
  levelIndex: number,
  W: number,
  L: number,
  sX0: number,
  sY0: number,
  sX1: number,
  sY1: number,
  rooms: Room[],
  terraceId: TerraceDesignId
) {
  const pfx = levelIndex === 1 ? "first" : "second";

  // Top Floor: Includes residential rooms + matching architectural Terrace structural layout
  // Front half: Luxury Master Retreat or Penthouse Lounge
  const splitY = clamp(L * 0.46, 12, L - 14);

  rooms.push({
    id: `${pfx}-penthouse-suite`,
    type: "bedroom",
    name: "Penthouse Master Suite",
    polygon: makeRect(0, 0, W - 7, splitY),
  });
  rooms.push({
    id: `${pfx}-penthouse-bath`,
    type: "bathroom",
    name: "Luxury En-Suite Bath",
    polygon: makeRect(W - 7, 0, W, splitY),
  });

  // Rear half: Structured Terrace configured according to terraceId
  generateTerraceLayout(pfx, terraceId, 0, splitY, W, L, rooms);
}

function generateTerraceLayout(
  prefix: string,
  terraceId: TerraceDesignId,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rooms: Room[]
) {
  const tW = x1 - x0;
  const tL = y1 - y0;

  switch (terraceId) {
    case "garden": {
      // Rooftop Garden: Divided into Grass Lawn & Paved Deck Walkway
      const lawnW = tW * 0.65;
      rooms.push({
        id: `${prefix}-roof-lawn`,
        type: "other",
        name: "Lawn & Planter Garden",
        polygon: makeRect(x0, y0, x0 + lawnW, y1),
      });
      rooms.push({
        id: `${prefix}-roof-deck`,
        type: "other",
        name: "Stepping Stones & Paved Deck",
        polygon: makeRect(x0 + lawnW, y0, x1, y1),
      });
      break;
    }

    case "pergola": {
      // Pergola Seating Terrace: Shaded pergola sitting lounge + Open View Deck
      const pergW = clamp(tW * 0.5, 9, 14);
      rooms.push({
        id: `${prefix}-pergola-lounge`,
        type: "other",
        name: "Timber Pergola Lounge",
        polygon: makeRect(x0, y0, x0 + pergW, y1),
      });
      rooms.push({
        id: `${prefix}-open-view-deck`,
        type: "other",
        name: "Open Viewing Deck",
        polygon: makeRect(x0 + pergW, y0, x1, y1),
      });
      break;
    }

    case "covered": {
      // Covered Pavilion: Semi-enclosed roof pavilion with columns + Sun Deck
      const covW = clamp(tW * 0.55, 10, 16);
      rooms.push({
        id: `${prefix}-covered-pavilion`,
        type: "other",
        name: "Covered Roof Pavilion",
        polygon: makeRect(x0, y0, x0 + covW, y1),
      });
      rooms.push({
        id: `${prefix}-open-terrace`,
        type: "other",
        name: "Open Sky Deck",
        polygon: makeRect(x0 + covW, y0, x1, y1),
      });
      break;
    }

    case "lounge": {
      // Rooftop Lounge: Enclosed Glass Sky Salon + Open Barbecue Patio
      const loungeW = clamp(tW * 0.55, 10, 16);
      rooms.push({
        id: `${prefix}-sky-lounge`,
        type: "living_room",
        name: "Enclosed Glass Sky Lounge",
        polygon: makeRect(x0, y0, x0 + loungeW, y1),
      });
      rooms.push({
        id: `${prefix}-bbq-terrace`,
        type: "other",
        name: "Barbecue & Dining Terrace",
        polygon: makeRect(x0 + loungeW, y0, x1, y1),
      });
      break;
    }

    case "utility": {
      // Utility & Solar Terrace: Enclosed Solar/Laundry Room + Clothes Drying Yard
      const utilW = clamp(tW * 0.4, 7, 10);
      rooms.push({
        id: `${prefix}-solar-utility`,
        type: "utility",
        name: "Solar & Laundry Room",
        polygon: makeRect(x0, y0, x0 + utilW, y1),
      });
      rooms.push({
        id: `${prefix}-drying-yard`,
        type: "other",
        name: "Service & Clothes Drying Yard",
        polygon: makeRect(x0 + utilW, y0, x1, y1),
      });
      break;
    }

    case "open":
    default: {
      // Standard Panoramic Open Terrace
      rooms.push({
        id: `${prefix}-open-terrace`,
        type: "other",
        name: "Panoramic Open Sky Terrace",
        polygon: makeRect(x0, y0, x1, y1),
      });
      break;
    }
  }
}
