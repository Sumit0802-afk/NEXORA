import type { FloorPlan } from "@houseplan/design-schema";
import { OPEN_TYPES } from "./scene-geometry";
import { DEFAULT_EXTERIOR_CONFIG, type ExteriorConfig } from "./terrace-catalog";

/**
 * The plot's boundary wall: settings stored with the plan (in exteriorConfig), and the one layout both the 2D editor
 * and the 3D viewers draw from. Coordinates are plan feet or metres: x along the street, y away from it (y = 0 is
 * the street side). The wall's outer face sits on the plot line, so it never leaves the plot.
 */

export type BoundaryStyle = "modern" | "minimalist" | "decorative" | "traditional";
export type BoundarySide = "front" | "rear" | "left" | "right";

export type BoundarySettings = {
  enabled: boolean;
  height: number;
  thickness: number;
  style: BoundaryStyle;
  color: string;
  materialId: string;
  mainGate: boolean;
  gateWidth: number;
  /** Centre of the main gate along the street side, or null to place it at the parking bay or the middle. */
  gateCenter: number | null;
  pedestrianGate: boolean;
};

export const BOUNDARY_STYLES: { id: BoundaryStyle; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "minimalist", label: "Minimalist" },
  { id: "decorative", label: "Decorative" },
  { id: "traditional", label: "Traditional" },
];

export function boundaryOf(plan: FloorPlan): BoundarySettings {
  const ext = { ...DEFAULT_EXTERIOR_CONFIG, ...(plan.exteriorConfig as Partial<ExteriorConfig> | undefined) };
  const ft = plan.units === "m" ? 0.3048 : 1;
  return {
    enabled: ext.hasBoundaryWall,
    height: ext.boundaryWallHeight * ft,
    thickness: (ext.boundaryThickness ?? 0.75) * ft,
    style: ext.boundaryStyle ?? "modern",
    color: ext.boundaryColor ?? "#E4DFD4",
    materialId: ext.boundaryMaterial ?? "paint_matte",
    mainGate: ext.hasMainGate,
    gateWidth: (ext.gateWidth ?? 12) * ft,
    gateCenter: ext.gateCenter === undefined || ext.gateCenter === null ? null : ext.gateCenter * ft,
    pedestrianGate: ext.hasPedestrianGate ?? true,
  };
}

/** A copy of the plan with boundary settings changed; lengths are given in feet whatever the plan's units. */
export function withBoundaryConfig(plan: FloorPlan, patch: Partial<ExteriorConfig>): FloorPlan {
  return { ...plan, exteriorConfig: { ...DEFAULT_EXTERIOR_CONFIG, ...(plan.exteriorConfig as Partial<ExteriorConfig> | undefined), ...patch } as unknown as Record<string, unknown> };
}

export type BoundaryRun = { id: string; side: BoundarySide; from: [number, number]; to: [number, number] };
export type BoundaryPillar = { x: number; y: number; size: number };
export type BoundaryGate = { id: string; kind: "main" | "pedestrian"; from: number; to: number };

export type BoundaryLayout = {
  settings: BoundarySettings;
  runs: BoundaryRun[];
  pillars: BoundaryPillar[];
  gates: BoundaryGate[];
  notes: string[];
};

const EPS = 0.01;

function subtract(from: number, to: number, blocks: [number, number][]): [number, number][] {
  let spans: [number, number][] = [[from, to]];
  for (const [a, b] of blocks) {
    spans = spans.flatMap(([s, e]): [number, number][] => {
      if (b <= s + EPS || a >= e - EPS) return [[s, e]];
      const parts: [number, number][] = [];
      if (a > s + EPS) parts.push([s, a]);
      if (b < e - EPS) parts.push([b, e]);
      return parts;
    });
  }
  return spans.filter(([a, b]) => b - a > EPS);
}

