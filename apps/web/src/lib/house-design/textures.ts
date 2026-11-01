import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { getMaterial, type MaterialDef, type TexturePattern } from "./materials";

/**
 * Material textures drawn in code, so the library needs no image downloads and exports embed them. Each pattern makes a
 * seamless height field and a brightness map; the material's colour tints the brightness map, which is why the same
 * brick can be red or white. Browser only.
 */

const SIZE = 384;

type Field = Float32Array;
type Maps = { albedo: Field; height: Field };

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Periodic value noise so tiles join without seams. */
function valueNoise(cells: number, cellsY: number, seed: number): Field {
  const random = rng(seed);
  const lattice = Array.from({ length: cells * cellsY }, () => random());
  const out = new Float32Array(SIZE * SIZE);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < SIZE; y++) {
    const fy = (y / SIZE) * cellsY, iy = Math.floor(fy), ty = smooth(fy - iy);
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * cells, ix = Math.floor(fx), tx = smooth(fx - ix);
      const at = (i: number, j: number) => lattice[((j + cellsY) % cellsY) * cells + ((i + cells) % cells)];
      const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      out[y * SIZE + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

function fbm(cells: number, octaves: number, seed: number, stretchY = 1): Field {
  const out = new Float32Array(SIZE * SIZE);
  let amplitude = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoise(Math.max(1, cells << o), Math.max(1, Math.round((cells << o) * stretchY)), seed + o * 97);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const blank = (value: number) => new Float32Array(SIZE * SIZE).fill(value);

/** Fills per-cell tone for a running-bond grid; returns mortar distance so joints can be shaded. */
function masonry(rows: number, widthFor: (row: number, random: () => number) => number[], seed: number, joint: number, toneRange: number, bevel: number, base: Field): Maps {
  const random = rng(seed);
  const albedo = blank(1), height = blank(1);
  const rowH = SIZE / rows;
  for (let r = 0; r < rows; r++) {
    const widths = widthFor(r, random);
    const total = widths.reduce((sum, w) => sum + w, 0);
    let cursor = r % 2 ? widths[0] * 0.5 : 0;
    const blocks: { from: number; to: number; tone: number }[] = [];
    for (const w of widths) {
      const px = (w / total) * SIZE;
      blocks.push({ from: cursor, to: cursor + px, tone: 1 - random() * toneRange });
      cursor += px;
    }
    for (let y = Math.floor(r * rowH); y < Math.floor((r + 1) * rowH); y++) {
      const dy = Math.min(y - r * rowH, (r + 1) * rowH - 1 - y);
      for (let x = 0; x < SIZE; x++) {
        const px = x < blocks[0].from ? x + SIZE : x;
        const block = blocks.find((b) => px >= b.from && px < b.to) ?? blocks[blocks.length - 1];
        const dx = Math.min(px - block.from, block.to - 1 - px);
        const edge = Math.min(dx, dy);
        const i = y * SIZE + x;
        const inJoint = edge < joint;
        albedo[i] = inJoint ? 0.66 : block.tone * (0.92 + 0.08 * base[i]);
        height[i] = inJoint ? 0.1 : Math.min(1, 0.5 + edge / bevel) * (0.84 + 0.16 * base[i]);
      }
    }
  }
  return { albedo, height };
}

/** Periodic Voronoi: `edge` is the distance to the nearest cell border. */
function voronoi(count: number, seed: number) {
  const random = rng(seed);
  const points = Array.from({ length: count }, () => ({ x: random() * SIZE, y: random() * SIZE, tone: random() }));
  const edge = new Float32Array(SIZE * SIZE), tone = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let first = Infinity, second = Infinity, id = 0;
      for (let p = 0; p < points.length; p++) {
        const dx = Math.abs(points[p].x - x), dy = Math.abs(points[p].y - y);
        const wx = Math.min(dx, SIZE - dx), wy = Math.min(dy, SIZE - dy);
        const d = Math.sqrt(wx * wx + wy * wy);
        if (d < first) { second = first; first = d; id = p; }
        else if (d < second) second = d;
      }
      edge[y * SIZE + x] = second - first;
      tone[y * SIZE + x] = points[id].tone;
    }
  }
  return { edge, tone };
}

function boards(count: number, seed: number, vertical: boolean, joint: number, stagger: boolean): Maps {
  const random = rng(seed);
  const grain = vertical ? fbm(24, 4, seed, 0.08) : fbm(2, 4, seed, 12);
  const albedo = blank(1), height = blank(1);
  const tones = Array.from({ length: count }, () => 0.84 + random() * 0.16);
  const offsets = Array.from({ length: count }, () => random() * SIZE);
  const step = SIZE / count;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const across = vertical ? x : y, along = vertical ? y : x;
      const board = Math.floor(across / step);
      const dist = Math.min(across - board * step, (board + 1) * step - 1 - across);
      let endJoint = false, tone = tones[board];
      if (stagger) {
        const shifted = (along + offsets[board]) % SIZE;
        endJoint = shifted < 2;
        tone *= shifted < SIZE / 2 ? 1 : 0.95;
      }
      const i = y * SIZE + x;
      const seam = dist < joint || endJoint;
      albedo[i] = seam ? 0.45 : tone * (0.82 + 0.18 * grain[i]);
      height[i] = seam ? 0 : Math.min(1, 0.55 + dist / 7) * (0.9 + 0.1 * grain[i]);
    }
  }
  return { albedo, height };
}

