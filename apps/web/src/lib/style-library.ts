import type { FloorPlan } from "@houseplan/design-schema";
import {
  ARCHITECTURAL_DESIGNS,
  TERRACE_DESIGNS,
  generateArchitecturalPlan,
  type ArchitecturalDesignId,
  type TerraceDesignId,
} from "./architectural-layouts";
import { validateDesign } from "./validation";

/**
 * Architectural-style designs from the in-browser layout engine: courtyard, L-shaped, U-shaped, open-plan, duplex,
 * traditional-hall and villa plans, each at several plot sizes and floor counts. Every entry is a real plan that is
 * generated and checked (no overlaps, stacked stairs, reachable terraces); entries that fail are dropped, so the
 * count is what the engine actually produces.
 */
export type StyleEntry = {
  id: string;
  designId: ArchitecturalDesignId;
  style: string;
  tagline: string;
  footprint: string;
  plot: { width: number; length: number; units: "ft" };
  plotArea: number;
  floors: 1 | 2 | 3;
  terrace: TerraceDesignId;
  features: string[];
  orientation: string;
  tags: string[];
};

const PLOTS: [number, number][] = [[25, 40], [30, 40], [30, 50], [35, 50], [40, 60], [50, 70]];
const FLOORS = [1, 2, 3] as const;

const DEFAULT_TERRACE: Record<ArchitecturalDesignId, TerraceDesignId> = {
  modern_open: "pergola",
  family_spacious: "garden",
  courtyard: "garden",
  l_shaped: "garden",
  u_shaped: "lounge",
  duplex: "lounge",
  traditional_indian: "traditional_indian",
  contemporary_luxury: "lounge",
};

const HOME_TYPE = { 1: "Bungalow", 2: "Duplex", 3: "Triplex" } as const;

export function buildStylePlan(entry: Pick<StyleEntry, "designId" | "plot" | "floors" | "terrace">): FloorPlan {
  return generateArchitecturalPlan({
    designId: entry.designId,
    terraceId: entry.terrace,
    plotWidth: entry.plot.width,
    plotLength: entry.plot.length,
    units: "ft",
    floors: entry.floors,
  }).plan;
}

let cached: StyleEntry[] | null = null;

/** All style designs that the engine can build cleanly. Computed once. */
export function styleCatalog(): StyleEntry[] {
  if (cached) return cached;
  const out: StyleEntry[] = [];
  for (const designId of Object.keys(ARCHITECTURAL_DESIGNS) as ArchitecturalDesignId[]) {
    const spec = ARCHITECTURAL_DESIGNS[designId];
    for (const [width, length] of PLOTS) {
      for (const floors of FLOORS) {
        const entry: StyleEntry = {
          id: `ST-${designId}-${width}x${length}-G${floors - 1}`,
          designId,
          style: spec.name,
          tagline: spec.tagline,
          footprint: spec.footprintType,
          plot: { width, length, units: "ft" },
          plotArea: width * length,
          floors,
          terrace: DEFAULT_TERRACE[designId],
          features: spec.features,
          orientation: spec.recommendedOrientation,
          tags: [HOME_TYPE[floors], spec.footprintType, ...(floors > 1 ? ["Terrace"] : [])],
        };
        const plan = buildStylePlan(entry);
        if (validateDesign(plan).some((i) => i.severity === "error")) continue;
        out.push(entry);
      }
    }
  }
  cached = out;
  return out;
}

export function terraceStyleName(id: TerraceDesignId): string {
  return TERRACE_DESIGNS[id].name;
}
