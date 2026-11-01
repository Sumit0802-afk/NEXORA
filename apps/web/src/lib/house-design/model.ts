import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import { OPEN_TYPES, type DoorLeaf, type RoomFloor, type SceneGeometry, type WindowPane } from "../scene-geometry";
import type { RailingStyle } from "../terrace-catalog";
import { EPS, isEnclosed, mergeRects, rectOf, subtract, type Pt, type Rect } from "./geometry-engine";
import type { SceneObject, ObjectKind } from "./objects";
import { ELEVATION_LABEL, type CeilingStyle, type DoorDesign, type Elevation, type HouseDesign, type ObjectOverride, type WindowGrid, type WindowShape, type WindowTrim } from "./schema";

export { mergeRects, withFacadeOpenings } from "./geometry-engine";
export type { Pt } from "./geometry-engine";

/**
 * Model assembly: combines the plan's base geometry with a design into named building parts. Pure data and no Three.js,
 * so it is testable and a colour change never rebuilds geometry. Rooms, walls and openings come straight from the
 * plan; everything here is added around them (roof, cladding, window assemblies) and no room or wall ever moves.
 * Every editable thing carries a semantic object id, which stays the same between rebuilds of the same plan.
 */

export type Vec3 = [number, number, number];

type Tagged = { part: string; object?: string };

export type Prim = Tagged &
  (
    | { kind: "box"; center: Vec3; size: Vec3; rot?: Vec3 }
    | { kind: "extrude"; outline: Pt[]; holes?: Pt[][]; depth: number; center: Vec3; rotY: number }
    | { kind: "cylinder"; center: Vec3; radiusTop: number; radiusBottom: number; height: number; segments?: number }
    | { kind: "blob"; center: Vec3; radius: number; squash?: number }
    | { kind: "polygon"; points: Vec3[]; uv: Pt[] }
  );

export type ModelLight = { position: Vec3; intensity: number; distance: number };

export type DesignModel = {
  prims: Prim[];
  lights: ModelLight[];
  entry: Entry | null;
  /** Height the top of the building reaches, for framing and rooftop items. */
  roofTop: number;
  /** True when rooftop items (terrace rail, stair cabin) make sense on this roof. */
  walkableRoof: boolean;
  /** Every selectable object in the house. */
  objects: SceneObject[];
};

type Entry = { x: number; z: number; normal: Pt; width: number; height: number; street: boolean };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Frame {
  constructor(private out: Prim[], private x: number, private y: number, private z: number, readonly rotY: number) {}
  point(lx: number, ly: number, lz: number): Vec3 {
    const c = Math.cos(this.rotY), s = Math.sin(this.rotY);
    return [this.x + lx * c + lz * s, this.y + ly, this.z - lx * s + lz * c];
  }
  box(part: string, at: Vec3, size: Vec3, tilt = 0) {
    this.out.push({ kind: "box", part, center: this.point(...at), size, rot: [tilt, this.rotY, 0] });
  }
  extrude(part: string, outline: Pt[], holes: Pt[][] | undefined, depth: number, lz = 0) {
    this.out.push({ kind: "extrude", part, outline, holes, depth, center: this.point(0, 0, lz), rotY: this.rotY });
  }
  cylinder(part: string, at: Vec3, radius: number, height: number, segments = 12, topRadius = radius) {
    this.out.push({ kind: "cylinder", part, center: this.point(...at), radiusTop: topRadius, radiusBottom: radius, height, segments });
  }
}

// ── Opening outlines ─────────────────────────────────────────────────────────

const rectOutline = (w: number, h: number): Pt[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

function arcTop(w: number, h: number, rise: number, steps = 16): Pt[] {
  const pts: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2]];
  const spring = h / 2 - rise;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI;
    pts.push([(Math.cos(t) * w) / 2, spring + Math.sin(t) * rise]);
  }
  return pts;
}

/** Outline of an opening of size w × h centred on the origin. Every shape stays inside the plan's rectangular opening. */
export function openingOutline(shape: WindowShape, w: number, h: number): Pt[] {
  switch (shape) {
    case "arched":
      return arcTop(w, h, Math.min(w / 2, h * 0.5));
    case "segmental":
      return arcTop(w, h, Math.min(w * 0.2, h * 0.22), 10);
    case "round": {
      const r = Math.min(w, h) / 2;
      return Array.from({ length: 28 }, (_, i): Pt => [Math.cos((i / 28) * Math.PI * 2) * r, Math.sin((i / 28) * Math.PI * 2) * r]);
    }
    case "gothic": {
      const rise = Math.min(w * 0.8, h * 0.5), spring = h / 2 - rise;
      const pts: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2]];
      const curve = (t: number): Pt => [(w / 2) * Math.cos(t * (Math.PI / 2)) ** 0.7, spring + rise * Math.sin(t * (Math.PI / 2))];
      for (let i = 0; i <= 8; i++) pts.push(curve(i / 8));
      for (let i = 7; i >= 0; i--) {
        const [x, y] = curve(i / 8);
        pts.push([-x, y]);
      }
      return pts;
    }
    default:
      return rectOutline(w, h);
  }
}

// ── Facade helpers ───────────────────────────────────────────────────────────

type Face = { object: string; level: number; horizontal: boolean; side: 1 | -1; plane: number; from: number; to: number; y0: number; y1: number };

function addVeneer(out: Prim[], part: string, face: Face, from: number, to: number, y0: number, y1: number, depth: number) {
  if (to - from < EPS || y1 - y0 < EPS) return;
  const mid = (from + to) / 2, plane = face.plane + (face.side * depth) / 2, cy = (y0 + y1) / 2;
  out.push(
    face.horizontal
      ? { kind: "box", part, center: [mid, cy, plane], size: [to - from, y1 - y0, depth] }
      : { kind: "box", part, center: [plane, cy, mid], size: [depth, y1 - y0, to - from] }
  );
}

function railRun(out: Prim[], a: Pt, b: Pt, y: number, style: RailingStyle, height: number, ft: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.5 * ft) return;
  const f = new Frame(out, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, -Math.atan2(dz, dx));
  const posts = Math.max(1, Math.round(length / (4.5 * ft)));
  const postAt = (i: number) => -length / 2 + (i * length) / posts;

  switch (style) {
    case "glass":
      f.box("railGlass", [0, height / 2, 0], [length - 0.05 * ft, height - 0.1 * ft, 0.06 * ft]);
      f.box("railing", [0, height, 0], [length + 0.05 * ft, 0.07 * ft, 0.12 * ft]);
      for (let i = 0; i <= posts; i++) f.box("railing", [postAt(i), 0.25 * ft, 0], [0.08 * ft, 0.5 * ft, 0.16 * ft]);
      break;
    case "metal_slats": {
      for (let i = 0; i <= posts; i++) f.box("railing", [postAt(i), height / 2, 0], [0.1 * ft, height, 0.1 * ft]);
      const bars = Math.round(height / (0.42 * ft));
      for (let i = 1; i <= bars; i++) f.box("railing", [0, (i * height) / bars, 0], [length, 0.08 * ft, 0.05 * ft]);
      break;
    }
    case "baluster": {
      f.box("railing", [0, 0.16 * ft, 0], [length, 0.32 * ft, 0.42 * ft]);
      f.box("railing", [0, height, 0], [length + 0.06 * ft, 0.2 * ft, 0.46 * ft]);
      const count = Math.floor(length / (0.62 * ft));
      for (let i = 1; i < count; i++) {
        const lx = -length / 2 + (i * length) / count;
        f.cylinder("railing", [lx, height * 0.36, 0], 0.13 * ft, height * 0.42, 8, 0.07 * ft);
        f.cylinder("railing", [lx, height * 0.74, 0], 0.07 * ft, height * 0.34, 8, 0.11 * ft);
      }
      break;
    }
    case "jali": {
      const hole = 0.42 * ft;
      const columns = Math.max(1, Math.floor(length / (0.72 * ft)));
      const rows = Math.max(1, Math.floor((height - 0.5 * ft) / (0.72 * ft)));
      const holes: Pt[][] = [];
      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows; r++) {
          const cx = -length / 2 + ((c + 0.5) * length) / columns;
          const cy = -height / 2 + 0.25 * ft + ((r + 0.5) * (height - 0.5 * ft)) / rows;
          holes.push([[cx, cy - hole / 2], [cx + hole / 2, cy], [cx, cy + hole / 2], [cx - hole / 2, cy]]);
        }
      }
      new Frame(out, (a[0] + b[0]) / 2, y + height / 2, (a[1] + b[1]) / 2, f.rotY).extrude("railing", rectOutline(length, height), holes, 0.22 * ft);
      f.box("railing", [0, height + 0.06 * ft, 0], [length + 0.08 * ft, 0.12 * ft, 0.36 * ft]);
      break;
    }
    default:
      f.box("balconySlab", [0, height / 2, 0], [length, height, 0.3 * ft]);
      f.box("railing", [0, height + 0.05 * ft, 0], [length + 0.08 * ft, 0.1 * ft, 0.38 * ft]);
  }
}

