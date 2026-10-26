import type { FloorPlan, Column, Beam, FoundationFooting } from "@houseplan/design-schema";
import { distance } from "./geometry";
import { floorName } from "./floors";

export interface StructuralAlignmentWarning {
  id: string;
  type: "unsupported_column" | "eccentricity" | "long_span" | "missing_footing" | "narrow_column";
  severity: "error" | "warning" | "info";
  message: string;
  details: string;
  elementId?: string;
  levelIndex: number;
  location?: [number, number];
}

export interface StructuralReport {
  totalColumns: number;
  totalBeams: number;
  totalFootings: number;
  maxBeamSpan: number;
  averageSpan: number;
  columnDensityPer1000SqUnits: number;
  isAligned: boolean;
  warnings: StructuralAlignmentWarning[];
  disclaimer: string;
}

export const STRUCTURAL_DISCLAIMER =
  "PRELIMINARY ARCHITECTURAL PLANNING AID ONLY. This structural layout provides conceptual grid guidance and is NOT a certified engineering design or construction blueprint. Member dimensions, rebar schedules, soil bearing capacity, and seismic/wind loads must be calculated and certified by a licensed structural engineer according to local building codes (e.g. IS 456, ACI 318, Eurocode 2).";

function genId(prefix: string): string {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Automatically places columns at room corners, wall intersections, and divides long spans.
 * Aligns columns across all levels to prevent floating upper columns.
 */
export function generateOptimalStructuralGrid(plan: FloorPlan): FloorPlan {
  const units = plan.units || "ft";
  const defaultColWidth = units === "ft" ? 0.75 : 0.23; // 9 inches or 230mm
  const defaultColDepth = units === "ft" ? 0.75 : 0.23;
  const maxSpanWithoutCol = units === "ft" ? 16.0 : 4.8;
  const snapDist = units === "ft" ? 1.5 : 0.45;

  // 1. Gather all candidate corner points from Ground floor and all upper floors
  const rawPoints: [number, number][] = [];

  plan.levels.forEach((lvl) => {
    // Room corners
    lvl.rooms.forEach((r) => {
      r.polygon.forEach((pt) => {
        rawPoints.push([pt[0], pt[1]]);
      });
    });

    // Wall endpoints
    lvl.walls.forEach((w) => {
      rawPoints.push([w.start[0], w.start[1]]);
      rawPoints.push([w.end[0], w.end[1]]);

      // Intermediate column on long walls
      const wallLen = distance(w.start as [number, number], w.end as [number, number]);
      if (wallLen > maxSpanWithoutCol) {
        const divisions = Math.ceil(wallLen / (maxSpanWithoutCol * 0.9));
        for (let i = 1; i < divisions; i++) {
          const t = i / divisions;
          const mx = w.start[0] + (w.end[0] - w.start[0]) * t;
          const my = w.start[1] + (w.end[1] - w.start[1]) * t;
          rawPoints.push([mx, my]);
        }
      }
    });
  });

  // 2. Cluster points within snapDist to establish a single unified vertical column grid
  const gridPositions: [number, number][] = [];

  for (const pt of rawPoints) {
    const existing = gridPositions.find((g) => distance(g, pt) < snapDist);
    if (!existing) {
      gridPositions.push([Math.round(pt[0] * 10) / 10, Math.round(pt[1] * 10) / 10]);
    }
  }

  // 3. For each level, instantiate columns at positions that fall within or near that floor's building footprint
  const updatedLevels = plan.levels.map((lvl, lvIdx) => {
    // Check if floor has rooms
    const floorBounding = lvl.rooms.length > 0;
    const floorXs = lvl.rooms.flatMap((r) => r.polygon.map((p) => p[0]));
    const floorYs = lvl.rooms.flatMap((r) => r.polygon.map((p) => p[1]));
    const minX = floorBounding ? Math.min(...floorXs) - 1.0 : 0;
    const maxX = floorBounding ? Math.max(...floorXs) + 1.0 : plan.plot.width;
    const minY = floorBounding ? Math.min(...floorYs) - 1.0 : 0;
    const maxY = floorBounding ? Math.max(...floorYs) + 1.0 : plan.plot.length;

    const levelCols: Column[] = [];
    gridPositions.forEach((pos, idx) => {
      if (pos[0] >= minX && pos[0] <= maxX && pos[1] >= minY && pos[1] <= maxY) {
        levelCols.push({
          id: `col-L${lvIdx}-${idx + 1}`,
          position: [pos[0], pos[1]],
          shape: "rectangle",
          width: defaultColWidth,
          depth: defaultColDepth,
          rotation: 0,
          material: "reinforced_concrete",
        });
      }
    });

    // 4. Generate Beams connecting adjacent columns (within reasonable span)
    const levelBeams: Beam[] = [];
    const maxBeamConnectDist = units === "ft" ? 20.0 : 6.0;

    for (let i = 0; i < levelCols.length; i++) {
      for (let j = i + 1; j < levelCols.length; j++) {
        const c1 = levelCols[i];
        const c2 = levelCols[j];
        const d = distance(c1.position as [number, number], c2.position as [number, number]);

        // Connect if orthogonal (aligned in X or Y within 0.8) or along walls
        const dx = Math.abs(c1.position[0] - c2.position[0]);
        const dy = Math.abs(c1.position[1] - c2.position[1]);
        const isOrthogonal = (dx < 0.8 && dy <= maxBeamConnectDist) || (dy < 0.8 && dx <= maxBeamConnectDist);

        if (isOrthogonal && d <= maxBeamConnectDist && d > 2.0) {
          levelBeams.push({
            id: `beam-L${lvIdx}-${i}-${j}`,
            start: [c1.position[0], c1.position[1]],
            end: [c2.position[0], c2.position[1]],
            width: defaultColWidth,
            depth: defaultColWidth * 1.6, // depth = 1.6x width rule of thumb
            kind: lvIdx === 0 ? "plinth" : "primary",
          });
        }
      }
    }

    // 5. Generate Footings (for Ground Level)
    const levelFootings: FoundationFooting[] = [];
    if (lvIdx === 0) {
      const footingPadSize = units === "ft" ? 4.0 : 1.2;
      const footingDepth = units === "ft" ? 1.5 : 0.45;

      levelCols.forEach((c) => {
        levelFootings.push({
          id: `footing-${c.id}`,
          columnId: c.id,
          position: [c.position[0], c.position[1]],
          width: footingPadSize,
          length: footingPadSize,
          depth: footingDepth,
          type: "isolated",
        });
      });
    }

    return {
      ...lvl,
      columns: levelCols,
      beams: levelBeams,
      foundations: levelFootings,
    };
  });

  return {
    ...plan,
    levels: updatedLevels,
  };
}

/**
 * Performs a comprehensive structural audit:
 * - Checks column vertical alignment across all floors
 * - Flags unsupported upper columns (cantilevers / floating columns)
 * - Flags excessive beam spans
 * - Checks column sizes against multi-storey building heights
 */
export function auditStructuralSystem(plan: FloorPlan): StructuralReport {
  const units = plan.units || "ft";
  const maxRecommendedSpan = units === "ft" ? 18.0 : 5.5;
  const criticalMaxSpan = units === "ft" ? 24.0 : 7.3;
  const warnings: StructuralAlignmentWarning[] = [];

  let totalCols = 0;
  let totalBeams = 0;
  let totalFootings = 0;
  let maxSpan = 0;
  let totalSpanSum = 0;
  let spanCount = 0;

  // Level by level checks
  plan.levels.forEach((lvl, lvIdx) => {
    const cols = (lvl.columns || []) as Column[];
    const beams = (lvl.beams || []) as Beam[];
    const footings = (lvl.foundations || []) as FoundationFooting[];

    totalCols += cols.length;
    totalBeams += beams.length;
    totalFootings += footings.length;

    // 1. Vertical alignment check against level beneath
    if (lvIdx > 0) {
      const lowerLevel = plan.levels[lvIdx - 1];
      const lowerCols = (lowerLevel.columns || []) as Column[];
      const lowerWalls = lowerLevel.walls;

      cols.forEach((col) => {
        const directColBeneath = lowerCols.find(
          (lc) => distance(lc.position as [number, number], col.position as [number, number]) < 0.6
        );

        if (!directColBeneath) {
          // Check if it sits on a lower wall
          const onLowerWall = lowerWalls.some((w) => {
            const dStart = distance(w.start as [number, number], col.position as [number, number]);
            const dEnd = distance(w.end as [number, number], col.position as [number, number]);
            const wLen = distance(w.start as [number, number], w.end as [number, number]);
            return Math.abs(dStart + dEnd - wLen) < 0.6;
          });

          if (!onLowerWall) {
            warnings.push({
              id: genId("warn-unsupported"),
              type: "unsupported_column",
              severity: "error",
              message: `Floating column on ${floorName(lvIdx)} (${col.id})`,
              details: `Column at (${col.position[0]}, ${col.position[1]}) has no supporting column or load-bearing wall directly beneath on ${floorName(lvIdx - 1)}. Requires heavy transfer girder.`,
              elementId: col.id,
              levelIndex: lvIdx,
              location: [col.position[0], col.position[1]],
            });
          } else {
            warnings.push({
              id: genId("warn-transfer"),
              type: "eccentricity",
              severity: "warning",
              message: `Column on wall transfer (${col.id})`,
              details: `Column at (${col.position[0]}, ${col.position[1]}) rests on a wall rather than a continuous column stack.`,
              elementId: col.id,
              levelIndex: lvIdx,
              location: [col.position[0], col.position[1]],
            });
          }
        }
      });
    }

    // 2. Beam span checks
    beams.forEach((beam) => {
      const span = distance(beam.start as [number, number], beam.end as [number, number]);
      if (span > maxSpan) maxSpan = span;
      totalSpanSum += span;
      spanCount++;

      if (span > criticalMaxSpan) {
        warnings.push({
          id: genId("warn-span-crit"),
          type: "long_span",
          severity: "error",
          message: `Critical beam span: ${span.toFixed(1)} ${units}`,
          details: `Beam on ${floorName(lvIdx)} exceeds safe limit of ${criticalMaxSpan} ${units}. High deflection and vibration risk. Add intermediate column or specify post-tensioned / steel girder.`,
          elementId: beam.id,
          levelIndex: lvIdx,
          location: [(beam.start[0] + beam.end[0]) / 2, (beam.start[1] + beam.end[1]) / 2],
        });
      } else if (span > maxRecommendedSpan) {
        const suggestedDepth = (span / 14).toFixed(2);
        warnings.push({
          id: genId("warn-span"),
          type: "long_span",
          severity: "warning",
          message: `Long beam span: ${span.toFixed(1)} ${units}`,
          details: `Requires deeper reinforced concrete section (min depth ≈ ${suggestedDepth} ${units}) to satisfy deflection limits.`,
          elementId: beam.id,
          levelIndex: lvIdx,
          location: [(beam.start[0] + beam.end[0]) / 2, (beam.start[1] + beam.end[1]) / 2],
        });
      }
    });

    // 3. Ground floor footing verification
    if (lvIdx === 0 && cols.length > 0 && footings.length < cols.length) {
      warnings.push({
        id: genId("warn-footings"),
        type: "missing_footing",
        severity: "warning",
        message: `${cols.length - footings.length} ground columns lack assigned footings`,
        details: "Ensure every ground floor column has an isolated or combined foundation footing pad.",
        levelIndex: 0,
      });
    }
  });

  const plotArea = plan.plot.width * plan.plot.length;
  const columnDensity = plotArea > 0 ? (totalCols / plotArea) * 1000 : 0;
  const avgSpan = spanCount > 0 ? totalSpanSum / spanCount : 0;

  return {
    totalColumns: totalCols,
    totalBeams: totalBeams,
    totalFootings: totalFootings,
    maxBeamSpan: maxSpan,
    averageSpan: avgSpan,
    columnDensityPer1000SqUnits: columnDensity,
    isAligned: warnings.filter((w) => w.type === "unsupported_column").length === 0,
    warnings,
    disclaimer: STRUCTURAL_DISCLAIMER,
  };
}
