import type { FloorPlan, Room, RoomType } from "@houseplan/design-schema";
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
  | "outdoor_dining"
  | "utility"
  | "solar"
  | "traditional_indian";

export interface ArchitecturalDesignSpec {
  id: ArchitecturalDesignId;
  name: string;
  tagline: string;
  description: string;
  footprintType: "Open-Plan" | "Formal Zoned" | "Courtyard Core" | "L-Wing" | "U-Pavilion" | "Duplex Void" | "Vastu Classic" | "Luxury Estate";
  features: string[];
  pros: string[];
  circulationScore: number;
  lightRating: "A+" | "A" | "A-";
  vastuScore?: number;
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
    name: "Utility & Laundry Terrace",
    tagline: "Laundry & drying yard",
    description: "Dedicated laundry room, service yard, and overhead water tank access with weatherproof plumbing points.",
    features: ["Enclosed laundry & washing room", "Dedicated clothes drying yard", "Water tank & pump access", "Plumbing service points"],
  },
  outdoor_dining: {
    id: "outdoor_dining",
    name: "Outdoor Dining Area",
    tagline: "Alfresco dining under the stars",
    description: "Covered outdoor dining pavilion with 8-seater dining table, barbecue island counter, and ambient pendant lighting.",
    features: ["8-seater alfresco dining table", "Barbecue cooking station", "Weather-resistant canopy", "Ambient dining lighting"],
  },
  solar: {
    id: "solar",
    name: "Solar Panel Terrace",
    tagline: "High-yield photovoltaic solar array",
    description: "Elevated structural steel racks holding tilted solar panels, leaving walk-under utility space and battery storage below.",
    features: ["Elevated solar panel racking", "Walk-under multi-use space", "Solar inverter & battery bank", "Clean renewable energy"],
  },
  traditional_indian: {
    id: "traditional_indian",
    name: "Traditional Indian Terrace",
    tagline: "Chhatri gazebo, jali screens & jhula",
    description: "Traditional carved stone chhatri gazebo, brass/wood hanging jhula swing, terracotta floor tiles, and decorative jali parapet screens.",
    features: ["Carved stone chhatri gazebo", "Hanging brass/wood swing (jhula)", "Terracotta tile flooring", "Traditional jali parapet screen"],
  },
};

export const TERRACE_DESIGNS_LIST: TerraceDesignSpec[] = Object.values(TERRACE_DESIGNS);

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
  const minX = Math.round(Math.min(x0, x1) * 100) / 100;
  const maxX = Math.round(Math.max(x0, x1) * 100) / 100;
  const minY = Math.round(Math.min(y0, y1) * 100) / 100;
  const maxY = Math.round(Math.max(y0, y1) * 100) / 100;
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
 * Builds non-overlapping, strictly partitioned floor plans for any plot dimensions.
 * Staircase coordinates [sX0, sY0, sX1, sY1] are identical across all floors.
 */