// ── Roof ─────────────────────────────────────────────────────────────────────

type RoofContext = { out: Prim[]; design: HouseDesign; ft: number };

/** One roof plane with a thickness: the top surface, a soffit under it and an edge strip all round. */
function roofPlate(ctx: RoofContext, top: Vec3[], uv: Pt[], thickness: number) {
  const { out } = ctx;
  out.push({ kind: "polygon", part: "roof", points: top, uv });
  const under = top.map((p): Vec3 => [p[0], p[1] - thickness, p[2]]);
  out.push({ kind: "polygon", part: "soffit", points: [...under].reverse(), uv: [...uv].reverse() });
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length], c = under[(i + 1) % top.length], d = under[i];
    out.push({ kind: "polygon", part: "fascia", points: [a, d, c, b], uv: [[0, 0], [0, thickness], [Math.hypot(b[0] - a[0], b[2] - a[2]), thickness], [Math.hypot(b[0] - a[0], b[2] - a[2]), 0]] });
  }
}

function buildRoof(ctx: RoofContext, r: Rect, y0: number): number {
  const { out, design, ft } = ctx;
  const roof = design.exterior.roof;
  const width = r.x1 - r.x0, depth = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const minSide = Math.min(width, depth);
  const flatOnly = minSide < 4 * ft;
  const type = flatOnly ? "flat" : roof.type;
  const o = roof.overhang * ft;
  const alongX = width >= depth;
  const len = alongX ? width : depth, span = alongX ? depth : width;
  const at = (a: number, b: number, y: number): Vec3 => (alongX ? [cx + a, y, cz + b] : [cx + b, y, cz + a]);
  const thickness = 0.35 * ft;

  if (type === "flat" || type === "cantilever") {
    const slab = (type === "cantilever" ? 0.95 : 0.55) * ft;
    const reach = type === "cantilever" ? o : Math.min(o, 1.2 * ft);
    const W = width + reach * 2, D = depth + reach * 2;
    out.push({ kind: "box", part: "fascia", center: [cx, y0 + slab / 2, cz], size: [W, slab, D] });
    out.push({ kind: "box", part: "soffit", center: [cx, y0 - 0.02 * ft, cz], size: [W - 0.02, 0.04 * ft, D - 0.02] });
    out.push({ kind: "box", part: "roof", center: [cx, y0 + slab + 0.03 * ft, cz], size: [W - 0.16 * ft, 0.06 * ft, D - 0.16 * ft] });
    let top = y0 + slab + 0.06 * ft;
    if (roof.parapet) {
      const h = 1.6 * ft, t = 0.45 * ft;
      const edges: [Vec3, Vec3][] = [
        [[cx, 0, r.z0 - reach + t / 2], [W, h, t]],
        [[cx, 0, r.z1 + reach - t / 2], [W, h, t]],
        [[r.x0 - reach + t / 2, 0, cz], [t, h, D]],
        [[r.x1 + reach - t / 2, 0, cz], [t, h, D]],
      ];
      for (const [center, size] of edges) {
        out.push({ kind: "box", part: "gableWall", center: [center[0], top + h / 2, center[2]], size });
        out.push({ kind: "box", part: "roofTrim", center: [center[0], top + h + 0.05 * ft, center[2]], size: [size[0] + 0.1 * ft, 0.1 * ft, size[2] + 0.1 * ft] });
      }
      top += h + 0.1 * ft;
    }
    return top;
  }

  const slope = Math.tan((Math.max(8, roof.pitch) * Math.PI) / 180);
  const uvScale = 1 / Math.cos(Math.atan(slope));
  const B = span / 2 + o;
  const eaveY = y0 - o * slope;
  const ridgeY = y0 + (span / 2) * slope;

  const gableEnd = (a: number, bLow: number, bHigh: number, bPeak: number, peak: number, outward: number) => {
    const pts = [at(a, bLow, y0), at(a, bHigh, y0), at(a, bPeak, peak)];
    const ordered = outward * (alongX ? 1 : -1) > 0 ? pts : [...pts].reverse();
    out.push({ kind: "polygon", part: "gableWall", points: ordered, uv: ordered.map((p): Pt => (alongX ? [p[2], p[1]] : [p[0], p[1]])) });
  };

  if (type === "gable") {
    const A = len / 2 + Math.min(o, 1.6 * ft);
    for (const sign of [-1, 1]) {
      const top = [at(-A, sign * B, eaveY), at(A, sign * B, eaveY), at(A, 0, ridgeY), at(-A, 0, ridgeY)];
      roofPlate(ctx, top, [[-A, B * uvScale], [A, B * uvScale], [A, 0], [-A, 0]], thickness);
    }
    gableEnd(len / 2 + 0.02, -span / 2, span / 2, 0, ridgeY, 1);
    gableEnd(-len / 2 - 0.02, -span / 2, span / 2, 0, ridgeY, -1);
    return ridgeY;
  }

  if (type === "hip") {
    const A = len / 2 + o;
    const ridge = Math.max(0, len / 2 - span / 2);
    for (const sign of [-1, 1]) {
      roofPlate(ctx, [at(-A, sign * B, eaveY), at(A, sign * B, eaveY), at(ridge, 0, ridgeY), at(-ridge, 0, ridgeY)], [[-A, B * uvScale], [A, B * uvScale], [ridge, 0], [-ridge, 0]], thickness);
      roofPlate(ctx, [at(sign * A, -B, eaveY), at(sign * A, B, eaveY), at(sign * ridge, 0, ridgeY)], [[-B, (A - ridge) * uvScale], [B, (A - ridge) * uvScale], [0, 0]], thickness);
    }
    return ridgeY;
  }

  if (type === "shed") {
    const A = len / 2 + Math.min(o, 1.6 * ft);
    const rise = span * slope;
    // The high side faces the street when the ridge runs along it.
    const high = alongX ? -1 : 1;
    const yHigh = y0 + rise + o * slope, yLow = y0 - o * slope;
    roofPlate(ctx, [at(-A, high * B, yHigh), at(A, high * B, yHigh), at(A, -high * B, yLow), at(-A, -high * B, yLow)], [[-A, 0], [A, 0], [A, 2 * B * uvScale], [-A, 2 * B * uvScale]], thickness);
    const wallB = (high * span) / 2;
    const face = alongX ? new Frame(out, cx, y0 + rise / 2, cz + wallB, 0) : new Frame(out, cx + wallB, y0 + rise / 2, cz, Math.PI / 2);
    face.box("gableWall", [0, 0, 0], [len, rise, 0.74 * ft]);
    gableEnd(len / 2 + 0.02, -high * (span / 2), high * (span / 2), high * (span / 2), y0 + rise, 1);
    gableEnd(-len / 2 - 0.02, -high * (span / 2), high * (span / 2), high * (span / 2), y0 + rise, -1);
    return y0 + rise + o * slope;
  }

  // Mansard: a steep lower band with a shallow hip above it.
  const inset = Math.min(span * 0.24, 3 * ft);
  const band = Math.min(inset * 2.6, 4.6 * ft);
  const steep = band / inset;
  const lowY = y0 - o * steep * 0.25;
  const outerA = len / 2 + o * 0.5, outerB = span / 2 + o * 0.5;
  const innerA = len / 2 - inset, innerB = span / 2 - inset;
  const topY = y0 + band;
  for (const sign of [-1, 1]) {
    roofPlate(ctx, [at(-outerA, sign * outerB, lowY), at(outerA, sign * outerB, lowY), at(innerA, sign * innerB, topY), at(-innerA, sign * innerB, topY)], [[-outerA, band * 1.2], [outerA, band * 1.2], [innerA, 0], [-innerA, 0]], thickness);
    roofPlate(ctx, [at(sign * outerA, -outerB, lowY), at(sign * outerA, outerB, lowY), at(sign * innerA, innerB, topY), at(sign * innerA, -innerB, topY)], [[-outerB, band * 1.2], [outerB, band * 1.2], [innerB, 0], [-innerB, 0]], thickness);
  }
  const shallow = Math.tan((Math.min(roof.pitch, 16) * Math.PI) / 180);
  const peakY = topY + innerB * shallow;
  const ridge = Math.max(0, innerA - innerB);
  for (const sign of [-1, 1]) {
    roofPlate(ctx, [at(-innerA, sign * innerB, topY), at(innerA, sign * innerB, topY), at(ridge, 0, peakY), at(-ridge, 0, peakY)], [[-innerA, innerB], [innerA, innerB], [ridge, 0], [-ridge, 0]], thickness);
    roofPlate(ctx, [at(sign * innerA, -innerB, topY), at(sign * innerA, innerB, topY), at(sign * ridge, 0, peakY)], [[-innerB, innerB], [innerB, innerB], [0, 0]], thickness);
  }
  return peakY;
}

