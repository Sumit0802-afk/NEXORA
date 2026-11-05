import type { FloorPlan } from "@houseplan/design-schema";
import { boundaryLayout, type BoundaryLayout, type BoundarySettings } from "../boundary";
import type { Prim, Vec3 } from "./model";
import type { Finish } from "./schema";

/** The boundary wall as building parts, for both the plain 3D view and the designed house. */

export type BoundaryPiece = { id: string; kind: "boundary" | "gate"; label: string; prims: Prim[] };

const SIDE_LABEL = { front: "Street-side boundary wall", rear: "Rear boundary wall", left: "Left boundary wall", right: "Right boundary wall" };

export function boundaryPieces(plan: FloorPlan, layout: BoundaryLayout = boundaryLayout(plan)): BoundaryPiece[] {
  const { settings: s, runs, pillars, gates } = layout;
  if (!s.enabled) return [];
  const ft = plan.units === "m" ? 0.3048 : 1;
  const W = plan.plot.width, L = plan.plot.length;
  const at = (x: number, y: number, h: number): Vec3 => [x - W / 2, h, y - L / 2];
  const t = s.thickness, h = s.height;
  const box = (part: string, center: Vec3, size: Vec3): Prim => ({ kind: "box", part, center, size });
  const pieces: BoundaryPiece[] = [];

  for (const run of runs) {
    const horizontal = run.from[1] === run.to[1];
    const len = horizontal ? run.to[0] - run.from[0] : run.to[1] - run.from[1];
    const mx = (run.from[0] + run.to[0]) / 2, my = (run.from[1] + run.to[1]) / 2;
    const size = (l: number, height: number, depth: number): Vec3 => (horizontal ? [l, height, depth] : [depth, height, l]);
    const prims: Prim[] = [];
    const solid = s.style === "decorative" ? h * 0.55 : h;
    prims.push(box("compound", at(mx, my, solid / 2), size(len, solid, t)));
    if (s.style === "decorative") {
      prims.push(box("boundaryCoping", at(mx, my, solid + 0.06 * ft), size(len, 0.12 * ft, t + 0.12 * ft)));
      prims.push(box("gate", at(mx, my, h - 0.05 * ft), size(len, 0.1 * ft, 0.12 * ft)));
      const bars = Math.max(1, Math.floor(len / (0.45 * ft)));
      for (let i = 0; i < bars; i++) {
        const along = (horizontal ? run.from[0] : run.from[1]) + ((i + 0.5) * len) / bars;
        const [bx, by] = horizontal ? [along, my] : [mx, along];
        prims.push(box("gate", at(bx, by, (solid + h) / 2), [0.07 * ft, h - solid, 0.07 * ft]));
      }
    } else if (s.style === "modern") {
      prims.push(box("boundaryCoping", at(mx, my, h + 0.05 * ft), size(len, 0.1 * ft, t + 0.08 * ft)));
    } else if (s.style === "traditional") {
      prims.push(box("boundaryCoping", at(mx, my, h + 0.12 * ft), size(len, 0.24 * ft, t + 0.36 * ft)));
      prims.push(box("boundaryCoping", at(mx, my, 0.3 * ft), size(len, 0.6 * ft, t + 0.14 * ft)));
    }
    pieces.push({ id: run.id, kind: "boundary", label: SIDE_LABEL[run.side], prims });
  }

  const pillarPrims: Prim[] = [];
  const top = h + (s.style === "traditional" ? 1 : 0.6) * ft;
  for (const p of pillars) {
    pillarPrims.push(box("boundaryPillar", at(p.x, p.y, top / 2), [p.size, top, p.size]));
    if (s.style !== "minimalist") pillarPrims.push(box("boundaryCoping", at(p.x, p.y, top + 0.1 * ft), [p.size + 0.2 * ft, 0.2 * ft, p.size + 0.2 * ft]));
    if (s.style === "traditional") pillarPrims.push({ kind: "blob", part: "boundaryCoping", center: at(p.x, p.y, top + 0.45 * ft), radius: 0.28 * ft });
  }
  if (pillarPrims.length) pieces.push({ id: "boundary:pillars", kind: "boundary", label: "Gate pillars", prims: pillarPrims });

  for (const gate of gates) {
    const prims: Prim[] = [];
    const y = t / 2, gh = (gate.kind === "main" ? h : h - 0.3 * ft);
    const leaves = gate.kind === "main" ? 2 : 1;
    const width = gate.to - gate.from;
    for (let l = 0; l < leaves; l++) {
      const x0 = gate.from + (l * width) / leaves + 0.05 * ft, x1 = gate.from + ((l + 1) * width) / leaves - 0.05 * ft;
      const cx = (x0 + x1) / 2, lw = x1 - x0;
      const bottom = 0.2 * ft;
      prims.push(box("gate", at(cx, y, bottom + 0.05 * ft), [lw, 0.1 * ft, 0.1 * ft]), box("gate", at(cx, y, gh - 0.05 * ft), [lw, 0.1 * ft, 0.1 * ft]));
      prims.push(box("gate", at(x0 + 0.05 * ft, y, (bottom + gh) / 2), [0.1 * ft, gh - bottom, 0.1 * ft]), box("gate", at(x1 - 0.05 * ft, y, (bottom + gh) / 2), [0.1 * ft, gh - bottom, 0.1 * ft]));
      if (s.style === "minimalist") prims.push(box("gate", at(cx, y, (bottom + gh) / 2), [lw - 0.2 * ft, gh - bottom - 0.2 * ft, 0.04 * ft]));
      else if (s.style === "modern") {
        const slats = Math.max(3, Math.floor((gh - bottom) / (0.4 * ft)));
        for (let i = 1; i < slats; i++) prims.push(box("gate", at(cx, y, bottom + (i * (gh - bottom)) / slats), [lw - 0.1 * ft, 0.16 * ft, 0.05 * ft]));
      } else {
        const bars = Math.max(2, Math.floor(lw / (0.42 * ft)));
        for (let i = 1; i < bars; i++) {
          const bx = x0 + (i * lw) / bars;
          prims.push(box("gate", at(bx, y, (bottom + gh) / 2), [0.06 * ft, gh - bottom, 0.06 * ft]));
          if (s.style === "traditional") prims.push({ kind: "blob", part: "gate", center: at(bx, y, gh + 0.12 * ft), radius: 0.08 * ft, squash: 1.6 });
        }
      }
    }
    pieces.push({ id: gate.id, kind: "gate", label: gate.kind === "main" ? "Main gate" : "Pedestrian gate", prims });
  }
  return pieces;
}

/** How each boundary part looks. The wall and pillars take the chosen finish; coping and gates follow the style. */
export function boundarySurface(part: string, s: BoundarySettings): Finish | null {
  switch (part) {
    case "compound":
    case "boundaryPillar":
      return { materialId: s.materialId, color: s.color };
    case "boundaryCoping":
      return s.style === "traditional" ? { materialId: "stone_limestone", color: "#E2DACA" } : { materialId: "paint_satin", color: s.style === "decorative" ? "#F1EEE8" : "#3A3B40" };
    case "gate":
      return { materialId: "metal_powder", color: s.style === "traditional" ? "#1E1F24" : "#2B2C33" };
    default:
      return null;
  }
}
