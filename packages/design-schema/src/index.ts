import { z } from "zod";

export const PointSchema = z.tuple([z.number(), z.number()]);
export const RoomTypeSchema = z.enum([
  "bedroom", "bathroom", "kitchen", "living_room", "dining_room",
  "hallway", "staircase", "parking", "study", "utility", "balcony", "corridor", "other"
]);

export const RoomInteriorSchema = z.object({
  wallColor: z.string().optional(),
  wallFinish: z.string().optional(),
  floorColor: z.string().optional(),
  floorMaterial: z.string().optional(),
  ceilingStyle: z.string().optional(),
  lightingType: z.string().optional(),
  lightingColor: z.string().optional(),
}).passthrough();

export const RoomSchema = z.object({
  id: z.string().min(1),
  type: RoomTypeSchema,
  name: z.string().min(1),
  polygon: z.array(PointSchema).min(3),
  interior: RoomInteriorSchema.optional(),
}).passthrough();

export const FurnitureItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  type: z.string(),
  roomId: z.string(),
  levelId: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.number().default(0),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  dimensions: z.object({
    width: z.number(),
    depth: z.number(),
    height: z.number(),
  }),
  material: z.record(z.unknown()).optional(),
}).passthrough();

export const WallSchema = z.object({
  id: z.string(),
  start: PointSchema,
  end: PointSchema,
  thickness: z.number().positive().default(0.5),
  height: z.number().positive().default(10),
  kind: z.enum(["exterior", "interior"]).default("interior")
});

export const OpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  kind: z.enum(["door", "window"]),
  offset: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive().optional(),
  sillHeight: z.number().nonnegative().optional()
});

export const ColumnSchema = z.object({
  id: z.string(),
  position: PointSchema,
  shape: z.enum(["rectangle", "circular"]).default("rectangle"),
  width: z.number().positive().default(0.75),
  depth: z.number().positive().default(0.75),
  rotation: z.number().default(0),
  material: z.string().default("reinforced_concrete"),
}).passthrough();

export const BeamSchema = z.object({
  id: z.string(),
  start: PointSchema,
  end: PointSchema,
  width: z.number().positive().default(0.75),
  depth: z.number().positive().default(1.25),
  kind: z.enum(["primary", "secondary", "plinth"]).default("primary"),
}).passthrough();

export const FoundationFootingSchema = z.object({
  id: z.string(),
  columnId: z.string().optional(),
  position: PointSchema,
  width: z.number().positive().default(3.5),
  length: z.number().positive().default(3.5),
  depth: z.number().positive().default(1.5),
  type: z.enum(["isolated", "combined", "raft"]).default("isolated"),
}).passthrough();

export const FloorPlanSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string(),
  units: z.enum(["ft", "m"]),
  plot: z.object({
    width: z.number().positive(),
    length: z.number().positive(),
    floors: z.number().int().positive(),
    shape: z.enum(["rectangle", "custom"]).default("rectangle")
  }),
  levels: z.array(z.object({
    id: z.string(),
    elevation: z.number(),
    wallHeight: z.number().positive(),
    rooms: z.array(RoomSchema),
    walls: z.array(WallSchema),
    openings: z.array(OpeningSchema),
    furniture: z.array(z.union([FurnitureItemSchema, z.record(z.unknown())])).default([]),
    columns: z.array(ColumnSchema).optional(),
    beams: z.array(BeamSchema).optional(),
    foundations: z.array(FoundationFootingSchema).optional()
  })),
  /** Terrace and exterior options chosen in the 3D designer; stored with the plan so they reopen as saved. */
  terraceConfig: z.record(z.unknown()).optional(),
  exteriorConfig: z.record(z.unknown()).optional(),
  metadata: z.object({
    version: z.number().int().positive(),
    status: z.enum(["draft", "generated", "reviewed"]).default("draft")
  })
});

export type FloorPlan = z.infer<typeof FloorPlanSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;
export type RoomInterior = z.infer<typeof RoomInteriorSchema>;
export type FurnitureItem = z.infer<typeof FurnitureItemSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Beam = z.infer<typeof BeamSchema>;
export type FoundationFooting = z.infer<typeof FoundationFootingSchema>;