// ── Openings ─────────────────────────────────────────────────────────────────

function buildWindow(out: Prim[], pane: WindowPane, normal: Pt, wallThickness: number, exterior: boolean, win: { shape: WindowShape; grid: WindowGrid; trim: WindowTrim }, ft: number) {
  const rotY = Math.atan2(normal[0], normal[1]);
  const f = new Frame(out, pane.centerX, pane.baseY + pane.height / 2, pane.centerZ, rotY);
  const w = pane.width, h = pane.height;
  const bar = 0.13 * ft;
  const shape: WindowShape = exterior ? win.shape : "rectangular";
  const recess = wallThickness / 2 - 0.16 * ft;

  const outer = openingOutline(shape, w, h);
  const inner = openingOutline(shape, Math.max(w - bar * 2, 0.1), Math.max(h - bar * 2, 0.1));
  if (shape !== "rectangular") {
    // The plan's opening is rectangular; this plate closes the corners the shape leaves.
    f.extrude("walls", rectOutline(w + 0.02, h + 0.02), [outer], wallThickness - 0.02);
  }
  f.extrude("windowFrame", outer, [inner], 0.24 * ft, recess);
  f.extrude("glass", inner, undefined, 0.04 * ft, recess);

  const topAt = (x: number) => {
    if (shape === "rectangular" || shape === "round") return shape === "round" ? Math.sqrt(Math.max(0, (Math.min(w, h) / 2 - bar) ** 2 - x * x)) : h / 2 - bar;
    let best = -h / 2;
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i], b = inner[(i + 1) % inner.length];
      if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) best = Math.max(best, a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
    }
    return best;
  };
  const vertical = (x: number) => {
    const top = topAt(x), bottom = shape === "round" ? -top : -h / 2 + bar;
    if (top > bottom) f.box("windowFrame", [x, (top + bottom) / 2, recess], [0.07 * ft, top - bottom, 0.1 * ft]);
  };
  const horizontal = (y: number) => {
    const half = shape === "round" ? Math.sqrt(Math.max(0, (Math.min(w, h) / 2 - bar) ** 2 - y * y)) : w / 2 - bar;
    f.box("windowFrame", [0, y, recess], [half * 2, 0.07 * ft, 0.1 * ft]);
  };
  const grid = win.grid;
  if (grid === "vertical") {
    const count = Math.max(1, Math.round(w / (2.6 * ft)));
    for (let i = 1; i < count; i++) vertical(-w / 2 + (i * w) / count);
  } else if (grid === "cross") {
    vertical(0);
    horizontal(shape === "arched" ? h / 2 - Math.min(w / 2, h * 0.5) : 0);
  } else if (grid === "colonial") {
    const columns = Math.max(2, Math.round(w / (1.3 * ft)));
    const rows = Math.max(2, Math.round(h / (1.4 * ft)));
    for (let i = 1; i < columns; i++) vertical(-w / 2 + (i * w) / columns);
    for (let i = 1; i < rows; i++) {
      const y = -h / 2 + (i * h) / rows;
      if (shape === "rectangular" || y < h / 2 - Math.min(w / 2, h * 0.5)) horizontal(y);
    }
  }

  if (!exterior) return;
  const face = wallThickness / 2;
  f.box("trim", [0, -h / 2 - 0.05 * ft, face], [w + 0.5 * ft, 0.12 * ft, 0.34 * ft]);
  if (win.trim === "surround") {
    const ring = openingOutline(shape, w + 0.7 * ft, h + 0.7 * ft);
    f.extrude("trim", ring, [openingOutline(shape, w, h)], 0.2 * ft, face);
  } else if (win.trim === "hood") {
    f.box("trim", [0, h / 2 + 0.22 * ft, face + 0.55 * ft], [w + 1 * ft, 0.12 * ft, 1.25 * ft], 0.2);
  } else if (win.trim === "shutters") {
    const sw = Math.min(w * 0.42, 1.5 * ft);
    for (const sign of [-1, 1]) {
      const lx = sign * (w / 2 + sw / 2 + 0.08 * ft);
      f.box("shutter", [lx, 0, face + 0.04 * ft], [sw, h, 0.08 * ft]);
      const slats = Math.round(h / (0.34 * ft));
      for (let i = 1; i < slats; i++) f.box("shutterSlat", [lx, -h / 2 + (i * h) / slats, face + 0.1 * ft], [sw - 0.14 * ft, 0.05 * ft, 0.04 * ft]);
    }
  }
}

function buildLeaf(f: Frame, cx: number, leafW: number, h: number, t: number, design: DoorDesign, part: string, ft: number) {
  const glass = "doorGlass";
  switch (design) {
    case "panelled": {
      f.box(part, [cx, 0, 0], [leafW, h, t]);
      const pw = leafW * 0.32, gap = leafW * 0.08;
      for (const side of [-1, 1]) {
        for (const [y, ph] of [[h * 0.2, h * 0.42], [-h * 0.25, h * 0.36]] as const) {
          for (const face of [-1, 1]) f.box(part, [cx + side * (pw / 2 + gap / 2), y, (face * t) / 2], [pw, ph, 0.05 * ft]);
        }
      }
      break;
    }
    case "glazed":
      f.box(part, [cx, h / 2 - 0.2 * ft, 0], [leafW, 0.4 * ft, t]);
      f.box(part, [cx, -h / 2 + 0.3 * ft, 0], [leafW, 0.6 * ft, t]);
      f.box(part, [cx - leafW / 2 + 0.17 * ft, 0, 0], [0.34 * ft, h, t]);
      f.box(part, [cx + leafW / 2 - 0.17 * ft, 0, 0], [0.34 * ft, h, t]);
      f.box(glass, [cx, 0.1 * ft, 0], [leafW - 0.6 * ft, h - 1 * ft, 0.04 * ft]);
      break;
    case "slatted": {
      f.box(part, [cx, 0, 0], [leafW, h, t]);
      const rows = Math.round(leafW / (0.3 * ft));
      for (let i = 0; i < rows; i++) {
        for (const face of [-1, 1]) f.box("doorGroove", [cx - leafW / 2 + ((i + 0.5) * leafW) / rows, 0, (face * t) / 2], [0.03 * ft, h - 0.1 * ft, 0.02 * ft]);
      }
      break;
    }
    default:
      f.box(part, [cx, 0, 0], [leafW, h, t]);
  }
}

function buildDoor(out: Prim[], door: DoorLeaf, normal: Pt, wallThickness: number, look: DoorDesign, doorsOpen: boolean, ft: number) {
  const exterior = door.hostKind === "exterior";
  const part = exterior ? "door" : "interiorDoor";
  const h = door.height, w = door.width;
  const t = door.thickness;
  const open = !exterior || doorsOpen;

  if (open) {
    const cx = door.hingeX + Math.cos(door.angle) * (w / 2);
    const cz = door.hingeZ + Math.sin(door.angle) * (w / 2);
    const f = new Frame(out, cx, door.baseY + h / 2, cz, -door.angle);
    buildLeaf(f, 0, w, h, t, look === "double" || look === "arched" ? "panelled" : look, part, ft);
    f.box("hardware", [w * 0.38, 0, t / 2 + 0.05 * ft], [0.5 * ft, 0.06 * ft, 0.05 * ft]);
    f.box("hardware", [w * 0.38, 0, -t / 2 - 0.05 * ft], [0.5 * ft, 0.06 * ft, 0.05 * ft]);
    return;
  }

  const rotY = Math.atan2(normal[0], normal[1]);
  const f = new Frame(out, door.centerX, door.baseY + h / 2, door.centerZ, rotY);
  const z = wallThickness / 2 - 0.14 * ft;
  const leaf = new Frame(out, ...f.point(0, 0, z), rotY);
  if (look === "arched") {
    const outline = openingOutline("arched", w, h);
    f.extrude("walls", rectOutline(w + 0.02, h + 0.02), [outline], wallThickness - 0.02);
    leaf.extrude(part, openingOutline("arched", w - 0.06 * ft, h - 0.03 * ft), undefined, t);
    leaf.box("hardware", [0, 0, t / 2 + 0.04 * ft], [0.04 * ft, h * 0.7, 0.03 * ft]);
    f.extrude("trim", openingOutline("arched", w + 0.6 * ft, h + 0.6 * ft), [outline], 0.18 * ft, wallThickness / 2);
  } else if (look === "double") {
    for (const side of [-1, 1]) {
      buildLeaf(leaf, (side * w) / 4, w / 2 - 0.03 * ft, h, t, "panelled", part, ft);
      leaf.box("hardware", [side * 0.14 * ft, -0.2 * ft, t / 2 + 0.1 * ft], [0.05 * ft, 1.3 * ft, 0.05 * ft]);
    }
  } else {
    buildLeaf(leaf, 0, w, h, t, look, part, ft);
    leaf.box("hardware", [w / 2 - 0.34 * ft, -0.2 * ft, t / 2 + 0.1 * ft], [0.05 * ft, 1.8 * ft, 0.05 * ft]);
  }
  if (look !== "arched") {
    f.box("trim", [-w / 2 - 0.05 * ft, 0, wallThickness / 2], [0.14 * ft, h + 0.1 * ft, 0.12 * ft]);
    f.box("trim", [w / 2 + 0.05 * ft, 0, wallThickness / 2], [0.14 * ft, h + 0.1 * ft, 0.12 * ft]);
    f.box("trim", [0, h / 2 + 0.05 * ft, wallThickness / 2], [w + 0.24 * ft, 0.14 * ft, 0.12 * ft]);
  }
}

