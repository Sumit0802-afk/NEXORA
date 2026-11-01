import type { ArchCategory, RoofType, WindowGrid, WindowShape } from "./schema";
import type { RailingStyle } from "../terrace-catalog";

/**
 * Reads a photo of a house with classical image processing: no model and no network, so it runs in the browser and
 * the same photo always gives the same answer. Works on a small RGBA image (see MAX_ANALYSIS_SIDE).
 *
 *   segment sky / greenery / ground -> find the building -> skyline gives the roof form -> colour clusters give the
 *   palette -> dark or glowing rectangles give the windows -> gradients give the wall texture.
 *
 * One photo cannot prove what the far side of a house looks like, so every reading carries a confidence.
 */

export const MAX_ANALYSIS_SIDE = 360;

export type PixelImage = { width: number; height: number; data: ArrayLike<number> };

export type WallTexture = "smooth" | "concrete" | "stucco" | "brick" | "siding" | "timber" | "stone";

export type Reading<T> = { value: T; confidence: number };

export type FacadeAnalysis = {
  found: boolean;
  width: number;
  height: number;
  /** Building bounds as fractions of the image. */
  box: { x0: number; y0: number; x1: number; y1: number };
  skyShare: number;
  greeneryShare: number;
  palette: { hex: string; share: number }[];
  wall: Reading<{ hex: string; texture: WallTexture }>;
  accent: Reading<{ hex: string; texture: WallTexture } | null>;
  roof: Reading<{ type: RoofType; pitch: number; hex: string; overhangRatio: number }>;
  windows: Reading<{
    count: number;
    /** Glass area over wall area. */
    coverage: number;
    shape: WindowShape;
    grid: WindowGrid;
    aspect: number;
    frameHex: string;
    glassHex: string;
    glowing: boolean;
  }>;
  door: Reading<{ hex: string; glazed: boolean; aspect: number } | null>;
  balcony: Reading<{ style: RailingStyle; hex: string } | null>;
  storeys: Reading<number>;
  symmetry: number;
  landscape: { lawn: number; trees: number };
  style: Reading<ArchCategory> & { scores: Record<ArchCategory, number> };
  warnings: string[];
};

type Lab = [number, number, number];

const GAMMA = new Float32Array(256).map((_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});

function rgbToLab(r: number, g: number, b: number): Lab {
  const R = GAMMA[r], G = GAMMA[g], B = GAMMA[b];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToHex([L, a, b]: Lab): string {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ];
  const channel = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
  };
  return `#${lin.map(channel).join("")}`.toUpperCase();
}

const deltaE = (p: Lab, q: Lab) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** One photo can suggest a roof or a style but never prove it, so a pixel reading is never reported as certain. */
const belief = (v: number) => Math.min(0.85, Math.max(0, v));

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((p, q) => p - q);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Deterministic k-means (k-means++ seeding from a fixed generator) over Lab samples. */
function kmeans(samples: Lab[], k: number): { center: Lab; count: number }[] {
  if (!samples.length) return [];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const centers: Lab[] = [samples[Math.floor(rand() * samples.length)]];
  while (centers.length < Math.min(k, samples.length)) {
    const dists = samples.map((s) => Math.min(...centers.map((c) => deltaE(s, c))) ** 2);
    const total = dists.reduce((sum, d) => sum + d, 0);
    if (total === 0) break;
    let pick = rand() * total;
    let index = 0;
    while (index < dists.length - 1 && (pick -= dists[index]) > 0) index++;
    centers.push(samples[index]);
  }
  const labels = new Int32Array(samples.length);
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    samples.forEach((s, i) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, ci) => {
        const d = deltaE(s, c);
        if (d < bestD) { bestD = d; best = ci; }
      });
      labels[i] = best;
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2]; sums[best][3] += 1;
    });
    centers.forEach((_, ci) => {
      const n = sums[ci][3];
      if (n) centers[ci] = [sums[ci][0] / n, sums[ci][1] / n, sums[ci][2] / n];
    });
  }
  const counts = centers.map(() => 0);
  labels.forEach((l) => counts[l]++);
  return centers.map((center, i) => ({ center, count: counts[i] })).filter((c) => c.count > 0).sort((p, q) => q.count - p.count);
}

type Blob = { x0: number; y0: number; x1: number; y1: number; area: number; pixels: number[] };

/** Connected components of a mask. */
function components(mask: Uint8Array, w: number, h: number, diagonal = false): Blob[] {
  const seen = new Uint8Array(w * h);
  const out: Blob[] = [];
  const steps = diagonal ? [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1] : [-1, 1, -w, w];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const blob: Blob = { x0: w, y0: h, x1: 0, y1: 0, area: 0, pixels: [] };
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      blob.pixels.push(i);
      blob.area++;
      blob.x0 = Math.min(blob.x0, x); blob.x1 = Math.max(blob.x1, x);
      blob.y0 = Math.min(blob.y0, y); blob.y1 = Math.max(blob.y1, y);
      for (const step of steps) {
        const n = i + step;
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        const nx = n % w;
        if (Math.abs(nx - x) > 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    out.push(blob);
  }
  return out;
}

function morph(mask: Uint8Array, w: number, h: number, grow: boolean): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const around = [i, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      const hits = around.filter((n) => n >= 0 && mask[n]).length;
      out[i] = grow ? (hits > 0 ? 1 : 0) : (hits === around.filter((n) => n >= 0).length ? 1 : 0);
    }
  }
  return out;
}

