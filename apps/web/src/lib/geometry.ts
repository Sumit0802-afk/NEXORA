type Point = [number, number];

/** Snaps a value to the nearest grid step (default 0.5 plan units). */
export function snapToGrid(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

/** Shoelace-formula polygon area (plan units²). Assumes a simple, non-self-intersecting polygon. */
export function polygonArea(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(polygon: Point[]): number {
  let total = 0;
  for (let i = 0; i < polygon.length; i++) {
    total += distance(polygon[i], polygon[(i + 1) % polygon.length]);
  }
  return total;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Projects `p` onto segment a-b, clamped to the segment, returning the point and the offset distance from `a`. */
export function projectOntoSegment(p: Point, a: Point, b: Point) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq));
  const point: Point = [a[0] + t * abx, a[1] + t * aby];
  return { point, offset: t * Math.sqrt(lenSq), t };
}

export function polygonEdges(polygon: Point[]): [Point, Point][] {
  return polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]] as [Point, Point]);
}

/** Finds the closest polygon edge (across all given polygons) to `p`, within `tolerance` plan units. */
export function nearestEdge(polygons: Point[][], p: Point, tolerance: number) {
  let best: { start: Point; end: Point; point: Point; offset: number; dist: number } | null = null;
  for (const polygon of polygons) {
    for (const [a, b] of polygonEdges(polygon)) {
      const { point, offset } = projectOntoSegment(p, a, b);
      const dist = distance(p, point);
      if (dist <= tolerance && (!best || dist < best.dist)) {
        best = { start: a, end: b, point, offset, dist };
      }
    }
  }
  return best;
}