function column(out: Prim[], x: number, z: number, y0: number, height: number, ft: number, round: boolean) {
  const f = new Frame(out, x, y0, z, 0);
  const r = 0.42 * ft;
  f.box("column", [0, 0.2 * ft, 0], [r * 2.8, 0.4 * ft, r * 2.8]);
  f.box("column", [0, height - 0.2 * ft, 0], [r * 2.8, 0.4 * ft, r * 2.8]);
  if (round) f.cylinder("column", [0, height / 2, 0], r, height - 0.8 * ft, 18, r * 0.88);
  else f.box("column", [0, height / 2, 0], [r * 1.9, height - 0.8 * ft, r * 1.9]);
}

function buildPortico(out: Prim[], entry: Entry, y0: number, wallHeight: number, design: HouseDesign, ft: number) {
  const style = design.exterior.details.portico;
  if (style === "none") return;
  const rotY = Math.atan2(entry.normal[0], entry.normal[1]);
  const f = new Frame(out, entry.x, y0, entry.z, rotY);
  const width = Math.max(entry.width + 4 * ft, 8 * ft);
  const reach = 5 * ft;
  const top = Math.min(entry.height + 1.5 * ft, wallHeight - 0.2 * ft);
  f.box("step", [0, 0.2 * ft, reach / 2], [width, 0.4 * ft, reach]);
  f.box("step", [0, 0.1 * ft, reach + 0.7 * ft], [width * 0.8, 0.2 * ft, 1.4 * ft]);
  if (style === "canopy") {
    f.box("fascia", [0, top + 0.25 * ft, reach / 2], [width, 0.5 * ft, reach]);
    return;
  }
  f.box("fascia", [0, top + 0.35 * ft, reach / 2], [width + 0.6 * ft, 0.7 * ft, reach + 0.4 * ft]);
  if (style === "columns") {
    const [ax, , az] = f.point(-width / 2 + 0.6 * ft, 0, reach - 0.3 * ft);
    const [bx, , bz] = f.point(width / 2 - 0.6 * ft, 0, reach - 0.3 * ft);
    column(out, ax, az, y0 + 0.4 * ft, top - 0.4 * ft, ft, true);
    column(out, bx, bz, y0 + 0.4 * ft, top - 0.4 * ft, ft, true);
    return;
  }
  const h = top - 0.4 * ft;
  const front = new Frame(out, ...f.point(0, 0.4 * ft + h / 2, reach - 0.3 * ft), rotY);
  const opening = openingOutline("arched", width - 2.4 * ft, h);
  const frame = rectOutline(width, h);
  front.extrude("trim", frame, [opening.map(([x, y]): Pt => [x, y - 0.01 * ft])], 0.8 * ft);
}

// ── Interior ─────────────────────────────────────────────────────────────────

