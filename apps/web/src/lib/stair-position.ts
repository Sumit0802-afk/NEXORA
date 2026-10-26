import type { FloorPlan } from "@houseplan/design-schema";
import { roomRect } from "./circulation";

export type StairSide = "any" | "left" | "right" | "front" | "back" | "centre";

/** Where the ground-floor staircase sits on the plot. Street is at y = 0 (front). */
export function stairSides(plan: FloorPlan): Exclude<StairSide, "any">[] {
  const stair = plan.levels[0]?.rooms.find((r) => r.type === "staircase");
  if (!stair) return [];
  const r = roomRect(stair);
  const cx = (r.minX + r.maxX) / 2 / plan.plot.width;
  const cy = (r.minY + r.maxY) / 2 / plan.plot.length;
  const sides: Exclude<StairSide, "any">[] = [];
  if (cx < 0.4) sides.push("left");
  else if (cx > 0.6) sides.push("right");
  if (cy < 0.4) sides.push("front");
  else if (cy > 0.6) sides.push("back");
  if (!sides.length) sides.push("centre");
  return sides;
}

export const STAIR_SIDE_LABEL: Record<StairSide, string> = {
  any: "No preference",
  left: "Left side",
  right: "Right side",
  front: "Towards the street",
  back: "Towards the rear",
  centre: "Centre of the house",
};

export function matchesStairSide(plan: FloorPlan, side: StairSide): boolean {
  return side === "any" || stairSides(plan).includes(side as Exclude<StairSide, "any">);
}