/** Flood from seed pixels over smooth, similar colours; stops at edges. Used for sky and for ground. */
function flood(lab: Lab[], grad: Float32Array, w: number, h: number, seeds: number[], limitY: number, reach: number, edge: number, step: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (!seeds.length) return mask;
  const mean: Lab = [0, 0, 0];
  for (const s of seeds) { mean[0] += lab[s][0]; mean[1] += lab[s][1]; mean[2] += lab[s][2]; }
  mean[0] /= seeds.length; mean[1] /= seeds.length; mean[2] /= seeds.length;
  const stack = [...seeds];
  for (const s of seeds) mask[s] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (n < 0 || n >= mask.length || mask[n]) continue;
      if (limitY >= 0 ? Math.floor(n / w) < limitY : Math.floor(n / w) > -limitY) continue;
      if (grad[n] > edge || deltaE(lab[i], lab[n]) > step || deltaE(lab[n], mean) > reach) continue;
      mask[n] = 1;
      stack.push(n);
    }
  }
  return mask;
}

function isGreenery([L, a, b]: Lab): boolean {
  return (a < -6 && b > 3) || (L < 42 && a < -3 && b > 1);
}

function textureOf(indices: number[], lab: Lab[], gx: Float32Array, gy: Float32Array): { texture: WallTexture; confidence: number } {
  if (indices.length < 40) return { texture: "smooth", confidence: 0.2 };
  let edges = 0, horizontalLines = 0, verticalLines = 0;
  const color: Lab = [0, 0, 0];
  for (const i of indices) {
    const strength = Math.hypot(gx[i], gy[i]);
    if (strength > 12) edges++;
    horizontalLines += gy[i] * gy[i];
    verticalLines += gx[i] * gx[i];
    color[0] += lab[i][0]; color[1] += lab[i][1]; color[2] += lab[i][2];
  }
  const density = edges / indices.length;
  const anisotropy = (horizontalLines - verticalLines) / (horizontalLines + verticalLines + 1);
  const [L, a, b] = color.map((v) => v / indices.length);
  const chroma = Math.hypot(a, b);
  const woody = a > 3 && b > 10 && L < 68;
  const reddish = a > 10 && b > 6;

  // Photos carry shading and noise, so a surface only counts as textured when clear lines cover a good part of it.
  if (density < 0.09) {
    if (chroma < 6 && L > 32 && L < 72) return { texture: "concrete", confidence: 0.5 };
    if (woody) return { texture: "timber", confidence: 0.4 };
    if (b > 12 && L > 58) return { texture: "stucco", confidence: 0.5 };
    return { texture: "smooth", confidence: 0.7 };
  }
  const certainty = clamp01(0.3 + density + Math.abs(anisotropy) * 0.5);
  if (anisotropy > 0.2) {
    if (reddish) return { texture: "brick", confidence: certainty };
    if (woody) return { texture: "siding", confidence: certainty };
    return { texture: "siding", confidence: certainty * 0.6 };
  }
  if (anisotropy < -0.2) return { texture: woody ? "timber" : "concrete", confidence: certainty * (woody ? 1 : 0.6) };
  if (reddish) return { texture: "brick", confidence: certainty * 0.8 };
  return { texture: density > 0.16 ? "stone" : "stucco", confidence: certainty * 0.6 };
}

function scoreStyle(input: {
  roof: RoofType;
  glass: number;
  wall: Lab;
  roofColor: Lab;
  texture: WallTexture;
  accent: WallTexture | null;
  shape: WindowShape;
  grid: WindowGrid;
  symmetry: number;
  paletteSpread: number;
  busy: number;
}): Record<ArchCategory, number> {
  const { roof, glass, wall, roofColor, texture, accent, shape, grid, symmetry, paletteSpread, busy } = input;
  const flat = roof === "flat" || roof === "cantilever";
  const pitched = !flat;
  const neutral = Math.hypot(wall[1], wall[2]) < 11;
  const warmWall = wall[2] > 9 && wall[0] > 62;
  const clayRoof = roofColor[1] > 12 && roofColor[2] > 12;
  const arched = shape === "arched" || shape === "segmental" || shape === "gothic";
  const scores: Record<ArchCategory, number> = {
    modern: (flat ? 2.2 : 0) + clamp01(glass * 3) * 2 + (glass > 0.25 ? 0.8 : 0) + (neutral ? 0.7 : 0) + (accent ? 0.5 : 0),
    minimalist: (flat ? 1.8 : 0) + (neutral && wall[0] > 60 ? 1.2 : 0) + (paletteSpread < 26 ? 1.3 : 0) + (busy < 0.09 ? 1.2 : 0) + (accent ? -0.8 : 0),
    contemporary: (accent === "timber" || accent === "stone" ? 2 : 0) + (roof === "shed" ? 1.6 : 0) + (flat ? 0.8 : 0) + clamp01(glass * 2.5) + (glass > 0.25 && pitched ? 0.7 : 0),
    luxury: (symmetry > 0.72 ? 1.6 : 0) + (texture === "stone" || accent === "stone" ? 1.2 : 0) + (roof === "hip" || roof === "mansard" ? 1 : 0) + (arched ? 0.5 : 0) + (wall[0] > 70 ? 0.4 : 0),
    traditional: (pitched ? 1.3 : 0) + (texture === "brick" || texture === "siding" ? 1.6 : 0) + (grid === "colonial" || grid === "cross" ? 1 : 0) + (glass < 0.16 ? 0.7 : 0) - (glass > 0.25 ? 1 : 0),
    mediterranean: (clayRoof ? 2.4 : 0) + (warmWall ? 1.1 : 0) + (arched ? 1.5 : 0) + (texture === "stucco" ? 0.8 : 0) + (pitched ? 0.4 : 0),
  };
  return scores;
}