function buildCeiling(out: Prim[], floor: RoomFloor, y: number, style: CeilingStyle, ft: number) {
  const part = `ceiling:${floor.id}`;
  const f = new Frame(out, floor.centerX, y, floor.centerZ, 0);
  const w = floor.width, d = floor.depth;
  const inner = (style === "tray" || style === "cove") && Math.min(w, d) > 6 * ft;
  if (!inner) {
    f.box(part, [0, -0.02 * ft, 0], [w, 0.04 * ft, d]);
  } else {
    const band = 1.4 * ft, drop = 0.5 * ft;
    f.box(part, [0, -0.02 * ft, 0], [w - band * 2, 0.04 * ft, d - band * 2]);
    for (const sign of [-1, 1]) {
      f.box(part, [0, -drop / 2, (sign * (d - band)) / 2], [w, drop, band]);
      f.box(part, [(sign * (w - band)) / 2, -drop / 2, 0], [band, drop, d - band * 2]);
    }
    if (style === "cove") {
      for (const sign of [-1, 1]) {
        f.box("coveLight", [0, -drop - 0.01 * ft, (sign * (d - band * 2 - 0.1 * ft)) / 2], [w - band * 2, 0.03 * ft, 0.08 * ft]);
        f.box("coveLight", [(sign * (w - band * 2 - 0.1 * ft)) / 2, -drop - 0.01 * ft, 0], [0.08 * ft, 0.03 * ft, d - band * 2]);
      }
    }
  }
  if (style === "beams" || style === "coffered") {
    const beam = 0.32 * ft, drop = 0.36 * ft;
    const count = Math.max(2, Math.round(w / (3 * ft)));
    for (let i = 1; i < count; i++) f.box("ceilingBeam", [-w / 2 + (i * w) / count, -drop / 2, 0], [beam, drop, d]);
    if (style === "coffered") {
      const rows = Math.max(2, Math.round(d / (3 * ft)));
      for (let i = 1; i < rows; i++) f.box("ceilingBeam", [0, -drop / 2, -d / 2 + (i * d) / rows], [w, drop, beam]);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export type ModelOptions = { doorsOpen?: boolean };

/** The side of the house a wall faces, as seen from the street, which lies at world -Z. */
export function elevationOf(normal: Pt): Elevation {
  if (Math.abs(normal[1]) >= Math.abs(normal[0])) return normal[1] < 0 ? "front" : "rear";
  return normal[0] > 0 ? "left" : "right";
}

const levelName = (level: number) => (level === 0 ? "ground floor" : `floor ${level}`);

/** The part of a design that affects shape. Finishes and tints are left out: they only change materials. */
export function geometryKey(design: HouseDesign): string {
  const colourOnly = new Set(["color", "foliage", "flowerColor", "hardware", "intensity", "finishes", "source"]);
  return JSON.stringify(design, (key, value) => {
    if (colourOnly.has(key)) return undefined;
    if (value && typeof value === "object" && "materialId" in value) return undefined;
    return value;
  });
}

export function buildDesignModel(geometry: SceneGeometry, plan: FloorPlan, design: HouseDesign, options: ModelOptions = {}): DesignModel {
  const ft = plan.units === "m" ? 0.3048 : 1;
  const out: Prim[] = [];
  const lights: ModelLight[] = [];
  const ext = design.exterior;
  const registry = new Map<string, SceneObject>();
  const override = (id: string): ObjectOverride | undefined => design.overrides[id];
  /** Runs `build` and marks everything it adds as belonging to one object. */
  const asObject = (object: Omit<SceneObject, "parts" | "bounds">, build: () => void) => {
    const start = out.length;
    build();
    for (let i = start; i < out.length; i++) out[i].object = object.id;
    if (!registry.has(object.id)) registry.set(object.id, { ...object, parts: [], bounds: null });
  };
  const levels = [...new Set(geometry.floors.map((f) => f.level))].sort((a, b) => a - b);
  const levelFloors = (level: number) => geometry.floors.filter((f) => f.level === level);
  const enclosedAt = (level: number) => levelFloors(level).filter((f) => isEnclosed(f.type, f.name));
  const wallTop = (level: number) => {
    const tops = geometry.walls.filter((w) => w.level === level && w.kind !== "boundary").map((w) => w.baseY + w.height);
    const elevation = levelFloors(level)[0]?.baseY ?? 0;
    return tops.length ? Math.max(...tops) : elevation + geometry.wallHeight;
  };
  const roomAt = (level: number, x: number, z: number) =>
    enclosedAt(level).find((f) => {
      const r = rectOf(f);
      return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
    }) ?? null;

  // Which way each wall faces, and which room owns each of its two sides.
  const faces: Face[] = [];
  const slab = geometry.wallHeight * 0.014;
  const cornerKey = (level: number, x: number, z: number) => `${level}:${Math.round(x * 100)},${Math.round(z * 100)}`;
  const corners = new Map<string, { x: number; z: number; level: number; qx: number; qz: number }>();
  for (const level of levels) {
    const eps = 0.05 * ft;
    for (const floor of enclosedAt(level)) {
      const r = rectOf(floor);
      for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]] as Pt[]) {
        const quads = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([sx, sz]) => roomAt(level, x + sx * eps, z + sz * eps));
        if (quads.length === 1) corners.set(cornerKey(level, x, z), { x, z, level, qx: -quads[0][0], qz: -quads[0][1] });
      }
    }
  }

  const outwardOf = (x: number, z: number, angle: number, level: number): { normal: Pt; outside: boolean } => {
    const horizontal = Math.abs(Math.sin(angle)) < 0.5;
    const eps = 0.05 * ft;
    const minus = horizontal ? roomAt(level, x, z - eps) : roomAt(level, x - eps, z);
    const plus = horizontal ? roomAt(level, x, z + eps) : roomAt(level, x + eps, z);
    const sign = !minus && plus ? -1 : minus && !plus ? 1 : horizontal ? -1 : 1;
    return { normal: horizontal ? [0, sign] : [sign, 0], outside: !(minus && plus) };
  };

  for (const wall of geometry.walls) {
    const horizontal = Math.abs(wall.angle) < 0.1;
    const wallSide = (): Elevation | null => {
      const eps = 0.05 * ft;
      const low = horizontal ? roomAt(wall.level, wall.centerX, wall.centerZ - eps) : roomAt(wall.level, wall.centerX - eps, wall.centerZ);
      const high = horizontal ? roomAt(wall.level, wall.centerX, wall.centerZ + eps) : roomAt(wall.level, wall.centerX + eps, wall.centerZ);
      if (low && high) return null;
      return elevationOf(horizontal ? [0, low ? 1 : -1] : [low ? 1 : -1, 0]);
    };
    if (wall.kind === "boundary") {
      const id = `${wall.level > 0 ? "railing" : "boundary"}:${wall.runId}`;
      if (wall.level > 0) {
        const half = wall.length / 2;
        const a: Pt = Math.abs(wall.angle) < 0.1 ? [wall.centerX - half, wall.centerZ] : [wall.centerX, wall.centerZ - half];
        const b: Pt = Math.abs(wall.angle) < 0.1 ? [wall.centerX + half, wall.centerZ] : [wall.centerX, wall.centerZ + half];
        asObject({ id, kind: "railing", label: `Terrace railing, ${levelName(wall.level)}`, level: wall.level, elevation: null, host: null }, () => {
          railRun(out, a, b, wall.baseY, override(id)?.balcony?.style ?? ext.balcony.style, (override(id)?.balcony?.height ?? ext.balcony.height) * ft, ft);
        });
      } else {
        const f = new Frame(out, wall.centerX, wall.baseY + wall.height / 2, wall.centerZ, -wall.angle);
        asObject({ id, kind: "boundary", label: "Boundary wall", level: 0, elevation: null, host: null }, () => {
          f.box("compound", [0, 0, 0], [wall.length, wall.height, wall.thickness]);
          f.box("trim", [0, wall.height / 2 + 0.04 * ft, 0], [wall.length + 0.06 * ft, 0.08 * ft, wall.thickness + 0.12 * ft]);
        });
      }
      continue;
    }
    const wallId = `wall:${wall.runId}`;
    const elevation = wall.kind === "exterior" ? wallSide() : null;
    const f = new Frame(out, wall.centerX, wall.baseY + wall.height / 2, wall.centerZ, -wall.angle);
    const wallObject = {
      id: wallId, kind: (wall.kind === "exterior" ? "wall" : "interiorWall") as ObjectKind,
      label: `${elevation ? `${ELEVATION_LABEL[elevation]} wall` : "Interior wall"}, ${levelName(wall.level)}`, level: wall.level, elevation, host: null,
    };
    asObject(wallObject, () => f.box(wall.kind === "exterior" ? "walls" : "interiorWall", [0, 0, 0], [wall.length, wall.height, wall.thickness]));

    const line = horizontal ? wall.centerZ : wall.centerX;
    const along = horizontal ? wall.centerX : wall.centerZ;
    const start = along - wall.length / 2, end = along + wall.length / 2;
    for (const side of [-1, 1] as const) {
      const probe = line + side * 0.05 * ft;
      const spans = enclosedAt(wall.level)
        .map((floor) => ({ floor, r: rectOf(floor) }))
        .filter(({ r }) => (horizontal ? probe > r.z0 && probe < r.z1 && r.x1 > start + EPS && r.x0 < end - EPS : probe > r.x0 && probe < r.x1 && r.z1 > start + EPS && r.z0 < end - EPS))
        .map(({ floor, r }) => ({ floor, from: Math.max(start, horizontal ? r.x0 : r.z0), to: Math.min(end, horizontal ? r.x1 : r.z1) }))
        .sort((p, q) => p.from - q.from);
      const plane = line + (side * wall.thickness) / 2;
      for (const span of spans) {
        const mid = (span.from + span.to) / 2, length = span.to - span.from, offset = plane + side * 0.01 * ft;
        out.push({
          kind: "box", part: `roomWall:${span.floor.id}`, object: wallId,
          center: horizontal ? [mid, wall.baseY + wall.height / 2, offset] : [offset, wall.baseY + wall.height / 2, mid],
          size: horizontal ? [length, wall.height, 0.02 * ft] : [0.02 * ft, wall.height, length],
        });
      }
      if (wall.kind !== "exterior") continue;
      for (const [from, to] of subtract(start, end, spans.map((s): Pt => [s.from, s.to]))) {
        const pointAt = (a: number): Pt => (horizontal ? [a, line] : [line, a]);
        const reachFrom = corners.has(cornerKey(wall.level, ...pointAt(from))) ? wall.thickness / 2 : 0;
        const reachTo = corners.has(cornerKey(wall.level, ...pointAt(to))) ? wall.thickness / 2 : 0;
        faces.push({ object: wallId, level: wall.level, horizontal, side, plane, from: from - reachFrom, to: to + reachTo, y0: wall.baseY, y1: wall.baseY + wall.height });
      }
    }
  }

  for (const corner of corners.values()) {
    const elevation = levelFloors(corner.level)[0]?.baseY ?? 0;
    const top = wallTop(corner.level);
    const t = 0.75 * ft;
    out.push({ kind: "box", part: "walls", center: [corner.x, (elevation + top) / 2, corner.z], size: [t, top - elevation, t] });
  }

  // Floors, ceilings: every room reads its finish through its own part.
  for (const floor of geometry.floors) {
    const height = floor.level > 0 ? slab * 8 : slab * 2;
    const y = floor.baseY + (floor.level > 0 && floor.type !== "other" ? slab * 4 : slab);
    asObject({ id: `floor:${floor.id}`, kind: "floor", label: `${floor.name} floor`, level: floor.level, elevation: null, host: null }, () => {
      out.push({ kind: "box", part: `roomFloor:${floor.id}`, center: [floor.centerX, y, floor.centerZ], size: [Math.max(floor.width - 0.04, 0.02), height, Math.max(floor.depth - 0.04, 0.02)] });
    });
    if (isEnclosed(floor.type, floor.name) && floor.type !== "staircase") {
      const style = design.interior.rooms[floor.id]?.ceilingStyle ?? design.interior.ceilingStyle;
      asObject({ id: `ceiling:${floor.id}`, kind: "ceiling", label: `${floor.name} ceiling`, level: floor.level, elevation: null, host: null }, () => buildCeiling(out, floor, wallTop(floor.level), style, ft));
    }
  }

  // Openings.
  for (const pane of geometry.windows) {
    const { normal, outside } = outwardOf(pane.centerX, pane.centerZ, pane.angle, pane.level);
    const id = `window:${pane.id}`;
    const side = outside ? elevationOf(normal) : null;
    asObject({ id, kind: "window", label: `${side ? `${ELEVATION_LABEL[side]} window` : "Interior window"}, ${levelName(pane.level)}`, level: pane.level, elevation: side, host: `wall:${pane.runId}`, modelOnly: pane.id.startsWith("hd-") }, () => {
      buildWindow(out, pane, normal, 0.75 * ft, outside, { ...ext.window, ...override(id)?.window }, ft);
    });
  }
  let entry: Entry | null = null;
  for (const door of geometry.doors) {
    const { normal } = outwardOf(door.centerX, door.centerZ, door.wallAngle, door.level);
    const id = `door:${door.id}`;
    const isExterior = door.hostKind === "exterior";
    const side = isExterior ? elevationOf(normal) : null;
    const look = override(id)?.door?.design ?? (isExterior ? ext.door.design : design.interior.door.design);
    asObject({ id, kind: isExterior ? "door" : "interiorDoor", label: `${side ? `${ELEVATION_LABEL[side]} door` : "Interior door"}, ${levelName(door.level)}`, level: door.level, elevation: side, host: `wall:${door.runId}`, modelOnly: door.id.startsWith("hd-") }, () => {
      buildDoor(out, door, normal, isExterior ? 0.75 * ft : 0.5 * ft, look, Boolean(options.doorsOpen), ft);
    });
    if (door.hostKind === "exterior" && door.level === levels[0]) {
      const street = normal[1] < 0;
      if (!entry || (street && !entry.street) || (street === entry.street && door.centerZ < entry.z)) {
        const reach = (0.75 * ft) / 2;
        entry = { x: door.centerX + normal[0] * reach, z: door.centerZ + normal[1] * reach, normal, width: door.width, height: door.height, street };
      }
    }
  }

  // Street facade: accent cladding, fins and banding sit on the wall faces, so openings stay clear of them.
  const streetFaces = faces.filter((face) => face.horizontal && face.side < 0);
  const fx0 = streetFaces.length ? Math.min(...streetFaces.map((s) => s.from)) : 0;
  const fx1 = streetFaces.length ? Math.max(...streetFaces.map((s) => s.to)) : 0;
  const facadeW = fx1 - fx0;
  const hasUpper = levels.length > 1;
  const upperY = hasUpper ? (levelFloors(levels[1])[0]?.baseY ?? 0) : 0;
  let placement = ext.accentPlacement;
  if ((placement === "upper" || placement === "lower") && !hasUpper) placement = "entry";
  const accentW = facadeW * ext.accentCoverage;
  const accentRange: Pt | null = (() => {
    switch (placement) {
      case "none": return null;
      case "entry": {
        const cx = entry?.street ? entry.x : (fx0 + fx1) / 2;
        return [Math.max(fx0, cx - accentW / 2), Math.min(fx1, cx + accentW / 2)];
      }
      case "left": return [fx1 - accentW, fx1];
      case "right": return [fx0, fx0 + accentW];
      default: return [fx0, fx1];
    }
  })();
  const veneer = (part: string, face: Face, from: number, to: number, y0: number, y1: number, depth: number) => {
    const start = out.length;
    addVeneer(out, part, face, from, to, y0, y1, depth);
    for (let i = start; i < out.length; i++) out[i].object = face.object;
  };
  if (accentRange) {
    for (const face of streetFaces) {
      const from = Math.max(face.from, accentRange[0]), to = Math.min(face.to, accentRange[1]);
      if (to <= from) continue;
      const y0 = placement === "upper" ? Math.max(face.y0, upperY) : face.y0;
      const y1 = placement === "lower" ? Math.min(face.y1, upperY) : face.y1;
      veneer("accent", face, from, to, y0, y1, 0.08 * ft);
      if (ext.details.fins && y1 - y0 > 3 * ft) {
        const spacing = 0.72 * ft;
        const count = Math.floor((to - from) / spacing);
        for (let i = 0; i <= count; i++) {
          const x = from + i * spacing;
          veneer("fins", face, x, x + 0.16 * ft, y0, y1, 0.42 * ft);
        }
      }
    }
  }

  const details = ext.details;
  const pitched = ext.roof.type !== "flat" && ext.roof.type !== "cantilever";
  // A sloped roof drops below the wall top as it passes the wall, so eave details hang under its soffit.
  const eaveDrop = (reach: number) => (pitched ? reach * Math.tan((Math.max(8, ext.roof.pitch) * Math.PI) / 180) + 0.36 * ft : 0);
  for (const face of faces) {
    const elevation = levelFloors(face.level)[0]?.baseY ?? 0;
    const top = wallTop(face.level);
    if (details.plinth && face.level === levels[0]) veneer("base", face, face.from, face.to, Math.max(0, face.y0), Math.min(face.y1, 1.4 * ft), 0.1 * ft);
    if (details.stringCourse && face.level !== levels[0] && face.y0 < elevation + 0.5 * ft) veneer("trim", face, face.from - 0.1 * ft, face.to + 0.1 * ft, elevation - 0.25 * ft, elevation + 0.25 * ft, 0.2 * ft);
    if (details.cornice && Math.abs(face.y1 - top) < EPS) {
      const under = top - eaveDrop(0.34 * ft);
      veneer("trim", face, face.from - 0.25 * ft, face.to + 0.25 * ft, under - 0.5 * ft, under, 0.16 * ft);
      veneer("trim", face, face.from - 0.4 * ft, face.to + 0.4 * ft, under - 0.24 * ft, under, 0.34 * ft);
    }
    if (details.corbels && Math.abs(face.y1 - top) < EPS && face.side < 0 && face.horizontal) {
      const count = Math.floor((face.to - face.from) / (2 * ft));
      const under = top - eaveDrop(0.5 * ft);
      for (let i = 0; i < count; i++) {
        const x = face.from + (i + 0.5) * ((face.to - face.from) / count);
        veneer("corbel", face, x - 0.14 * ft, x + 0.14 * ft, under - 0.3 * ft, under, 0.5 * ft);
      }
    }
  }
  for (const corner of corners.values()) {
    const elevation = levelFloors(corner.level)[0]?.baseY ?? 0;
    const top = wallTop(corner.level);
    const t = 0.75 * ft;
    const ox = corner.x + (corner.qx * t) / 2, oz = corner.z + (corner.qz * t) / 2;
    if (details.pilasters) {
      out.push({ kind: "box", part: "column", center: [ox, (elevation + top) / 2, oz], size: [1.1 * ft, top - elevation, 1.1 * ft] });
    }
    if (details.quoins) {
      const course = 0.9 * ft;
      const rows = Math.floor((top - elevation) / course);
      for (let i = 0; i < rows; i += 2) {
        const y = elevation + i * course + course / 2;
        const long = i % 4 === 0 ? 1.7 * ft : 1.1 * ft;
        out.push({ kind: "box", part: "trim", center: [ox - (corner.qx * long) / 2 + corner.qx * 0.06 * ft, y, oz], size: [long, course * 0.86, 0.14 * ft] });
        out.push({ kind: "box", part: "trim", center: [ox, y, oz - (corner.qz * long) / 2 + corner.qz * 0.06 * ft], size: [0.14 * ft, course * 0.86, long] });
      }
    }
  }

  // Projected balconies on upper windows of the chosen sides. They hang off the wall; no room changes size.
  if (ext.balcony.projected) {
    for (const pane of geometry.windows) {
      if (pane.level === levels[0]) continue;
      const { normal, outside } = outwardOf(pane.centerX, pane.centerZ, pane.angle, pane.level);
      const side = elevationOf(normal);
      const id = `balcony:${pane.id}`;
      const own = override(id);
      if (!outside || !ext.balcony.elevations.includes(side) || pane.width < 2.8 * ft || own?.hidden) continue;
      const y = levelFloors(pane.level)[0]?.baseY ?? pane.baseY;
      const depth = (own?.balcony?.depth ?? ext.balcony.depth) * ft;
      const width = pane.width + 1.6 * ft;
      const wallFace = 0.375 * ft;
      const f = new Frame(out, pane.centerX, 0, pane.centerZ, Math.atan2(normal[0], normal[1]));
      const at = (lx: number, lz: number): Pt => {
        const p = f.point(lx, 0, lz);
        return [p[0], p[2]];
      };
      asObject({ id, kind: "balcony", label: `${ELEVATION_LABEL[side]} balcony, ${levelName(pane.level)}`, level: pane.level, elevation: side, host: `window:${pane.id}` }, () => {
        f.box("balconySlab", [0, y - 0.1 * ft, wallFace + depth / 2], [width, 0.42 * ft, depth]);
        const style = own?.balcony?.style ?? ext.balcony.style, h = (own?.balcony?.height ?? ext.balcony.height) * ft;
        const a = at(-width / 2, wallFace + depth), b = at(width / 2, wallFace + depth);
        railRun(out, a, b, y + 0.1 * ft, style, h, ft);
        railRun(out, a, at(-width / 2, wallFace), y + 0.1 * ft, style, h, ft);
        railRun(out, b, at(width / 2, wallFace), y + 0.1 * ft, style, h, ft);
      });
    }
  }

  // Roofs: over the top floor and over any lower rooms left uncovered by the floor above.
  const ctx: RoofContext = { out, design, ft };
  let roofTop = 0;
  levels.forEach((level, index) => {
    const above = levels[index + 1];
    const covered = above === undefined ? [] : levelFloors(above).map(rectOf);
    const parts = mergeRects(enclosedAt(level).map(rectOf), covered);
    const y0 = wallTop(level);
    parts.forEach((rect, section) => {
      const id = `roof:L${level}-${section}`;
      const own = override(id)?.roof;
      const sectionDesign: HouseDesign = own ? { ...design, exterior: { ...ext, roof: { ...ext.roof, ...own } } } : design;
      asObject({ id, kind: "roof", label: parts.length > 1 ? `Roof section ${section + 1}, ${levelName(level)}` : `Roof, ${levelName(level)}`, level, elevation: null, host: null }, () => {
        roofTop = Math.max(roofTop, buildRoof({ ...ctx, design: sectionDesign }, rect, y0));
      });
    });
    if (above === undefined && (ext.roof.type === "flat" || ext.roof.type === "cantilever") && ext.roof.type !== "cantilever" && !ext.roof.parapet) {
      const hasStair = levelFloors(level).some((f) => f.type === "staircase");
      if (hasStair) {
        parts.forEach((r, section) => {
          const id = `railing:roof-L${level}-${section}`;
          const own = override(id)?.balcony;
          const y = y0 + 0.6 * ft;
          const h = (own?.height ?? ext.balcony.height) * ft, style = own?.style ?? ext.balcony.style;
          asObject({ id, kind: "railing", label: "Roof terrace railing", level, elevation: null, host: null }, () => {
            railRun(out, [r.x0, r.z0], [r.x1, r.z0], y, style, h, ft);
            railRun(out, [r.x0, r.z1], [r.x1, r.z1], y, style, h, ft);
            railRun(out, [r.x0, r.z0], [r.x0, r.z1], y, style, h, ft);
            railRun(out, [r.x1, r.z0], [r.x1, r.z1], y, style, h, ft);
          });
        });
      }
    }
  });

  const groundLevel = levels[0] ?? 0;
  if (entry) {
    const y = levelFloors(groundLevel)[0]?.baseY ?? 0;
    const entryWallTop = wallTop(groundLevel) - y;
    const porch = entry;
    if (ext.details.portico !== "none") {
      asObject({ id: "portico:entry", kind: "portico", label: "Entrance portico", level: groundLevel, elevation: elevationOf(porch.normal), host: null }, () => buildPortico(out, porch, y, entryWallTop, design, ft));
    }
  }

  const walkableRoof = (ext.roof.type === "flat" && !ext.roof.parapet) && geometry.floors.some((f) => f.level === levels[levels.length - 1] && f.type === "staircase");
  buildSite(out, lights, geometry, plan, design, entry, streetFaces, ft, asObject);
  return { prims: out, lights, entry, roofTop, walkableRoof, objects: finishObjects(registry, out) };
}

