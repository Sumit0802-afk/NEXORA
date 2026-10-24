import type { FloorPlan, RoomType, Wall } from "@houseplan/design-schema";

/** A box-shaped wall piece. Walls are split around doors/windows into solid pieces, lintels and sills. */
export type WallSegment = {
  id: string;
  centerX: number;
  centerZ: number;
  baseY: number;
  length: number;
  angle: number;
  thickness: number;
  height: number;
  kind: "exterior" | "interior" | "boundary";
};

export type RoomFloor = {
  id: string;
  name: string;
  type: RoomType;
  /** Floor index (0 = ground) and the height its slab sits at. */
  level: number;
  baseY: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
};

export type OpeningMarker = {
  id: string;
  kind: "door" | "window";
  centerX: number;
  centerZ: number;
  angle: number;
  width: number;
};

/** A door leaf, hinged at (hingeX, hingeZ) and drawn swung open into the plot. */
export type DoorLeaf = {
  id: string;
  baseY: number;
  hingeX: number;
  hingeZ: number;
  angle: number;
  width: number;
  height: number;
  thickness: number;
};

export type WindowPane = {
  id: string;
  centerX: number;
  centerZ: number;
  baseY: number;
  angle: number;
  width: number;
  height: number;
};

export type SceneGeometry = {
  walls: WallSegment[];
  floors: RoomFloor[];
  openings: OpeningMarker[];
  doors: DoorLeaf[];
  windows: WindowPane[];
  plotWidth: number;
  plotDepth: number;
  wallHeight: number;
  /** Number of floors included (levels 0..levelCount-1). */
  levelCount: number;
};

const EPS = 0.01;
/** Rooms open to the sky or street: no full-height walls between them, only a low boundary wall at the plot edge. */
const OPEN_TYPES: ReadonlySet<RoomType> = new Set<RoomType>(["other", "parking", "balcony"]);
const DOOR_SWING = (65 * Math.PI) / 180;

type Rect = { id: string; type: RoomType; x0: number; y0: number; x1: number; y1: number };
type Line = { axis: "h" | "v"; at: number };
type Piece = { from: number; to: number; kind: WallSegment["kind"]; thickness: number; height: number };

const round = (n: number) => Math.round(n * 1000) / 1000;
const lineKey = (l: Line) => `${l.axis}@${round(l.at)}`;