function grid(columns: number, rows: number, grout: number, seed: number, toneRange: number, base: Field): Maps {
  const random = rng(seed);
  const tones = Array.from({ length: columns * rows }, () => 1 - random() * toneRange);
  const albedo = blank(1), height = blank(1);
  const cw = SIZE / columns, ch = SIZE / rows;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
      const edge = Math.min(x - cx * cw, (cx + 1) * cw - 1 - x, y - cy * ch, (cy + 1) * ch - 1 - y);
      const i = y * SIZE + x;
      albedo[i] = edge < grout ? 0.72 : tones[cy * columns + cx] * (0.95 + 0.05 * base[i]);
      height[i] = edge < grout ? 0 : Math.min(1, 0.5 + edge / 5);
    }
  }
  return { albedo, height };
}

function marble(seed: number, dark: boolean): Maps {
  const warp = fbm(3, 5, seed), fine = fbm(6, 4, seed + 5);
  const albedo = blank(1), height = blank(0.5);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const t = ((x + y) / SIZE) * Math.PI * 2 + warp[i] * 8;
      // Thin veins: bright only right at the zero crossing of the warped wave.
      const vein = Math.exp(-Math.abs(Math.sin(t)) * 16) * (0.5 + 0.5 * fine[i]);
      const hair = Math.exp(-Math.abs(Math.sin(t * 2.6 + fine[i] * 6)) * 30) * 0.4;
      const line = Math.min(1, vein + hair);
      albedo[i] = dark ? 0.38 + line * 0.62 : (0.96 + 0.04 * fine[i]) * (1 - line * 0.36);
    }
  }
  return { albedo, height };
}