export function generateArchitecturalPlan(params: {
  designId: ArchitecturalDesignId;
  terraceId?: TerraceDesignId;
  plotWidth: number;
  plotLength: number;
  units?: "ft" | "m";
  floors?: number;
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

  // Define primary spatial cuts across the plot
  // xSplit: horizontal divide between left and right wings (e.g. 50-55% of width)
  const xSplit = Math.round(clamp(W * 0.52, 10, W - 10) * 10) / 10;

  // yFront: depth of front active zone (living, parking, foyer)
  const yFront = Math.round(clamp(L * 0.40, 10, L - 14) * 10) / 10;

  // yMid: boundary between middle zone and rear zone
  const yMid = Math.round(clamp(L * 0.68, yFront + 8, L - 8) * 10) / 10;

  // Staircase footprint: exactly inside the right column, between yFront and yMid
  // This guarantees stair space [xSplit, yFront, W, yMid] never collides with any other room!
  const sX0 = xSplit;
  const sY0 = yFront;
  const sX1 = W;
  const sY1 = yMid;

  const levels: FloorPlan["levels"] = [];

  for (let lvl = 0; lvl < numFloors; lvl++) {
    const isGround = lvl === 0;
    const isTopFloor = lvl === numFloors - 1;
    const levelId = lvl === 0 ? "ground" : lvl === 1 ? "first" : "second";
    const elevation = lvl * wallH;
    const rooms: Room[] = [];

    // Staircase placed on every floor where vertical transport connects
    if (numFloors > 1 || lvl > 0) {
      rooms.push({
        id: `${levelId}-staircase`,
        type: "staircase",
        name: isGround ? "Staircase (Up)" : isTopFloor ? "Staircase (Down & Roof)" : "Staircase",
        polygon: makeRect(sX0, sY0, sX1, sY1),
      });
    }

    if (isGround) {
      // ── GROUND FLOOR PARTITION ──
      // Top-Left [0, 0, xSplit, yFront]
      // Top-Right [xSplit, 0, W, yFront]
      // Mid-Left [0, yFront, xSplit, yMid]
      // Mid-Right [xSplit, yFront, W, yMid] -> Staircase
      // Bottom-Left [0, yMid, xSplit, L]
      // Bottom-Right [xSplit, yMid, W, L]

      switch (designId) {
        case "modern_open":
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Car Portico & Entry",
            polygon: makeRect(0, 0, xSplit * 0.48, yFront),
          });
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Open-Plan Living Great Room",
            polygon: makeRect(xSplit * 0.48, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Island Gourmet Kitchen & Dining",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-lounge",
            type: "living_room",
            name: "Garden-Facing Family Lounge",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Master Suite",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-bed2",
            type: "bedroom",
            name: "Guest Bedroom",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-bath2",
            type: "bathroom",
            name: "Common Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;

        case "courtyard":
          // Mid-Left is the open-to-sky central courtyard
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Courtyard Entry Hall",
            polygon: makeRect(0, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Entrance Porch",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-courtyard",
            type: "other",
            name: "Central Atrium Courtyard (Open-to-Sky)",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Courtyard Dining & Kitchen",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Master Bedroom Suite",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-master-bath",
            type: "bathroom",
            name: "Attached Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;

        case "l_shaped":
          // Top-Right is the private garden lawn embracing the L-shaped house
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Garden-Facing Living Spine",
            polygon: makeRect(0, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-lawn",
            type: "other",
            name: "Private Garden Lawn & Patio",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-dining-kitchen",
            type: "kitchen",
            name: "Dining & Corner Kitchen",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Master Bedroom Suite",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-bed2",
            type: "bedroom",
            name: "Garden Suite",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-bath2",
            type: "bathroom",
            name: "Attached Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;

        case "u_shaped":
          // Top-Right is the central garden water court
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Public Living Lounge (West Wing)",
            polygon: makeRect(0, 0, xSplit * 0.7, yFront),
          });
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Covered Portico",
            polygon: makeRect(xSplit * 0.7, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-court",
            type: "other",
            name: "Central Water/Garden Court",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-gallery",
            type: "dining_room",
            name: "Glass Gallery & Dining",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Chef Kitchen & Store",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Secluded Master Suite",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-master-bath",
            type: "bathroom",
            name: "En-Suite Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;

        case "traditional_indian":
          // Vastu layout: NE Pooja, SE Kitchen, SW Master Bed, NW Parking, Brahmasthan Hall
          rooms.push({
            id: "ground-verandah",
            type: "other",
            name: "Thinnai Entrance Sit-out",
            polygon: makeRect(0, 0, xSplit * 0.45, yFront),
          });
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Parking (Vayavya NW)",
            polygon: makeRect(xSplit * 0.45, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Kitchen (Agneya SE)",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Central Hall (Brahmasthan)",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Master Suite (Nairutya SW)",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-pooja",
            type: "study",
            name: "Pooja & Meditation (Ishanya NE)",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-bath",
            type: "bathroom",
            name: "Attached Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;

        case "contemporary_luxury":
          rooms.push({
            id: "ground-foyer",
            type: "hallway",
            name: "Grand Statement Foyer",
            polygon: makeRect(0, 0, xSplit * 0.35, yFront),
          });
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Double Car Portico",
            polygon: makeRect(xSplit * 0.35, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Formal Salon & Reception",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Show Kitchen & Family Dining",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-guest-bed",
            type: "bedroom",
            name: "Executive Guest Suite",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-guest-bath",
            type: "bathroom",
            name: "Guest Spa Bath",
            polygon: makeRect(xSplit, yMid, W, L),
          });
          break;

        case "duplex":
        case "family_spacious":
        default:
          rooms.push({
            id: "ground-parking",
            type: "parking",
            name: "Covered Car Porch",
            polygon: makeRect(0, 0, xSplit * 0.45, yFront),
          });
          rooms.push({
            id: "ground-living",
            type: "living_room",
            name: "Formal Living Room",
            polygon: makeRect(xSplit * 0.45, 0, xSplit, yFront),
          });
          rooms.push({
            id: "ground-kitchen",
            type: "kitchen",
            name: "Enclosed Kitchen & Utility",
            polygon: makeRect(xSplit, 0, W, yFront),
          });
          rooms.push({
            id: "ground-dining",
            type: "dining_room",
            name: "Family Dining Lounge",
            polygon: makeRect(0, yFront, xSplit, yMid),
          });
          rooms.push({
            id: "ground-master-bed",
            type: "bedroom",
            name: "Elder's / Master Bedroom",
            polygon: makeRect(0, yMid, xSplit, L),
          });
          rooms.push({
            id: "ground-bed2",
            type: "bedroom",
            name: "Secondary Bedroom",
            polygon: makeRect(xSplit, yMid, W - 6, L),
          });
          rooms.push({
            id: "ground-bath2",
            type: "bathroom",
            name: "Common Bath",
            polygon: makeRect(W - 6, yMid, W, L),
          });
          break;
      }
    } else if (lvl === 1 && numFloors === 3) {
      // ── MIDDLE FLOOR (For 3-Storey House) ──
      // Top-Left [0, 0, xSplit, yFront]
      // Top-Right [xSplit, 0, W, yFront]
      // Mid-Left [0, yFront, xSplit, yMid]
      // Mid-Right [xSplit, yFront, W, yMid] -> Staircase
      // Bottom-Left [0, yMid, xSplit, L]
      // Bottom-Right [xSplit, yMid, W, L]
      rooms.push({
        id: "first-balcony-front",
        type: "other",
        name: "Panoramic Front Balcony",
        polygon: makeRect(0, 0, xSplit, yFront * 0.35),
      });
      rooms.push({
        id: "first-bed2",
        type: "bedroom",
        name: "Deluxe Bedroom 2",
        polygon: makeRect(0, yFront * 0.35, xSplit, yFront),
      });
      rooms.push({
        id: "first-bed3",
        type: "bedroom",
        name: "Bedroom 3 Suite",
        polygon: makeRect(xSplit, 0, W - 6, yFront),
      });
      rooms.push({
        id: "first-bath3",
        type: "bathroom",
        name: "Attached Bath",
        polygon: makeRect(W - 6, 0, W, yFront),
      });
      rooms.push({
        id: "first-family-lounge",
        type: "living_room",
        name: "Upper Family Entertainment Lounge",
        polygon: makeRect(0, yFront, xSplit, yMid),
      });
      rooms.push({
        id: "first-master-suite",
        type: "bedroom",
        name: "Primary Master Suite",
        polygon: makeRect(0, yMid, xSplit, L),
      });
      rooms.push({
        id: "first-master-bath",
        type: "bathroom",
        name: "Master Spa Bath",
        polygon: makeRect(xSplit, yMid, W, L),
      });
    } else {
      // ── TOP FLOOR (Upper suites + Structured Terrace) ──
      // Top-Left [0, 0, xSplit, yFront] -> Penthouse Master Suite
      // Top-Right [xSplit, 0, W, yFront] -> Penthouse Bath / Dressing
      // Mid-Left [0, yFront, xSplit, yMid] -> Sky Study / Lounge
      // Mid-Right [xSplit, yFront, W, yMid] -> Staircase
      // Bottom half [0, yMid, W, L] -> Structured Terrace Option!
      const pfx = lvl === 1 ? "first" : "second";

      rooms.push({
        id: `${pfx}-penthouse-suite`,
        type: "bedroom",
        name: "Penthouse Master Suite",
        polygon: makeRect(0, 0, xSplit, yFront),
      });
      rooms.push({
        id: `${pfx}-penthouse-bath`,
        type: "bathroom",
        name: "Penthouse En-Suite Bath",
        polygon: makeRect(xSplit, 0, W, yFront),
      });
      rooms.push({
        id: `${pfx}-sky-study`,
        type: "study",
        name: "Sky Studio / Library",
        polygon: makeRect(0, yFront, xSplit, yMid),
      });

      // Apply the selected Terrace structural design strictly in [0, yMid, W, L]
      applyTerraceGrid(pfx, terraceId, 0, yMid, W, L, rooms);
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

export function applyTerraceGrid(
  prefix: string,
  terraceId: TerraceDesignId,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rooms: Room[]
) {
  const tW = x1 - x0;
  const midX = Math.round((x0 + tW * 0.55) * 10) / 10;

  switch (terraceId) {
    case "garden":
      rooms.push({
        id: `${prefix}-roof-lawn`,
        type: "other",
        name: "Lawn & Planter Garden",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-roof-deck`,
        type: "other",
        name: "Stepping Stones & Paved Deck",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "pergola":
      rooms.push({
        id: `${prefix}-pergola-lounge`,
        type: "other",
        name: "Timber Pergola Lounge",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-open-view-deck`,
        type: "other",
        name: "Open Viewing Deck",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "covered":
      rooms.push({
        id: `${prefix}-covered-pavilion`,
        type: "other",
        name: "Covered Roof Pavilion",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-open-terrace`,
        type: "other",
        name: "Open Sky Deck",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "lounge":
      rooms.push({
        id: `${prefix}-sky-lounge`,
        type: "living_room",
        name: "Enclosed Glass Sky Lounge",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-bbq-terrace`,
        type: "other",
        name: "Barbecue & Dining Terrace",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "utility":
      rooms.push({
        id: `${prefix}-solar-utility`,
        type: "utility",
        name: "Laundry & Utility Room",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-drying-yard`,
        type: "other",
        name: "Service & Clothes Drying Yard",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "outdoor_dining":
      rooms.push({
        id: `${prefix}-dining-pavilion`,
        type: "dining_room",
        name: "Alfresco Dining Pavilion",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-bbq-bar`,
        type: "other",
        name: "Outdoor Barbecue & Star Deck",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "solar":
      rooms.push({
        id: `${prefix}-solar-array`,
        type: "utility",
        name: "Solar Panel Array Deck",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-inverter-yard`,
        type: "other",
        name: "Inverter & Service Walkway",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "traditional_indian":
      rooms.push({
        id: `${prefix}-chhatri-gazebo`,
        type: "other",
        name: "Chhatri Gazebo & Jhula",
        polygon: makeRect(x0, y0, midX, y1),
      });
      rooms.push({
        id: `${prefix}-jali-terrace`,
        type: "other",
        name: "Jali & Terracotta Open Terrace",
        polygon: makeRect(midX, y0, x1, y1),
      });
      break;

    case "open":
    default:
      rooms.push({
        id: `${prefix}-open-terrace`,
        type: "other",
        name: "Panoramic Open Sky Terrace",
        polygon: makeRect(x0, y0, x1, y1),
      });
      break;
  }
}
