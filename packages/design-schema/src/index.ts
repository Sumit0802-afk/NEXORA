import { z } from "zod";

export const PointSchema = z.tuple([z.number(), z.number()]);
export const RoomTypeSchema = z.enum([
  "bedroom", "bathroom", "kitchen", "living_room", "dining_room",
  "hallway", "staircase", "parking", "study", "utility", "other"
]);

export const RoomSchema = z.object({
  id: z.string().min(1),
  type: RoomTypeSchema,
  name: z.string().min(1),
  polygon: z.array(PointSchema).min(3)
});

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
    furniture: z.array(z.record(z.unknown())).default([])
  })),
  metadata: z.object({
    version: z.number().int().positive(),
    status: z.enum(["draft", "generated", "reviewed"]).default("draft")
  })
});

export type FloorPlan = z.infer<typeof FloorPlanSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