export function boundaryLayout(plan: FloorPlan): BoundaryLayout {
  const settings = boundaryOf(plan);
  const empty = { settings, runs: [], pillars: [], gates: [], notes: [] };
  if (!settings.enabled) return empty;
  const W = plan.plot.width, L = plan.plot.length, t = settings.thickness;
  const ft = plan.units === "m" ? 0.3048 : 1;
  const rooms = (plan.levels[0]?.rooms ?? []).map((r) => {
    const xs = r.polygon.map((p) => p[0]), ys = r.polygon.map((p) => p[1]);
    return { type: r.type, name: r.name, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  // Where the house itself stands on the plot line, its own wall is the boundary there.
  const built = rooms.filter((r) => !OPEN_TYPES.has(r.type) && !/terrace|deck|porch|verandah?/i.test(r.name ?? ""));
  const blocked = (side: BoundarySide): [number, number][] =>
    built.flatMap((r): [number, number][] => {
      if (side === "front" && r.y0 < t) return [[r.x0, r.x1]];
      if (side === "rear" && r.y1 > L - t) return [[r.x0, r.x1]];
      if (side === "left" && r.x1 > W - t) return [[r.y0, r.y1]];
      if (side === "right" && r.x0 < t) return [[r.y0, r.y1]];
      return [];
    });

  const notes: string[] = [];
  const pillar = Math.max(1.25 * ft, t * 1.8);
  const front = subtract(0, W, blocked("front"));
  const gates: BoundaryGate[] = [];
  const openings: [number, number][] = [];
  const pillars: BoundaryPillar[] = [];
  const jambs = (a: number, b: number) => {
    pillars.push({ x: a - pillar / 2, y: t / 2, size: pillar }, { x: b + pillar / 2, y: t / 2, size: pillar });
  };

  if (settings.mainGate) {
    const parking = rooms.find((r) => r.type === "parking" && r.y0 < t);
    const wanted = settings.gateCenter ?? (parking ? (parking.x0 + parking.x1) / 2 : W / 2);
    const span = front.find(([a, b]) => wanted > a && wanted < b) ?? [...front].sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
    if (span && span[1] - span[0] > 4 * ft + pillar * 2) {
      const width = Math.min(settings.gateWidth, span[1] - span[0] - pillar * 2);
      const center = Math.min(span[1] - pillar - width / 2, Math.max(span[0] + pillar + width / 2, wanted));
      gates.push({ id: "gate:main", kind: "main", from: center - width / 2, to: center + width / 2 });
      openings.push([center - width / 2, center + width / 2]);
      jambs(center - width / 2, center + width / 2);
      if (settings.pedestrianGate) {
        const pw = 3.5 * ft, gap = 3 * ft;
        const right = center + width / 2 + pillar + gap;
        const left = center - width / 2 - pillar - gap - pw;
        const at = right + pw + pillar <= span[1] ? right : left - pillar >= span[0] ? left : null;
        if (at === null) notes.push("There is no room beside the main gate for a pedestrian gate.");
        else {
          gates.push({ id: "gate:pedestrian", kind: "pedestrian", from: at, to: at + pw });
          openings.push([at, at + pw]);
          jambs(at, at + pw);
        }
      }
    } else {
      notes.push("The house fills the street side, so there is no room for a gate.");
    }
  }

  const runs: BoundaryRun[] = [];
  const push = (side: BoundarySide, spans: [number, number][], at: (v: number) => [number, number]) =>
    spans.forEach(([a, b], i) => runs.push({ id: `boundary:${side}-${i}`, side, from: at(a), to: at(b) }));
  // Front and rear run the full width and own the corners; the sides fit between them, so no piece overlaps another.
  push("front", subtract(0, W, [...blocked("front"), ...openings]), (v) => [v, t / 2]);
  push("rear", subtract(0, W, blocked("rear")), (v) => [v, L - t / 2]);
  push("right", subtract(t, L - t, blocked("right")), (v) => [t / 2, v]);
  push("left", subtract(t, L - t, blocked("left")), (v) => [W - t / 2, v]);
  return { settings, runs, pillars, gates, notes };
}
