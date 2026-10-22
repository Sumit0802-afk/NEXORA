import type { FloorPlan } from "@houseplan/design-schema";

export const demoPlan: FloorPlan = {
  schemaVersion: 1,
  projectId: "demo",
  units: "ft",
  plot: { width: 30, length: 40, floors: 1, shape: "rectangle" },
  levels: [{
    id: "ground",
    elevation: 0,
    wallHeight: 10,
    rooms: [
      { id: "room-living", type: "living_room", name: "Living", polygon: [[0,0],[15,0],[15,16],[0,16]] },
      { id: "room-bed1", type: "bedroom", name: "Bedroom 1", polygon: [[15,0],[30,0],[30,13],[15,13]] },
      { id: "room-bed2", type: "bedroom", name: "Bedroom 2", polygon: [[0,16],[14,16],[14,30],[0,30]] },
      { id: "room-kitchen", type: "kitchen", name: "Kitchen", polygon: [[14,16],[30,16],[30,30],[14,30]] }
    ],
    walls: [],
    openings: [],
    furniture: []
  }],
  metadata: { version: 1, status: "draft" }
};