/** Fills in each object's parts and bounds once the whole model exists. */
function finishObjects(registry: Map<string, SceneObject>, prims: Prim[]): SceneObject[] {
  const grow = (object: SceneObject, x: number, y: number, z: number, r = 0) => {
    const b = (object.bounds ??= { min: [x - r, y - r, z - r], max: [x + r, y + r, z + r] });
    b.min = [Math.min(b.min[0], x - r), Math.min(b.min[1], y - r), Math.min(b.min[2], z - r)];
    b.max = [Math.max(b.max[0], x + r), Math.max(b.max[1], y + r), Math.max(b.max[2], z + r)];
  };
  for (const prim of prims) {
    const object = prim.object ? registry.get(prim.object) : undefined;
    if (!object) continue;
    if (!object.parts.includes(prim.part)) object.parts.push(prim.part);
    if (prim.kind === "polygon") prim.points.forEach((p) => grow(object, p[0], p[1], p[2]));
    else if (prim.kind === "box") grow(object, prim.center[0], prim.center[1], prim.center[2], Math.max(...prim.size) / 2);
    else if (prim.kind === "blob") grow(object, prim.center[0], prim.center[1], prim.center[2], prim.radius);
    else grow(object, prim.center[0], prim.center[1], prim.center[2], prim.kind === "cylinder" ? prim.height / 2 : prim.depth);
  }
  return [...registry.values()].filter((o) => o.parts.length > 0);
}