const PATTERNS: Partial<Record<TexturePattern, () => Maps>> = {
  plaster() {
    const n = fbm(4, 5, 11);
    return { albedo: n.map((v) => 0.93 + 0.07 * v), height: n };
  },
  stucco() {
    const n = fbm(20, 3, 23), coarse = fbm(5, 3, 29);
    return { albedo: n.map((v, i) => 0.88 + 0.12 * (v * 0.6 + coarse[i] * 0.4)), height: n };
  },
  concrete() {
    const n = fbm(3, 6, 31), pores = valueNoise(120, 120, 37);
    return { albedo: n.map((v, i) => (0.84 + 0.16 * v) * (pores[i] > 0.93 ? 0.86 : 1)), height: n.map((v, i) => (pores[i] > 0.93 ? v * 0.5 : v)) };
  },
  concrete_panel() {
    const n = fbm(3, 5, 41);
    const albedo = n.map((v) => 0.84 + 0.16 * v), height = n.slice();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        if (x % (SIZE / 2) < 3 || y < 3) { albedo[i] = 0.45; height[i] = 0; }
        for (const hx of [0.25, 0.75]) {
          for (const hy of [0.25, 0.75]) {
            if (Math.hypot(x - hx * SIZE, y - hy * SIZE) < 5) { albedo[i] = 0.55; height[i] = 0.1; }
          }
        }
      }
    }
    return { albedo, height };
  },
  board_formed() {
    const b = boards(9, 43, false, 1.5, false), n = fbm(3, 4, 47);
    return { albedo: b.albedo.map((v, i) => (0.72 + 0.28 * v) * (0.9 + 0.1 * n[i])), height: b.height };
  },
  planks_vertical: () => boards(7, 53, true, 2, false),
  planks_horizontal: () => boards(7, 59, false, 2.5, false),
  floorboards: () => boards(6, 61, false, 1.5, true),
  marble: () => marble(67, false),
  marble_dark: () => marble(71, true),
  brick() {
    const n = fbm(14, 3, 73);
    return masonry(14, () => [1, 1, 1, 1], 79, 2.4, 0.2, 7, n);
  },
  ashlar() {
    const n = fbm(10, 4, 83);
    return masonry(5, (_, random) => Array.from({ length: 3 }, () => 0.8 + random() * 0.6), 89, 2, 0.14, 9, n);
  },
  ledgestone() {
    const n = fbm(18, 4, 97);
    return masonry(13, (_, random) => Array.from({ length: 4 }, () => 0.5 + random() * 1.4), 101, 2, 0.34, 4, n);
  },
  fieldstone() {
    const { edge, tone } = voronoi(26, 103);
    const n = fbm(12, 3, 107);
    return {
      albedo: edge.map((e, i) => (e < 5 ? 0.52 : (0.72 + 0.28 * tone[i]) * (0.9 + 0.1 * n[i]))),
      height: edge.map((e, i) => Math.min(1, e / 16) * (0.8 + 0.2 * n[i])),
    };
  },
  granite() {
    const speck = valueNoise(150, 150, 109), coarse = valueNoise(70, 70, 113);
    return { albedo: speck.map((v, i) => 0.74 + 0.26 * (v * 0.6 + coarse[i] * 0.4)), height: speck };
  },
  tile_grid: () => grid(3, 3, 1.6, 127, 0.05, fbm(4, 3, 131)),
  mosaic: () => grid(14, 14, 1.3, 137, 0.2, fbm(4, 3, 139)),
  roof_tile() {
    const rows = 7, columns = 6;
    const random = rng(149);
    const tones = Array.from({ length: rows * columns }, () => 0.84 + random() * 0.16);
    const albedo = blank(1), height = blank(1);
    for (let y = 0; y < SIZE; y++) {
      const fy = (y / SIZE) * rows, r = Math.floor(fy), t = fy - r;
      for (let x = 0; x < SIZE; x++) {
        const shifted = ((x / SIZE) * columns + (r % 2 ? 0.5 : 0)) % columns;
        const c = Math.floor(shifted);
        const barrel = Math.sin((shifted - c) * Math.PI);
        const i = y * SIZE + x;
        // Each course overlaps the one below: darker at the top where it tucks under.
        const lap = Math.min(1, t * 6);
        albedo[i] = tones[r * columns + c] * (0.5 + 0.5 * lap) * (0.76 + 0.24 * barrel);
        height[i] = barrel * 0.7 + (1 - t) * 0.3;
      }
    }
    return { albedo, height };
  },
  shingle() {
    const n = fbm(30, 2, 151);
    const random = rng(157);
    const rows = 9, columns = 5;
    const tones = Array.from({ length: rows * columns }, () => 0.72 + random() * 0.28);
    const albedo = blank(1), height = blank(1);
    for (let y = 0; y < SIZE; y++) {
      const fy = (y / SIZE) * rows, r = Math.floor(fy), t = fy - r;
      for (let x = 0; x < SIZE; x++) {
        const shifted = ((x / SIZE) * columns + (r % 2 ? 0.5 : 0)) % columns;
        const c = Math.floor(shifted);
        const i = y * SIZE + x;
        const joint = shifted - c < 0.03;
        albedo[i] = joint ? 0.5 : tones[r * columns + c] * (t < 0.1 ? 0.62 : 1) * (0.92 + 0.08 * n[i]);
        height[i] = joint ? 0 : 1 - t * 0.6;
      }
    }
    return { albedo, height };
  },
  standing_seam() {
    const albedo = blank(1), height = blank(0.5);
    const ribs = 6;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.abs(((x / SIZE) * ribs) % 1);
        const i = y * SIZE + x;
        if (d < 0.05) { height[i] = 1; albedo[i] = 0.9; }
        else if (d < 0.08) albedo[i] = 0.72;
      }
    }
    return { albedo, height };
  },
  grass() {
    const n = fbm(70, 3, 163), coarse = fbm(5, 3, 167);
    return { albedo: n.map((v, i) => 0.72 + 0.28 * (v * 0.85 + coarse[i] * 0.15)), height: n.map((v) => v * 0.5) };
  },
  gravel() {
    const { edge, tone } = voronoi(420, 173);
    return { albedo: edge.map((e, i) => (e < 1.4 ? 0.5 : 0.72 + 0.28 * tone[i])), height: edge.map((e) => Math.min(1, e / 6)) };
  },
  pavers: () => grid(3, 3, 2.6, 179, 0.1, fbm(8, 3, 181)),
  cobble() {
    const n = fbm(10, 3, 191);
    return masonry(9, () => [1, 1, 1, 1, 1, 1], 193, 3, 0.26, 8, n);
  },
};