const NOT_FOUND = (w: number, h: number, palette: { hex: string; share: number }[], skyShare: number, greeneryShare: number): FacadeAnalysis => {
  const none = 0.1;
  const scores = { modern: 0, minimalist: 0, contemporary: 0, luxury: 0, traditional: 0, mediterranean: 0 };
  return {
    found: false, width: w, height: h, box: { x0: 0, y0: 0, x1: 1, y1: 1 }, skyShare, greeneryShare, palette,
    wall: { value: { hex: palette[0]?.hex ?? "#E8E4DA", texture: "smooth" }, confidence: none },
    accent: { value: null, confidence: none },
    roof: { value: { type: "flat", pitch: 25, hex: palette[1]?.hex ?? "#6A6A6A", overhangRatio: 0 }, confidence: none },
    windows: { value: { count: 0, coverage: 0, shape: "rectangular", grid: "none", aspect: 1.4, frameHex: "#2A2A2E", glassHex: "#6B7F8C", glowing: false }, confidence: none },
    door: { value: null, confidence: none },
    balcony: { value: null, confidence: none },
    storeys: { value: 1, confidence: none },
    symmetry: 0,
    landscape: { lawn: 0, trees: 0 },
    style: { value: "modern", confidence: none, scores },
    warnings: ["We could not find a clear building in this photo. A straight-on photo of the front of a house works best."],
  };
};