type AsObject = (object: Omit<SceneObject, "parts" | "bounds">, build: () => void) => void;

function buildSite(out: Prim[], lights: ModelLight[], geometry: SceneGeometry, plan: FloorPlan, design: HouseDesign, entry: Entry | null, streetFaces: Face[], ft: number, asObject: AsObject) {
  const env = design.environment;
  const W = geometry.plotWidth, L = geometry.plotDepth;
  const span = Math.max(W, L);
  const random = mulberry(Math.round(W * 31 + L * 17));
  const groundFloors = geometry.floors.filter((f) => f.level === 0);
  const built = groundFloors.filter((f) => isEnclosed(f.type, f.name)).map(rectOf);

  const reach = span * 9;
  out.push({ kind: "box", part: "surroundings", center: [0, -0.32 * ft, 0], size: [reach * 2 + W, 0.5 * ft, reach * 2 + L] });
  out.push({ kind: "box", part: "plot", center: [0, -0.06 * ft, 0], size: [W + 0.4 * ft, 0.1 * ft, L + 0.4 * ft] });

  const frontZ = -L / 2;
  const sidewalkW = 5 * ft, verge = 2 * ft, roadW = 24 * ft;
  const hasStreet = env.surroundings === "suburban" || env.surroundings === "urban";
  if (hasStreet) {
    const sidewalkZ = frontZ - verge - sidewalkW / 2;
    const roadZ = sidewalkZ - sidewalkW / 2 - roadW / 2;
    out.push({ kind: "box", part: "sidewalk", center: [0, -0.04 * ft, sidewalkZ], size: [reach * 2 + W, 0.12 * ft, sidewalkW] });
    out.push({ kind: "box", part: "road", center: [0, -0.07 * ft, roadZ], size: [reach * 2 + W, 0.06 * ft, roadW] });
    for (let i = -8; i <= 8; i++) out.push({ kind: "box", part: "roadMark", center: [i * 12 * ft, -0.035 * ft, roadZ], size: [6 * ft, 0.01 * ft, 0.3 * ft] });
  }
  if (env.surroundings === "urban") {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const w = 24 * ft + random() * 6 * ft, h = 20 * ft + random() * 14 * ft, d = 30 * ft;
        out.push({ kind: "box", part: "neighbour", center: [side * (W / 2 + 6 * ft + w / 2), h / 2, -L / 4 + i * (d + 8 * ft)], size: [w, h, d] });
      }
    }
    out.push({ kind: "box", part: "neighbour", center: [0, 12 * ft, L / 2 + 24 * ft], size: [W * 1.4, 24 * ft, 30 * ft] });
  }
  if (env.surroundings === "waterfront") {
    out.push({ kind: "box", part: "water", center: [0, -0.1 * ft, L / 2 + reach / 2 + 8 * ft], size: [reach * 2 + W, 0.08 * ft, reach] });
  }

  // Driveway from each parking bay to the road.
  const parking = groundFloors.filter((f) => f.type === "parking").map(rectOf);
  const drives: Rect[] = [];
  parking.forEach((bay, index) => {
    const z0 = hasStreet ? frontZ - verge : frontZ;
    drives.push({ x0: bay.x0, x1: bay.x1, z0, z1: bay.z1 });
    asObject({ id: `drive:${index}`, kind: "driveway", label: "Driveway", level: 0, elevation: null, host: null }, () => {
      out.push({ kind: "box", part: "drive", center: [(bay.x0 + bay.x1) / 2, 0.02 * ft, (z0 + bay.z1) / 2], size: [bay.x1 - bay.x0, 0.08 * ft, bay.z1 - z0] });
    });
  });

  // Path from the front door out to the street.
  const paths: Rect[] = [];
  const pathW = env.path.width * ft;
  const walkTo = hasStreet ? frontZ - verge : frontZ - 2 * ft;
  const addPath = (x0: number, z0: number, x1: number, z1: number) => {
    const r: Rect = { x0: Math.min(x0, x1) - (x0 === x1 ? pathW / 2 : 0), x1: Math.max(x0, x1) + (x0 === x1 ? pathW / 2 : 0), z0: Math.min(z0, z1) - (z0 === z1 ? pathW / 2 : 0), z1: Math.max(z0, z1) + (z0 === z1 ? pathW / 2 : 0) };
    paths.push(r);
    if (env.path.style === "straight") {
      out.push({ kind: "box", part: "path", center: [(r.x0 + r.x1) / 2, 0.03 * ft, (r.z0 + r.z1) / 2], size: [r.x1 - r.x0, 0.1 * ft, r.z1 - r.z0] });
    } else if (env.path.style === "stepping") {
      const along = r.x1 - r.x0 > r.z1 - r.z0;
      const length = along ? r.x1 - r.x0 : r.z1 - r.z0;
      const count = Math.max(1, Math.floor(length / (2.6 * ft)));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const cx = along ? r.x0 + t * length : (r.x0 + r.x1) / 2;
        const cz = along ? (r.z0 + r.z1) / 2 : r.z0 + t * length;
        out.push({ kind: "box", part: "path", center: [cx, 0.04 * ft, cz], size: [along ? 1.9 * ft : pathW * 0.72, 0.12 * ft, along ? pathW * 0.72 : 1.9 * ft] });
      }
    }
  };
  if (entry && env.path.style !== "none") {
    if (entry.street) addPath(entry.x, entry.z, entry.x, walkTo);
    else {
      const sideX = entry.x + entry.normal[0] * 3 * ft;
      addPath(entry.x, entry.z, sideX, entry.z);
      addPath(sideX, entry.z, sideX, walkTo);
    }
  }

  const clearOf = (x: number, z: number, margin: number) =>
    ![...built, ...drives, ...paths].some((r) => x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin);

  // Planting along the street face.
  const light = env.lighting;
  if (env.shrubs > 0) {
    for (const face of streetFaces) {
      if (face.level !== 0) continue;
      const step = (5.4 - 3.4 * env.shrubs) * ft;
      for (let x = face.from + step / 2; x < face.to; x += step) {
        const z = face.plane - 1.4 * ft - random() * 0.6 * ft;
        if (!clearOf(x, z, 0.4 * ft) || z < frontZ + 0.5 * ft) continue;
        const radius = (0.9 + random() * 0.8) * ft;
        out.push({ kind: "blob", part: "shrub", center: [x, radius * 0.7, z], radius, squash: 0.8 });
        if (env.flowers) {
          for (let i = 0; i < 4; i++) {
            out.push({ kind: "blob", part: "flower", center: [x + (random() - 0.5) * 1.6 * ft, radius * 1.2 + random() * 0.4 * ft, z + (random() - 0.5) * 1.2 * ft], radius: 0.17 * ft });
          }
        }
      }
    }
  }
  if (env.hedges) {
    const h = 3 * ft, t = 1.5 * ft;
    const sides: Rect[] = [
      { x0: -W / 2 + t / 2, x1: -W / 2 + t / 2, z0: frontZ, z1: L / 2 },
      { x0: W / 2 - t / 2, x1: W / 2 - t / 2, z0: frontZ, z1: L / 2 },
      { x0: -W / 2, x1: W / 2, z0: L / 2 - t / 2, z1: L / 2 - t / 2 },
    ];
    for (const s of sides) {
      const long = s.x1 - s.x0 > s.z1 - s.z0;
      const len = long ? s.x1 - s.x0 : s.z1 - s.z0;
      const free = subtract(0, len, built.flatMap((r): Pt[] => {
        const inLine = long ? s.z0 > r.z0 - t && s.z0 < r.z1 + t : s.x0 > r.x0 - t && s.x0 < r.x1 + t;
        if (!inLine) return [];
        return long ? [[r.x0 - s.x0, r.x1 - s.x0]] : [[r.z0 - s.z0, r.z1 - s.z0]];
      }));
      for (const [a, b] of free) {
        const mid = (a + b) / 2;
        const center: Vec3 = long ? [s.x0 + mid, h / 2, s.z0] : [s.x0, h / 2, s.z0 + mid];
        out.push({ kind: "box", part: "hedge", center, size: long ? [b - a, h, t] : [t, h, b - a] });
      }
    }
  }

  // Trees: seeded so the same inputs always give the same garden.
  const candidates: Pt[] = [];
  const margin = span * 0.55;
  for (let tries = 0; tries < 400 && candidates.length < env.trees + (env.surroundings === "woodland" ? 26 : 0); tries++) {
    const x = (random() - 0.5) * (W + margin * 2);
    const z = frontZ + 1 * ft + random() * (L + margin);
    const inside = Math.abs(x) < W / 2 && z < L / 2;
    if (!clearOf(x, z, 4 * ft) || (!inside && z < frontZ + 2 * ft)) continue;
    // Keep the view of the facade clear: nothing tall directly in front of the house.
    if (built.length && z < Math.min(...built.map((r) => r.z0)) && x > Math.min(...built.map((r) => r.x0)) && x < Math.max(...built.map((r) => r.x1))) continue;
    if (candidates.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 9 * ft)) continue;
    candidates.push([x, z]);
  }
  candidates.forEach(([x, z], index) => {
    const height = (6 + random() * 3) * ft, crown = (3.4 + random() * 2.4) * ft;
    const clumps = Array.from({ length: 6 }, (_, i): Prim => {
      const angle = (i / 6) * Math.PI * 2 + random() * 0.6;
      const reachOut = crown * (0.48 + random() * 0.22);
      const clump = crown * (0.42 + random() * 0.14);
      return { kind: "blob", part: "foliage", center: [x + Math.cos(angle) * reachOut, height + crown * (0.12 + random() * 0.5), z + Math.sin(angle) * reachOut], radius: clump, squash: 0.86 };
    });
    const id = `tree:${index}`;
    // Only the garden's own trees can be edited; the woods behind them are scenery.
    if (index < env.trees && design.overrides[id]?.hidden) return;
    const plant = () => {
      out.push({ kind: "cylinder", part: "trunk", center: [x, height / 2, z], radiusTop: 0.28 * ft, radiusBottom: 0.42 * ft, height, segments: 8 });
      // A crown of overlapping clumps; the seeded offsets keep every tree different but repeatable.
      out.push({ kind: "blob", part: "foliage", center: [x, height + crown * 0.55, z], radius: crown * 0.72, squash: 0.9 }, ...clumps);
    };
    if (index < env.trees) asObject({ id, kind: "tree", label: `Tree ${index + 1}`, level: 0, elevation: null, host: null }, plant);
    else plant();
  });

  // Outdoor lighting. Every fitting is real geometry; only the first few also cast light, which keeps it fast.
  const wants = (style: string) => light.style === "all" || light.style === style;
  const addLight = (position: Vec3, intensity: number, distance: number) => {
    if (lights.length < 8) lights.push({ position, intensity: intensity * light.intensity, distance });
  };
  if (entry && wants("sconces")) {
    const rotY = Math.atan2(entry.normal[0], entry.normal[1]);
    const f = new Frame(out, entry.x, 0, entry.z, rotY);
    for (const side of [-1, 1]) {
      const lx = side * (entry.width / 2 + 0.9 * ft);
      f.box("lampBody", [lx, 6.6 * ft, 0.1 * ft], [0.26 * ft, 0.7 * ft, 0.2 * ft]);
      f.box("lampHead", [lx, 6.6 * ft, 0.22 * ft], [0.14 * ft, 0.46 * ft, 0.04 * ft]);
      addLight(f.point(lx, 6.4 * ft, 1 * ft), 6, 16 * ft);
    }
  }
  if (wants("bollards")) {
    paths.forEach((r) => {
      const along = r.x1 - r.x0 > r.z1 - r.z0;
      const length = along ? r.x1 - r.x0 : r.z1 - r.z0;
      const count = Math.max(1, Math.floor(length / (7 * ft)));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, side = i % 2 ? 1 : -1;
        const x = along ? r.x0 + t * length : (side > 0 ? r.x1 : r.x0) + side * 0.5 * ft;
        const z = along ? (side > 0 ? r.z1 : r.z0) + side * 0.5 * ft : r.z0 + t * length;
        out.push({ kind: "cylinder", part: "lampBody", center: [x, 1 * ft, z], radiusTop: 0.13 * ft, radiusBottom: 0.15 * ft, height: 2 * ft, segments: 10 });
        out.push({ kind: "cylinder", part: "lampHead", center: [x, 2.05 * ft, z], radiusTop: 0.14 * ft, radiusBottom: 0.14 * ft, height: 0.12 * ft, segments: 10 });
        addLight([x, 2.6 * ft, z], 4, 13 * ft);
      }
    });
  }
  if (wants("uplights")) {
    for (const face of streetFaces) {
      if (face.level !== 0 || face.to - face.from < 3 * ft) continue;
      const x = (face.from + face.to) / 2, z = face.plane - 0.9 * ft;
      if (!clearOf(x, z, 0)) continue;
      out.push({ kind: "cylinder", part: "lampHead", center: [x, 0.1 * ft, z], radiusTop: 0.2 * ft, radiusBottom: 0.24 * ft, height: 0.2 * ft, segments: 10 });
      addLight([x, 1.4 * ft, z - 0.6 * ft], 5, 13 * ft);
    }
  }
}