function boundsOf(polygon: [number, number][]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Room on the low (-) or high (+) side of a line over the interval [a, b], if any. */
function roomOn(rects: Rect[], line: Line, a: number, b: number, side: "low" | "high"): Rect | undefined {
  const mid = (a + b) / 2;
  return rects.find((r) => {
    if (line.axis === "h") {
      const edge = side === "low" ? r.y1 : r.y0;
      return Math.abs(edge - line.at) < EPS && r.x0 - EPS <= mid && mid <= r.x1 + EPS;
    }
    const edge = side === "low" ? r.x1 : r.x0;
    return Math.abs(edge - line.at) < EPS && r.y0 - EPS <= mid && mid <= r.y1 + EPS;
  });
}

function explicitWallFor(walls: Wall[], line: Line, a: number, b: number): Wall | undefined {
  const mid = (a + b) / 2;
  return walls.find((w) => {
    const horizontal = Math.abs(w.start[1] - w.end[1]) < EPS;
    const vertical = Math.abs(w.start[0] - w.end[0]) < EPS;
    if (line.axis === "h" && horizontal && Math.abs(w.start[1] - line.at) < EPS) {
      return Math.min(w.start[0], w.end[0]) - EPS <= mid && mid <= Math.max(w.start[0], w.end[0]) + EPS;
    }
    if (line.axis === "v" && vertical && Math.abs(w.start[0] - line.at) < EPS) {
      return Math.min(w.start[1], w.end[1]) - EPS <= mid && mid <= Math.max(w.start[1], w.end[1]) + EPS;
    }
    return false;
  });
}

/**
 * Builds Three.js-ready geometry (centered at the plot's center, plan Y -> world Z) from a canonical
 * floor plan. Room edges on the same line are merged into one wall network (no duplicate walls at
 * T-junctions), and doors/windows are cut out of the walls they sit on. Floors stack at their
 * elevation; `topLevel` hides everything above that floor (default: show every floor).
 *
 * `hiddenLevels` — a Set of level indices to skip from rendering. The floors still exist in the
 * plan data; they are simply excluded from the output geometry so they can be restored later.
 */
export function buildSceneGeometry(plan: FloorPlan, topLevel?: number, hiddenLevels?: ReadonlySet<number>): SceneGeometry {
  const last = Math.min(topLevel ?? plan.levels.length - 1, plan.levels.length - 1);
  const ft = plan.units === "m" ? 0.3048 : 1;
  const out: SceneGeometry = {
    walls: [], floors: [], openings: [], doors: [], windows: [],
    plotWidth: plan.plot.width, plotDepth: plan.plot.length,
    wallHeight: plan.levels[0]?.wallHeight || 10 * ft, levelCount: Math.max(last + 1, 1),
  };
  for (let i = 0; i <= last; i++) {
    if (hiddenLevels?.has(i)) continue; // skip hidden floors — data is preserved in the plan
    const part = buildLevel(plan, i);
    out.walls.push(...part.walls);
    out.floors.push(...part.floors);
    out.openings.push(...part.openings);
    out.doors.push(...part.doors);
    out.windows.push(...part.windows);
  }
  return out;
}

function buildLevel(plan: FloorPlan, levelIndex: number) {
  const level = plan.levels[levelIndex];
  const rooms = level?.rooms ?? [];
  const explicitWalls = level?.walls ?? [];
  const ft = plan.units === "m" ? 0.3048 : 1;
  const wallHeight = level?.wallHeight || 10 * ft;
  const elevation = levelIndex === 0 ? 0 : level?.elevation ?? levelIndex * wallHeight;
  const tagPrefix = levelIndex === 0 ? "" : `${level?.id ?? levelIndex}-`;
  const W = plan.plot.width;
  const L = plan.plot.length;
  const cx = W / 2;
  const cz = L / 2;
  const toWorld = (x: number, y: number): [number, number] => [x - cx, y - cz];

  const rects: Rect[] = rooms.map((room) => ({ id: room.id, type: room.type, ...boundsOf(room.polygon as [number, number][]) }));

  const floors: RoomFloor[] = rects.map((r) => {
    const room = rooms.find((x) => x.id === r.id)!;
    const [fx, fz] = toWorld((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    return { id: r.id, name: room.name, type: r.type, level: levelIndex, baseY: elevation, centerX: fx, centerZ: fz, width: r.x1 - r.x0, depth: r.y1 - r.y0 };
  });

  // 1. Collect every room edge per line, then split each line at all edge endpoints.
  const lines = new Map<string, { line: Line; cuts: Set<number> }>();
  const addEdge = (line: Line, a: number, b: number) => {
    const key = lineKey(line);
    const entry = lines.get(key) ?? { line, cuts: new Set<number>() };
    entry.cuts.add(round(a));
    entry.cuts.add(round(b));
    lines.set(key, entry);
  };
  for (const r of rects) {
    addEdge({ axis: "h", at: r.y0 }, r.x0, r.x1);
    addEdge({ axis: "h", at: r.y1 }, r.x0, r.x1);
    addEdge({ axis: "v", at: r.x0 }, r.y0, r.y1);
    addEdge({ axis: "v", at: r.x1 }, r.y0, r.y1);
  }
  for (const w of explicitWalls) {
    const horizontal = Math.abs(w.start[1] - w.end[1]) < EPS;
    const vertical = Math.abs(w.start[0] - w.end[0]) < EPS;
    if (horizontal) {
      addEdge({ axis: "h", at: w.start[1] }, Math.min(w.start[0], w.end[0]), Math.max(w.start[0], w.end[0]));
    } else if (vertical) {
      addEdge({ axis: "v", at: w.start[0] }, Math.min(w.start[1], w.end[1]), Math.max(w.start[1], w.end[1]));
    }
  }

  // 2. Classify each elementary interval by what lies on either side, and merge equal neighbours.
  const pieces = new Map<string, Piece[]>();
  const boundaryHeight = Math.min(3.5 * ft, wallHeight);
  for (const [key, { line, cuts }] of lines) {
    const sorted = [...cuts].sort((p, q) => p - q);
    const run: Piece[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (b - a < EPS) continue;
      const low = roomOn(rects, line, a, b, "low");
      const high = roomOn(rects, line, a, b, "high");
      const explicit = explicitWallFor(explicitWalls, line, a, b);
      if (!low && !high && !explicit) continue;
      const enclosedLow = !!low && !OPEN_TYPES.has(low.type);
      const enclosedHigh = !!high && !OPEN_TYPES.has(high.type);
      const onBoundary = line.axis === "h" ? line.at < EPS || line.at > L - EPS : line.at < EPS || line.at > W - EPS;
      // Upstairs, an open terrace edge with nothing beside it is a drop: give it a parapet.
      const openEdge = levelIndex > 0 && (!low || !high);
      let piece: Omit<Piece, "from" | "to"> | null = null;
      if (enclosedLow || enclosedHigh) {
        const kind = enclosedLow && enclosedHigh ? "interior" : "exterior";
        piece = { kind, thickness: (kind === "interior" ? 0.5 : 0.75) * ft, height: wallHeight };
      } else if (explicit) {
        piece = { kind: explicit.kind || "interior", thickness: (explicit.thickness || 0.5) * ft, height: explicit.height || wallHeight };
      } else if (onBoundary || openEdge) {
        const streetGate = line.axis === "h" && line.at < EPS && (low?.type === "parking" || high?.type === "parking");
        if (!streetGate) piece = { kind: "boundary", thickness: 0.5 * ft, height: boundaryHeight };
      }
      if (!piece) continue;
      if (explicit) piece = { ...piece, thickness: explicit.thickness, height: explicit.height };
      const prev = run[run.length - 1];
      if (prev && Math.abs(prev.to - a) < EPS && prev.kind === piece.kind && prev.thickness === piece.thickness && prev.height === piece.height) {
        prev.to = b;
      } else {
        run.push({ from: a, to: b, ...piece });
      }
    }
    if (run.length) pieces.set(key, run);
  }

  // 3. Place openings on their lines and cut the wall pieces around them.
  type Cut = { id: string; kind: "door" | "window"; from: number; to: number; bottom: number; top: number; sign: number };
  const cutsByLine = new Map<string, Cut[]>();
  const openings: OpeningMarker[] = [];
  const doors: DoorLeaf[] = [];
  const windows: WindowPane[] = [];
  for (const opening of level?.openings ?? []) {
    const host = explicitWalls.find((w) => w.id === opening.wallId);
    if (!host) continue;
    const dx = host.end[0] - host.start[0];
    const dy = host.end[1] - host.start[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = host.start[0] + ux * opening.offset;
    const py = host.start[1] + uy * opening.offset;
    const [wx, wz] = toWorld(px, py);
    openings.push({ id: opening.id, kind: opening.kind, centerX: wx, centerZ: wz, angle: Math.atan2(uy, ux), width: opening.width });

    const horizontal = Math.abs(dy) < EPS;
    const vertical = Math.abs(dx) < EPS;
    if (!horizontal && !vertical) continue; // diagonal walls keep the marker only
    const line: Line = horizontal ? { axis: "h", at: py } : { axis: "v", at: px };
    const along = horizontal ? px : py;
    const half = opening.width / 2;
    const isDoor = opening.kind === "door";
    const bottom = isDoor ? 0 : opening.sillHeight ?? 3 * ft;
    const top = Math.min(isDoor ? opening.height ?? 7 * ft : bottom + (opening.height ?? 4 * ft), wallHeight - 0.25 * ft);
    // Swing/face toward the plot's interior, matching the 2D plan.
    const toCenter = horizontal ? cz - py : cx - px;
    const sign = toCenter >= 0 ? 1 : -1;
    const list = cutsByLine.get(lineKey(line)) ?? [];
    list.push({ id: opening.id, kind: opening.kind, from: along - half, to: along + half, bottom, top, sign });
    cutsByLine.set(lineKey(line), list);
  }

  const walls: WallSegment[] = [];
  const pushBox = (line: Line, from: number, to: number, baseY: number, height: number, thickness: number, kind: WallSegment["kind"], id: string) => {
    if (to - from < EPS || height < EPS) return;
    const mid = (from + to) / 2;
    const [x, z] = line.axis === "h" ? toWorld(mid, line.at) : toWorld(line.at, mid);
    walls.push({ id: tagPrefix + id, centerX: x, centerZ: z, baseY: elevation + baseY, length: to - from, angle: line.axis === "h" ? 0 : Math.PI / 2, thickness, height, kind });
  };

  for (const [key, run] of pieces) {
    const line = lines.get(key)!.line;
    const cuts = (cutsByLine.get(key) ?? []).sort((p, q) => p.from - q.from);
    run.forEach((piece, pi) => {
      let cursor = piece.from;
      const inPiece = cuts.filter((c) => c.to > piece.from + EPS && c.from < piece.to - EPS);
      inPiece.forEach((c, ci) => {
        const from = Math.max(c.from, piece.from);
        const to = Math.min(c.to, piece.to);
        const tag = `${key}-${pi}-${ci}`;
        pushBox(line, cursor, from, 0, piece.height, piece.thickness, piece.kind, `wall-${tag}`);
        if (c.bottom > EPS) pushBox(line, from, to, 0, Math.min(c.bottom, piece.height), piece.thickness, piece.kind, `sill-${tag}`);
        if (c.top < piece.height) pushBox(line, from, to, c.top, piece.height - c.top, piece.thickness, piece.kind, `lintel-${tag}`);
        cursor = Math.max(cursor, to);
      });
      pushBox(line, cursor, piece.to, 0, piece.height, piece.thickness, piece.kind, `wall-${key}-${pi}-end`);
    });

    for (const c of cuts) {
      const hosted = run.some((p) => c.to > p.from + EPS && c.from < p.to - EPS);
      if (!hosted) continue;
      const width = c.to - c.from;
      if (c.kind === "door") {
        const [hx, hz] = line.axis === "h" ? toWorld(c.from, line.at) : toWorld(line.at, c.from);
        const base = line.axis === "h" ? 0 : Math.PI / 2;
        // Rotate from the wall direction toward the interior side by the swing angle.
        const swing = line.axis === "h" ? c.sign * DOOR_SWING : -c.sign * DOOR_SWING;
        doors.push({ id: c.id, baseY: elevation, hingeX: hx, hingeZ: hz, angle: base + swing, width, height: c.top, thickness: 0.15 * ft });
      } else {
        const mid = (c.from + c.to) / 2;
        const [x, z] = line.axis === "h" ? toWorld(mid, line.at) : toWorld(line.at, mid);
        windows.push({ id: c.id, centerX: x, centerZ: z, baseY: elevation + c.bottom, angle: line.axis === "h" ? 0 : Math.PI / 2, width, height: c.top - c.bottom });
      }
    }
  }

  return { walls, floors, openings, doors, windows };
}

export type CameraView = "perspective" | "isometric" | "top" | "front" | "side";

export type CameraFraming = {
  distance: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  near: number;
  far: number;
  positions: Record<CameraView, [number, number, number]>;
};

/**
 * Frames a camera so the building is centered, properly scaled, and fills
 * the view comfortably without clipping.
 */
export function computeCameraFraming(geometry: SceneGeometry, fovDeg = 45, margin = 0.68): CameraFraming {
  let minX = -geometry.plotWidth / 2;
  let maxX = geometry.plotWidth / 2;
  let minZ = -geometry.plotDepth / 2;
  let maxZ = geometry.plotDepth / 2;
  let minY = 0;
  let maxY = geometry.wallHeight;

  if (geometry.floors.length > 0) {
    minX = Math.min(...geometry.floors.map((f) => f.centerX - f.width / 2));
    maxX = Math.max(...geometry.floors.map((f) => f.centerX + f.width / 2));
    minZ = Math.min(...geometry.floors.map((f) => f.centerZ - f.depth / 2));
    maxZ = Math.max(...geometry.floors.map((f) => f.centerZ + f.depth / 2));
    minY = Math.min(...geometry.floors.map((f) => f.baseY));
    const wallMax = geometry.walls.length > 0 ? Math.max(...geometry.walls.map((w) => w.baseY + w.height)) : geometry.wallHeight;
    const floorMax = Math.max(...geometry.floors.map((f) => f.baseY + geometry.wallHeight));
    maxY = Math.max(wallMax, floorMax);
  }

  const targetX = (minX + maxX) / 2;
  const targetZ = (minZ + maxZ) / 2;
  const targetY = (minY + maxY) * 0.42;

  const bWidth = Math.max(maxX - minX, geometry.plotWidth * 0.6);
  const bDepth = Math.max(maxZ - minZ, geometry.plotDepth * 0.6);
  const bHeight = Math.max(maxY - minY, geometry.wallHeight);

  const horizontalExtent = Math.hypot(bWidth, bDepth);
  const verticalExtent = Math.max(horizontalExtent, bHeight * 2);
  const fovRad = (fovDeg * Math.PI) / 180;
  const distance = Math.max(14, ((verticalExtent / 2) / Math.tan(fovRad / 2)) * margin);

  return {
    distance,
    targetX,
    targetY,
    targetZ,
    near: Math.max(0.05, distance * 0.01),
    far: distance * 12,
    positions: {
      perspective: [targetX + distance * 0.58, targetY + distance * 0.46, targetZ + distance * 0.58],
      isometric: [targetX + distance * 0.66, targetY + distance * 0.56, targetZ + distance * 0.66],
      top: [targetX + 0.001, targetY + distance * 0.95, targetZ + 0.001],
      front: [targetX, targetY + distance * 0.28, targetZ + distance * 0.88],
      side: [targetX + distance * 0.88, targetY + distance * 0.28, targetZ],
    },
  };
}