export function analyzeFacade(image: PixelImage): FacadeAnalysis {
  const { width: w, height: h, data } = image;
  const n = w * h;
  const lab: Lab[] = new Array(n);
  for (let i = 0; i < n; i++) lab[i] = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  // Sobel over lightness.
  const gx = new Float32Array(n), gy = new Float32Array(n), grad = new Float32Array(n);
  const L = (x: number, y: number) => lab[y * w + x][0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1)) / 4;
      gy[i] = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1)) / 4;
      grad[i] = Math.hypot(gx[i], gy[i]);
    }
  }

  const greenery = new Uint8Array(n);
  let greeneryCount = 0;
  for (let i = 0; i < n; i++) {
    if (isGreenery(lab[i])) { greenery[i] = 1; greeneryCount++; }
  }

  // Sky: walk down each column from the top. Clouds and haze change gradually and are followed by a slowly updated
  // reference colour; a wall, even a pale one, departs from it. Then fill sideways only, where a cloud edge stopped a
  // column: sideways filling cannot run down a wall.
  const sky = new Uint8Array(n);
  const skyLimit = Math.floor(h * 0.85);
  for (let x = 0; x < w; x++) {
    if (lab[x][0] <= 30 || greenery[x] || grad[w + x] >= 8) continue;
    const reference: Lab = [lab[x][0], lab[x][1], lab[x][2]];
    for (let y = 0; y < skyLimit; y++) {
      const i = y * w + x;
      const c = lab[i];
      if (greenery[i] || (y > 1 && (Math.abs(gy[i]) > 8 || deltaE(c, lab[i - w]) > 5 || deltaE(c, reference) > 7))) break;
      sky[i] = 1;
      reference[0] += (c[0] - reference[0]) * 0.12; reference[1] += (c[1] - reference[1]) * 0.12; reference[2] += (c[2] - reference[2]) * 0.12;
    }
  }
  for (let y = 0; y < skyLimit; y++) {
    for (const direction of [1, -1]) {
      for (let x = direction > 0 ? 1 : w - 2; x > 0 && x < w - 1; x += direction) {
        const i = y * w + x, from = i - direction;
        if (sky[from] && !sky[i] && !greenery[i] && grad[i] < 5 && deltaE(lab[i], lab[from]) < 2.5) sky[i] = 1;
      }
    }
  }
  let skyCount = 0;
  for (let i = 0; i < n; i++) if (sky[i]) skyCount++;

  // Ground: the same from the bottom edge, kept to the lower part of the frame so a close-up wall is not swallowed.
  const groundSeeds: number[] = [];
  for (let y = h - 1; y >= Math.floor(h * 0.96); y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grad[i] < 10) groundSeeds.push(i);
    }
  }
  const ground = flood(lab, grad, w, h, groundSeeds, Math.floor(h * 0.66), 28, 16, 6);

  const candidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) candidate[i] = !sky[i] && !greenery[i] && !ground[i] ? 1 : 0;
  const opened = morph(morph(candidate, w, h, false), w, h, true);
  const blobs = components(opened, w, h).sort((p, q) => q.area - p.area);

  // Palette over everything that is not sky or greenery, in case the building cannot be isolated.
  const samplePixels = (pixels: number[], limit = 2600): Lab[] => {
    const step = Math.max(1, Math.floor(pixels.length / limit));
    const out: Lab[] = [];
    for (let i = 0; i < pixels.length; i += step) out.push(lab[pixels[i]]);
    return out;
  };

  const building = blobs[0];
  const skyShare = skyCount / n;
  const greeneryShare = greeneryCount / n;
  if (!building || building.area < n * 0.05) {
    const fallback: number[] = [];
    for (let i = 0; i < n; i++) if (!sky[i] && !greenery[i]) fallback.push(i);
    const clusters = kmeans(samplePixels(fallback), 5);
    const total = clusters.reduce((sum, c) => sum + c.count, 0) || 1;
    return NOT_FOUND(w, h, clusters.map((c) => ({ hex: labToHex(c.center), share: c.count / total })), skyShare, greeneryShare);
  }

  const mask = new Uint8Array(n);
  for (const i of building.pixels) mask[i] = 1;

  // Trim stray columns (a lamp post, a fence) so the width reflects the house itself.
  const columnCount = new Int32Array(w);
  for (const i of building.pixels) columnCount[i % w]++;
  const peakColumn = Math.max(...columnCount);
  let x0 = building.x0, x1 = building.x1;
  while (x0 < x1 && columnCount[x0] < peakColumn * 0.18) x0++;
  while (x1 > x0 && columnCount[x1] < peakColumn * 0.18) x1--;
  const y0 = building.y0, y1 = building.y1;
  const boxW = Math.max(1, x1 - x0 + 1), boxH = Math.max(1, y1 - y0 + 1);

  // Skyline: top of the building in each column.
  const rawTop: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let top = y1;
    for (let y = y0; y <= y1; y++) {
      if (mask[y * w + x]) { top = y; break; }
    }
    rawTop.push(top);
  }
  const skyline = rawTop.map((_, i) => median(rawTop.slice(Math.max(0, i - 3), i + 4)));
  const peak = Math.min(...skyline);
  const profile = skyline.map((y) => (y - peak) / boxH);

  const windowSize = Math.max(4, Math.round(boxW * 0.04));
  const slopes: number[] = [];
  for (let i = 0; i + windowSize < profile.length; i++) slopes.push(((profile[i + windowSize] - profile[i]) * boxH) / windowSize);
  const rising = slopes.filter((s) => s < -0.12 && s > -1.6).length / (slopes.length || 1);
  const falling = slopes.filter((s) => s > 0.12 && s < 1.6).length / (slopes.length || 1);
  const plateau = profile.filter((p) => p < 0.035).length / profile.length;
  const pitchFrom = (list: number[]) => (Math.atan(Math.max(0.15, median(list.map(Math.abs)))) * 180) / Math.PI;

  // A band of a different colour under the skyline: the roof plane when the ridge runs along the street.
  const bandHeights: number[] = [];
  const bandSamples: Lab[] = [];
  const midStart = Math.floor(boxW * 0.2), midEnd = Math.ceil(boxW * 0.8);
  for (let c = midStart; c < midEnd; c += 2) {
    const x = x0 + c;
    const top = skyline[c];
    let best = 0, bestAt = -1;
    const limit = Math.min(y1 - 3, top + Math.floor(boxH * 0.5));
    for (let y = top + 3; y < limit; y++) {
      const above = lab[(y - 2) * w + x], below = lab[(y + 2) * w + x];
      const d = deltaE(above, below);
      if (d > best) { best = d; bestAt = y; }
    }
    if (best > 13 && bestAt > 0) {
      bandHeights.push(bestAt - top);
      bandSamples.push(lab[Math.floor((top + bestAt) / 2) * w + x]);
    }
  }
  const bandHeight = median(bandHeights);
  const bandAgreement = bandHeights.filter((b) => Math.abs(b - bandHeight) < boxH * 0.06).length / Math.max(1, (midEnd - midStart) / 2);
  const bandShare = bandHeight / boxH;
  // Windows also make an edge under the skyline. A roof differs in colour from the wall below it; a wall above a window does not.
  const lowerSamples: Lab[] = [];
  for (let y = y0 + Math.floor(boxH * 0.55); y < y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) if (mask[y * w + x]) lowerSamples.push(lab[y * w + x]);
  }
  const bandColor: Lab = [median(bandSamples.map((c) => c[0])), median(bandSamples.map((c) => c[1])), median(bandSamples.map((c) => c[2]))];
  const lowerColors = kmeans(lowerSamples.slice(0, 1800), 3);
  const lowerTotal = lowerColors.reduce((sum, c) => sum + c.count, 0) || 1;
  const bandDiffers = bandSamples.length > 0 && !lowerColors.some((c) => c.count / lowerTotal > 0.12 && deltaE(c.center, bandColor) < 12);

  const widthAt = (fromRatio: number, toRatio: number) => {
    const rows: number[] = [];
    for (let y = y0 + Math.floor(boxH * fromRatio); y <= y0 + Math.floor(boxH * toRatio); y += 2) {
      let first = -1, last = -1;
      for (let x = x0; x <= x1; x++) {
        if (mask[y * w + x]) { if (first < 0) first = x; last = x; }
      }
      if (first >= 0) rows.push(last - first + 1);
    }
    return median(rows);
  };
  const overhangRatio = Math.max(0, widthAt(0, 0.14) / Math.max(1, widthAt(0.42, 0.7)) - 1);

  // The eave: the longest horizontal edge in the upper part of the building. Everything above it is roof.
  let eaveRow = -1, eaveStrength = 0;
  for (let y = y0 + Math.floor(boxH * 0.08); y <= y0 + Math.floor(boxH * 0.66); y++) {
    let hits = 0;
    for (let x = x0; x <= x1; x++) if (Math.abs(gy[y * w + x]) > 9) hits++;
    const share = hits / boxW;
    if (share > eaveStrength) { eaveStrength = share; eaveRow = y; }
  }
  const sloped = rising + falling;
  const slopedSkyline = sloped > 0.4;
  const bandRoof = !slopedSkyline && bandShare > 0.1 && bandShare < 0.55 && bandAgreement > 0.6 && bandDiffers;
  const pitchedRoof = slopedSkyline || bandRoof;
  const eave = pitchedRoof ? (eaveStrength > 0.28 ? eaveRow : y0 + Math.floor(boxH * 0.3)) : -1;
  const flatRim = Math.max(1, Math.round(boxH * 0.04));
  const wallFloor = y1 - boxH * 0.1;

  // Splits the building into roof and wall zones and reads their colours. Runs again if the first guess at the roof changes.
  const readZones = (pitched: boolean) => {
    const eave = pitched ? (eaveStrength > 0.28 ? eaveRow : y0 + Math.floor(boxH * 0.3)) : -1;
    const roofPixels: number[] = [], wallPixels: number[] = [], rimPixels: number[] = [];
    for (let c = 0; c < skyline.length; c++) {
      const x = x0 + c;
      for (let y = skyline[c]; y <= y1; y++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        (pitched ? y < eave : y < skyline[c] + flatRim) ? roofPixels.push(i) : wallPixels.push(i);
        if (y < skyline[c] + Math.max(3, boxH * 0.05)) rimPixels.push(i);
      }
    }
    // The wall colour comes from open wall, not the ground zone or glass that glows or mirrors the sky. Between faces of
    // the same wall the sunlit one is the true colour, so lighter clusters are favoured over shaded ones.
    const wallClusters = kmeans(samplePixels(wallPixels.filter((i) => i / w < wallFloor)), 6);
    const wallTotal = wallClusters.reduce((sum, c) => sum + c.count, 0) || 1;
    const notGlass = wallClusters.filter((c) => c.center[0] > 34 && !(c.center[2] > 30 && c.center[0] > 52) && c.center[2] > -7 && c.count / wallTotal > 0.07);
    // Measured on solid area, so the thin bright lines of mortar never outweigh the bricks.
    const solidShare = (c: { center: Lab }) => {
      const hit = new Uint8Array(n);
      for (const i of wallPixels) if (deltaE(lab[i], c.center) < 14) hit[i] = 1;
      const solid = morph(hit, w, h, false);
      return solid.reduce((sum, v) => sum + v, 0) / Math.max(1, wallPixels.length);
    };
    const score = (c: { center: Lab; count: number }) => solidShare(c) * (0.35 + c.center[0] / 100) ** 3;
    const wallCluster = notGlass.map((c) => ({ c, s: score(c) })).sort((p, q) => q.s - p.s)[0]?.c ?? wallClusters[0];
    const wallLab: Lab = wallCluster?.center ?? [80, 0, 5];

    const roofColors = kmeans(samplePixels(roofPixels), 3).filter((c) => deltaE(c.center, wallLab) > 12);
    const rimColors = kmeans(samplePixels(rimPixels), 2).filter((c) => deltaE(c.center, wallLab) > 10);
    const roofTotal = kmeans(samplePixels(roofPixels), 3).reduce((sum, c) => sum + c.count, 0) || 1;
    // A triangle under the skyline in the wall's colour is a gable end. In another colour, it is a roof plane facing us.
    const faceIsRoof = pitched && roofColors.reduce((sum, c) => sum + c.count, 0) / roofTotal > 0.5;
    // Roof coverings tend to be dark or strongly coloured, which sets them apart from sky-lit flashing and wall in the zone.
    const roofScore = (c: { center: Lab; count: number }) => c.count * (1 + Math.hypot(c.center[1], c.center[2]) / 22);
    const roofLab: Lab = [...roofColors].sort((p, q) => roofScore(q) - roofScore(p))[0]?.center ?? rimColors[0]?.center ?? wallLab;
    return { roofPixels, wallPixels, wallClusters, wallCluster, wallLab, wallShare: (wallCluster?.count ?? 0) / wallTotal, wallTotal, faceIsRoof, roofLab };
  };

  // Seen from a corner, a flat box has a peaked skyline too. A real gable peaks near the middle and is either a roof
  // plane or a wall-coloured triangle centred on the house; a corner view peaks off to one side.
  const top = profile.map((p, i) => (p < 0.035 ? i : -1)).filter((i) => i >= 0);
  const peakOffset = Math.abs(median(top) / Math.max(1, profile.length) - 0.5);
  let zones = readZones(pitchedRoof);
  const cornerView = slopedSkyline && !bandRoof && !zones.faceIsRoof && peakOffset > 0.16;
  if (cornerView) zones = readZones(false);
  const { roofPixels, wallPixels, wallClusters, wallCluster, wallLab, wallShare, wallTotal, faceIsRoof, roofLab } = zones;

  let roofType: RoofType;
  let roofConfidence: number;
  let pitch = 28;
  const oneWay = Math.max(rising, falling) > 0.55 && Math.min(rising, falling) < 0.08;
  if (slopedSkyline && !cornerView && !oneWay) {
    roofType = plateau > 0.2 || faceIsRoof ? "hip" : "gable";
    roofConfidence = clamp01(0.45 + sloped * 0.5);
    pitch = pitchFrom(slopes.filter((s) => Math.abs(s) > 0.12));
  } else if (slopedSkyline && !cornerView) {
    roofType = "shed";
    roofConfidence = clamp01(0.4 + sloped * 0.4);
    pitch = pitchFrom(slopes.filter((s) => Math.abs(s) > 0.12));
  } else if (bandRoof) {
    // The skyline reads level but a roof plane sits under it: a ridge parallel to the street.
    roofType = sloped > 0.14 ? "hip" : "gable";
    roofConfidence = clamp01(0.3 + bandAgreement * 0.4);
  } else {
    roofType = overhangRatio > 0.05 ? "cantilever" : "flat";
    roofConfidence = clamp01(0.5 + (1 - sloped) * 0.3 + Math.min(overhangRatio, 0.2));
  }

  const allBuilding = [...roofPixels, ...wallPixels];
  const paletteClusters = kmeans(samplePixels(allBuilding), 6);
  const paletteTotal = paletteClusters.reduce((sum, c) => sum + c.count, 0) || 1;
  const palette = paletteClusters.map((c) => ({ hex: labToHex(c.center), share: c.count / paletteTotal }));

  // Windows: rectangles that differ from the wall by being dark, sky-coloured glass or lit from inside.
  const openingMask = new Uint8Array(n);
  let glowing = 0, darkGlass = 0;
  for (const i of wallPixels) {
    const c = lab[i];
    if (deltaE(c, wallLab) < 20) continue;
    const dark = c[0] < wallLab[0] - 14;
    const blue = c[2] < wallLab[2] - 10 && c[2] < 2;
    const lit = c[0] > wallLab[0] + 6 && c[2] > wallLab[2] + 12;
    if (dark || blue || lit) {
      openingMask[i] = 1;
      if (lit) glowing++;
      else darkGlass++;
    }
  }
  const closed = morph(morph(openingMask, w, h, true), w, h, false);
  const nearOpening = morph(morph(closed, w, h, true), w, h, true);
  const insideBuilding = morph(morph(mask, w, h, false), w, h, false);

  // Texture is measured on open wall, so window edges and the outline of the house do not read as a busy surface.
  // The colour match is widened by a pixel or two to take in the mortar between bricks.
  const textureRegion = (matches: (i: number) => boolean): number[] => {
    const hit = new Uint8Array(n);
    for (const i of wallPixels) if (matches(i)) hit[i] = 1;
    const widened = morph(morph(hit, w, h, true), w, h, true);
    return wallPixels.filter((i) => widened[i] && insideBuilding[i] && !nearOpening[i]);
  };
  const wallTexture = textureOf(textureRegion((i) => deltaE(lab[i], wallLab) < 17), lab, gx, gy);
  const minArea = building.area * 0.0015;
  const openings = components(closed, w, h, true)
    .filter((b) => {
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      return b.area >= minArea && bw >= 3 && bh >= 3 && bw < boxW * 0.85 && bh < boxH * 0.8 && b.area / (bw * bh) >= 0.45;
    });

  // The door: a tall opening that reaches the ground zone, closest to the middle.
  const doorZone = y1 - boxH * 0.18;
  const doorCandidates = openings
    .filter((b) => b.y1 >= doorZone && (b.y1 - b.y0 + 1) / (b.x1 - b.x0 + 1) > 1.3)
    .sort((p, q) => Math.abs((p.x0 + p.x1) / 2 - (x0 + x1) / 2) - Math.abs((q.x0 + q.x1) / 2 - (x0 + x1) / 2));
  const doorBlob = doorCandidates[0] ?? null;
  const windowBlobs = openings.filter((b) => b !== doorBlob);

  const windowArea = windowBlobs.reduce((sum, b) => sum + b.area, 0) + (doorBlob?.area ?? 0);
  const coverage = windowArea / Math.max(1, wallPixels.length);

  let archVotes = 0, roundVotes = 0, rectVotes = 0, peakVotes = 0;
  const vBars: number[] = [], hBars: number[] = [];
  const ringSamples: Lab[] = [], glassSamples: Lab[] = [];
  const aspects: number[] = [];
  for (const b of windowBlobs) {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    aspects.push(bh / bw);
    const filled = (x: number, y: number) => closed[y * w + x] === 1;
    const corner = (cx0: number, cx1: number, cy0: number, cy1: number) => {
      let hit = 0, all = 0;
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { all++; if (filled(x, y)) hit++; }
      return all ? hit / all : 1;
    };
    const cw = Math.max(1, Math.floor(bw * 0.22)), ch = Math.max(1, Math.floor(bh * 0.22));
    const topFill = (corner(b.x0, b.x0 + cw, b.y0, b.y0 + ch) + corner(b.x1 - cw, b.x1, b.y0, b.y0 + ch)) / 2;
    const bottomFill = (corner(b.x0, b.x0 + cw, b.y1 - ch, b.y1) + corner(b.x1 - cw, b.x1, b.y1 - ch, b.y1)) / 2;
    const topCentre = corner(Math.floor((b.x0 + b.x1) / 2) - 1, Math.floor((b.x0 + b.x1) / 2) + 1, b.y0, b.y0 + ch);
    if (bw >= 7 && bh >= 7) {
      if (topFill < 0.4 && bottomFill < 0.4 && Math.abs(bh / bw - 1) < 0.25) roundVotes++;
      else if (topFill < 0.22 && bottomFill > 0.6 && topCentre > 0.6) peakVotes++;
      else if (topFill < 0.5 && bottomFill > 0.65) archVotes++;
      else rectVotes++;
    } else rectVotes++;

    // Mullions show as lines of non-glass inside the opening, before the mask was closed.
    if (bw >= 9 && bh >= 9) {
      const countBars = (outer0: number, outer1: number, inner0: number, inner1: number, horizontal: boolean) => {
        let bars = 0, inside = false;
        for (let a = outer0 + 2; a <= outer1 - 2; a++) {
          let open = 0;
          for (let c = inner0; c <= inner1; c++) {
            const i = horizontal ? a * w + c : c * w + a;
            if (!openingMask[i]) open++;
          }
          const isBar = open / (inner1 - inner0 + 1) > 0.65;
          if (isBar && !inside) bars++;
          inside = isBar;
        }
        return bars;
      };
      vBars.push(countBars(b.x0, b.x1, b.y0 + 2, b.y1 - 2, false));
      hBars.push(countBars(b.y0, b.y1, b.x0 + 2, b.x1 - 2, true));
    }

    for (let x = b.x0; x <= b.x1; x += 2) {
      for (const y of [b.y0 - 1, b.y1 + 1]) if (y >= 0 && y < h) ringSamples.push(lab[y * w + x]);
    }
    for (let y = b.y0; y <= b.y1; y += 2) {
      for (const x of [b.x0 - 1, b.x1 + 1]) if (x >= 0 && x < w) ringSamples.push(lab[y * w + x]);
    }
    for (const i of b.pixels.filter((_, index) => index % 3 === 0)) if (openingMask[i]) glassSamples.push(lab[i]);
  }

  const votes: [WindowShape, number][] = [["rectangular", rectVotes], ["arched", archVotes], ["round", roundVotes], ["gothic", peakVotes]];
  votes.sort((p, q) => q[1] - p[1]);
  // A single misread opening should not arch the whole house.
  const shape: WindowShape = votes[0][1] >= Math.max(2, windowBlobs.length * 0.34) || (windowBlobs.length < 3 && votes[0][1] >= 1) ? votes[0][0] : "rectangular";
  const shapeShare = votes[0][1] / Math.max(1, windowBlobs.length);

  const barsV = median(vBars), barsH = median(hBars);
  const grid: WindowGrid = barsV >= 2 && barsH >= 1 ? "colonial" : barsV >= 1 && barsH >= 1 ? "cross" : barsV >= 1 ? "vertical" : "none";

  const ringClusters = kmeans(ringSamples.slice(0, 1500), 2);
  const ring = ringClusters.find((c) => deltaE(c.center, wallLab) > 12)?.center ?? null;
  const glassClusters = kmeans(glassSamples.slice(0, 1500), 2);
  const glass = glassClusters[0]?.center ?? ([34, -2, -5] as Lab);
  const glassDark = glassClusters.map((c) => c.center).sort((p, q) => p[0] - q[0])[0] ?? glass;
  const frameHex = labToHex(ring ?? ([Math.min(glassDark[0], 22), 0, 0] as Lab));

  // Storeys: rows of windows.
  const rows: number[] = [];
  for (const center of windowBlobs.map((b) => (b.y0 + b.y1) / 2).sort((p, q) => p - q)) {
    if (!rows.length || center - rows[rows.length - 1] > boxH * 0.17) rows.push(center);
  }
  const storeys = Math.min(4, Math.max(1, rows.length));

  // Accent: the largest other wall colour that is not simply glass.
  const accentCluster = wallClusters.find((c) => c !== wallCluster && deltaE(c.center, wallLab) > 18 && c.center[0] > 20 && c.count / wallTotal > 0.06 && !(deltaE(c.center, glass) < 12));
  let accent: FacadeAnalysis["accent"] = { value: null, confidence: 0.3 };
  if (accentCluster) {
    const reading = textureOf(textureRegion((i) => deltaE(lab[i], accentCluster.center) < 15), lab, gx, gy);
    accent = {
      value: { hex: labToHex(accentCluster.center), texture: reading.texture },
      confidence: belief(0.3 + (accentCluster.count / wallTotal) * 2 + reading.confidence * 0.2),
    };
  }

  // Balcony: a strong horizontal slab line above the ground floor with a railing band just above it.
  let balcony: FacadeAnalysis["balcony"] = { value: null, confidence: 0.3 };
  if (storeys >= 2 || boxH > boxW * 0.55) {
    let bestRow = -1, bestShare = 0;
    for (let y = y0 + Math.floor(boxH * 0.25); y <= y0 + Math.floor(boxH * 0.72); y++) {
      let hits = 0;
      for (let x = x0; x <= x1; x++) if (mask[y * w + x] && !nearOpening[y * w + x] && Math.abs(gy[y * w + x]) > 11) hits++;
      const share = hits / boxW;
      if (share > bestShare) { bestShare = share; bestRow = y; }
    }
    if (bestRow > 0 && bestShare > 0.32) {
      const bandTop = Math.max(y0, bestRow - Math.floor(boxH * 0.13));
      let vertical = 0, horizontal = 0, count = 0, sumL = 0;
      const colors: Lab[] = [];
      for (let y = bandTop; y < bestRow - 1; y++) {
        for (let x = x0; x <= x1; x += 1) {
          const i = y * w + x;
          if (!mask[i]) continue;
          count++;
          sumL += lab[i][0];
          if (Math.abs(gx[i]) > 11) vertical++;
          if (Math.abs(gy[i]) > 11) horizontal++;
          if (x % 3 === 0) colors.push(lab[i]);
        }
      }
      const vShare = vertical / Math.max(1, count), hShare = horizontal / Math.max(1, count);
      const dominant = kmeans(colors.slice(0, 900), 2)[0]?.center ?? wallLab;
      let style: RailingStyle = "solid_parapet";
      if (vShare > 0.2 && sumL / Math.max(1, count) > 62) style = "baluster";
      else if (vShare > 0.14 || hShare > 0.2) style = "metal_slats";
      else if (deltaE(dominant, wallLab) > 10) style = "glass";
      balcony = { value: { style, hex: labToHex(dominant) }, confidence: clamp01(0.25 + bestShare * 0.7) };
    }
  }

  let doorReading: FacadeAnalysis["door"] = { value: null, confidence: 0.3 };
  if (doorBlob) {
    const c: Lab = [0, 0, 0];
    let count = 0;
    for (const i of doorBlob.pixels) {
      if (!openingMask[i]) continue;
      c[0] += lab[i][0]; c[1] += lab[i][1]; c[2] += lab[i][2]; count++;
    }
    const mean = c.map((v) => v / Math.max(1, count)) as Lab;
    doorReading = {
      value: {
        hex: labToHex(mean),
        glazed: mean[2] < -2 || deltaE(mean, glass) < 8,
        aspect: (doorBlob.y1 - doorBlob.y0 + 1) / (doorBlob.x1 - doorBlob.x0 + 1),
      },
      confidence: clamp01(0.45 + (doorCandidates.length === 1 ? 0.2 : 0)),
    };
  }

  // Left-right symmetry of lightness about the building's centre.
  let mirrorDiff = 0, mirrorCount = 0;
  for (let y = y0; y <= y1; y += 2) {
    for (let c = 0; c < boxW / 2; c += 2) {
      const a = y * w + x0 + c, b = y * w + x1 - c;
      if (mask[a] && mask[b]) { mirrorDiff += Math.abs(lab[a][0] - lab[b][0]); mirrorCount++; }
    }
  }
  const symmetry = clamp01(1 - mirrorDiff / Math.max(1, mirrorCount) / 34);

  let lowGreen = 0, highGreen = 0;
  for (let i = 0; i < n; i++) {
    if (!greenery[i]) continue;
    if (i / w > y1 - boxH * 0.16) lowGreen++;
    else highGreen++;
  }

  const paletteSpread = paletteClusters.reduce((max, c) => Math.max(max, deltaE(c.center, wallLab)), 0);
  let edgeHits = 0;
  for (const i of wallPixels) if (grad[i] > 9) edgeHits++;
  const scores = scoreStyle({
    roof: roofType,
    glass: coverage,
    wall: wallLab,
    roofColor: roofLab,
    texture: wallTexture.texture,
    accent: accent.value?.texture ?? null,
    shape,
    grid,
    symmetry,
    paletteSpread,
    busy: edgeHits / Math.max(1, wallPixels.length),
  });
  const ranked = (Object.entries(scores) as [ArchCategory, number][]).sort((p, q) => q[1] - p[1]);
  const lead = ranked[0][1] - ranked[1][1];

  const warnings: string[] = [];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) < n * 0.14) warnings.push("The house fills only a small part of this photo, so finer details are estimates.");
  const meanL = lab.reduce((sum, c) => sum + c[0], 0) / n;
  if (meanL < 30) warnings.push("This photo is very dark, so colours may look deeper than they really are.");
  if (skyShare < 0.02) warnings.push("No sky is visible, so the roof shape is a best guess.");
  if (greeneryShare > 0.5) warnings.push("Plants hide much of the house, so the materials are estimates.");

  return {
    found: true,
    width: w,
    height: h,
    box: { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h },
    skyShare,
    greeneryShare,
    palette,
    wall: { value: { hex: labToHex(wallLab), texture: wallTexture.texture }, confidence: belief(0.3 + wallShare * 0.8) },
    accent,
    roof: { value: { type: roofType, pitch: Math.round(Math.min(50, Math.max(14, pitch))), hex: labToHex(roofLab), overhangRatio }, confidence: belief(roofConfidence) },
    windows: {
      value: {
        count: windowBlobs.length,
        coverage,
        shape,
        grid,
        aspect: aspects.length ? median(aspects) : 1.4,
        frameHex,
        glassHex: labToHex(glass),
        glowing: glowing > darkGlass,
      },
      confidence: belief((windowBlobs.length >= 2 ? 0.5 : 0.25) + shapeShare * 0.35),
    },
    door: doorReading,
    balcony,
    storeys: { value: storeys, confidence: rows.length >= 1 ? 0.55 : 0.2 },
    symmetry,
    landscape: { lawn: clamp01(lowGreen / (n * 0.12)), trees: clamp01(highGreen / (n * 0.18)) },
    style: { value: ranked[0][0], confidence: belief(0.35 + lead * 0.2), scores },
    warnings,
  };
}
