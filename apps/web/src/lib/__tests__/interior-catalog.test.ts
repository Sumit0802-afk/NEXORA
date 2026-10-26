import { describe, it, expect } from "vitest";
import {
  FURNITURE_CATALOG,
  WALL_FINISHES,
  FLOOR_MATERIALS,
  CEILING_STYLES,
  LIGHTING_OPTIONS,
  autoFurnishRoom,
  validateRoomFurniture,
  getRoomBounds,
} from "../interior-catalog";
import type { Room } from "@houseplan/design-schema";

describe("Interior Designer Catalog & Utilities", () => {
  it("contains rich furniture library across all required categories", () => {
    const categories = new Set(FURNITURE_CATALOG.map((item) => item.category));
    expect(categories.has("bedroom")).toBe(true);
    expect(categories.has("living_room")).toBe(true);
    expect(categories.has("kitchen")).toBe(true);
    expect(categories.has("bathroom")).toBe(true);
    expect(categories.has("dining_room")).toBe(true);
    expect(categories.has("other")).toBe(true);

    const types = new Set(FURNITURE_CATALOG.map((item) => item.type));
    // Bedroom
    expect(types.has("bed_king")).toBe(true);
    expect(types.has("bed_queen")).toBe(true);
    expect(types.has("wardrobe")).toBe(true);
    expect(types.has("nightstand")).toBe(true);
    expect(types.has("dresser")).toBe(true);

    // Living
    expect(types.has("sofa_3seater")).toBe(true);
    expect(types.has("sofa_sectional")).toBe(true);
    expect(types.has("coffee_table")).toBe(true);
    expect(types.has("tv_unit")).toBe(true);
    expect(types.has("bookshelf")).toBe(true);

    // Kitchen
    expect(types.has("kitchen_counter")).toBe(true);
    expect(types.has("kitchen_sink")).toBe(true);
    expect(types.has("cooktop_oven")).toBe(true);
    expect(types.has("refrigerator")).toBe(true);

    // Bathroom
    expect(types.has("toilet")).toBe(true);
    expect(types.has("vanity_sink")).toBe(true);
    expect(types.has("bathtub")).toBe(true);
    expect(types.has("shower_stall")).toBe(true);

    // Dining
    expect(types.has("dining_table_6")).toBe(true);
    expect(types.has("dining_table_4")).toBe(true);
    expect(types.has("dining_chair")).toBe(true);

    // Other & Decor
    expect(types.has("office_desk")).toBe(true);
    expect(types.has("office_chair")).toBe(true);
    expect(types.has("floor_lamp")).toBe(true);
    expect(types.has("area_rug")).toBe(true);
    expect(types.has("indoor_plant")).toBe(true);
  });

  it("provides comprehensive interior finishes, materials, and lighting presets", () => {
    expect(WALL_FINISHES.length).toBeGreaterThanOrEqual(6);
    expect(FLOOR_MATERIALS.length).toBeGreaterThanOrEqual(6);
    expect(CEILING_STYLES.length).toBeGreaterThanOrEqual(4);
    expect(LIGHTING_OPTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("calculates room bounds accurately", () => {
    const polygon: [number, number][] = [
      [5, 10],
      [20, 10],
      [20, 25],
      [5, 25],
    ];
    const bounds = getRoomBounds(polygon);
    expect(bounds.minX).toBe(5);
    expect(bounds.maxX).toBe(20);
    expect(bounds.minY).toBe(10);
    expect(bounds.maxY).toBe(25);
    expect(bounds.width).toBe(15);
    expect(bounds.depth).toBe(15);
    expect(bounds.centerX).toBe(12.5);
    expect(bounds.centerY).toBe(17.5);
  });

  it("auto-furnishes a bedroom with bed, nightstands, wardrobe, and rug", () => {
    const bedroom: Room = {
      id: "room-bed-1",
      name: "Master Bedroom",
      type: "bedroom",
      polygon: [
        [0, 0],
        [14, 0],
        [14, 14],
        [0, 14],
      ],
    };

    const items = autoFurnishRoom(bedroom, "ground");
    expect(items.length).toBeGreaterThanOrEqual(3);

    const types = items.map((i) => i.type);
    expect(types).toContain("bed_king");
    expect(types).toContain("area_rug");
    expect(types.some((t) => t.includes("nightstand"))).toBe(true);
    expect(types).toContain("wardrobe");

    // Check bounds
    const validation = validateRoomFurniture(bedroom, items);
    expect(validation.isInsideRoom).toBe(true);
    expect(validation.circulationRating).not.toBe("crowded");
  });

  it("auto-furnishes living room, kitchen, bathroom, and dining room", () => {
    const living: Room = {
      id: "room-liv-1",
      name: "Living Room",
      type: "living_room",
      polygon: [
        [0, 0],
        [16, 0],
        [16, 18],
        [0, 18],
      ],
    };
    const livItems = autoFurnishRoom(living, "ground");
    expect(livItems.length).toBeGreaterThanOrEqual(3);
    expect(livItems.some((i) => i.type.includes("sofa"))).toBe(true);
    expect(livItems.some((i) => i.type === "tv_unit")).toBe(true);

    const kitchen: Room = {
      id: "room-kitch-1",
      name: "Kitchen",
      type: "kitchen",
      polygon: [
        [0, 0],
        [10, 0],
        [10, 12],
        [0, 12],
      ],
    };
    const kitchItems = autoFurnishRoom(kitchen, "ground");
    expect(kitchItems.some((i) => i.type === "kitchen_counter")).toBe(true);
    expect(kitchItems.some((i) => i.type === "refrigerator")).toBe(true);

    const bath: Room = {
      id: "room-bath-1",
      name: "Bathroom",
      type: "bathroom",
      polygon: [
        [0, 0],
        [7, 0],
        [7, 9],
        [0, 9],
      ],
    };
    const bathItems = autoFurnishRoom(bath, "ground");
    expect(bathItems.some((i) => i.type === "toilet")).toBe(true);
    expect(bathItems.some((i) => i.type === "vanity_sink")).toBe(true);

    const dining: Room = {
      id: "room-din-1",
      name: "Dining Room",
      type: "dining_room",
      polygon: [
        [0, 0],
        [12, 0],
        [12, 12],
        [0, 12],
      ],
    };
    const dinItems = autoFurnishRoom(dining, "ground");
    expect(dinItems.some((i) => i.type.includes("dining_table"))).toBe(true);
  });

  it("validates clearance and detects objects placed outside the room", () => {
    const room: Room = {
      id: "room-small",
      name: "Small Room",
      type: "study",
      polygon: [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ],
    };

    const outItem = {
      id: "furn-out",
      name: "Outside Desk",
      category: "other" as const,
      type: "office_desk",
      roomId: room.id,
      levelId: "ground",
      position: [12, 12, 0] as [number, number, number],
      rotation: 0,
      scale: [1, 1, 1] as [number, number, number],
      dimensions: { width: 5, depth: 3, height: 2.5 },
    };

    const validation = validateRoomFurniture(room, [outItem]);
    expect(validation.isInsideRoom).toBe(false);
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.warnings[0]).toContain("outside the walls");
  });
});

describe("catalogForRoom", () => {
  it("offers only room-appropriate furniture", async () => {
    const { catalogForRoom } = await import("../interior-catalog");
    expect(catalogForRoom("bathroom").every((i) => i.category === "bathroom")).toBe(true);
    expect(catalogForRoom("bathroom").length).toBeGreaterThan(0);
    for (const t of ["bedroom", "kitchen", "living_room", "dining_room"] as const) {
      expect(catalogForRoom(t).length).toBeGreaterThan(0);
    }
    expect(catalogForRoom("kitchen").some((i) => i.category === "bedroom")).toBe(false);
    expect(catalogForRoom("bedroom").some((i) => i.category === "kitchen")).toBe(false);
  });
});