const mapsCache = new Map<TexturePattern, Maps | null>();

function mapsFor(pattern: TexturePattern): Maps | null {
  if (!mapsCache.has(pattern)) mapsCache.set(pattern, PATTERNS[pattern]?.() ?? null);
  return mapsCache.get(pattern) ?? null;
}

function canvasFrom(paint: (pixels: Uint8ClampedArray) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(SIZE, SIZE);
  paint(image.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const albedoCanvases = new Map<TexturePattern, HTMLCanvasElement>();

function albedoCanvas(pattern: TexturePattern, maps: Maps): HTMLCanvasElement {
  let canvas = albedoCanvases.get(pattern);
  if (!canvas) {
    canvas = canvasFrom((px) => {
      for (let i = 0; i < maps.albedo.length; i++) {
        const v = Math.round(Math.min(1, maps.albedo[i]) * 255);
        px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
        px[i * 4 + 3] = 255;
      }
    });
    albedoCanvases.set(pattern, canvas);
  }
  return canvas;
}

function normalCanvas(maps: Maps, strength: number): HTMLCanvasElement {
  const { height } = maps;
  return canvasFrom((px) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const left = height[y * SIZE + ((x + SIZE - 1) % SIZE)], right = height[y * SIZE + ((x + 1) % SIZE)];
        const up = height[((y + SIZE - 1) % SIZE) * SIZE + x], down = height[((y + 1) % SIZE) * SIZE + x];
        const dx = (left - right) * strength, dy = (down - up) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * SIZE + x) * 4;
        px[i] = ((dx / len) * 0.5 + 0.5) * 255;
        px[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        px[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        px[i + 3] = 255;
      }
    }
  });
}

type TextureSet = { map: CanvasTexture; normalMap: CanvasTexture };
const textureCache = new Map<string, TextureSet>();

/** Colour and normal maps for a pattern, tiled every `tile` world units. Materials of the same scale share them. */
export function texturesFor(pattern: TexturePattern, tile: number): TextureSet | null {
  const maps = mapsFor(pattern);
  if (!maps) return null;
  const key = `${pattern}|${tile.toFixed(3)}`;
  let set = textureCache.get(key);
  if (!set) {
    const map = new CanvasTexture(albedoCanvas(pattern, maps));
    map.colorSpace = SRGBColorSpace;
    const normalMap = new CanvasTexture(normalCanvas(maps, pattern === "plaster" || pattern === "concrete" ? 1.5 : 3));
    normalMap.colorSpace = NoColorSpace;
    for (const texture of [map, normalMap]) {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(1 / tile, 1 / tile);
      texture.anisotropy = 8;
    }
    set = { map, normalMap };
    textureCache.set(key, set);
  }
  return set;
}

/** Dark marble's veins are brighter than its body, so its map is dark and the tint is lifted to compensate. */
export function tintBoost(def: MaterialDef): number {
  return def.pattern === "marble_dark" ? 2.4 : 1;
}

const swatchCache = new Map<string, string>();

/** A small lit preview of a material, used for the library thumbnails. */
export function materialSwatch(materialId: string, color?: string, size = 96): string {
  const def = getMaterial(materialId);
  const tint = color ?? def.color;
  const key = `${materialId}|${tint}|${size}`;
  const hit = swatchCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  const maps = mapsFor(def.pattern);
  if (maps) {
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(albedoCanvas(def.pattern, maps), 0, 0, SIZE * 0.72, SIZE * 0.72, 0, 0, size, size);
  }
  ctx.globalCompositeOperation = "source-over";
  if (def.category === "glass") {
    const sheen = ctx.createLinearGradient(0, 0, size, size);
    sheen.addColorStop(0, "rgba(255,255,255,0.55)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0.08)");
    sheen.addColorStop(0.55, "rgba(255,255,255,0.32)");
    sheen.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);
  } else {
    const light = ctx.createLinearGradient(0, 0, size, size);
    light.addColorStop(0, `rgba(255,255,255,${0.04 + (1 - def.roughness) * 0.22})`);
    light.addColorStop(0.6, "rgba(255,255,255,0)");
    light.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, size, size);
  }
  const url = canvas.toDataURL("image/png");
  swatchCache.set(key, url);
  return url;
}
