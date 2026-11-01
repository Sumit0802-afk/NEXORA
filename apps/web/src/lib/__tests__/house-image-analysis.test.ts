import { describe, expect, it } from "vitest";
import { analyzeFacade, type PixelImage } from "../house-design/image-analysis";
import { designFromAnalysis, materialForTexture } from "../house-design/interpret";
import { getMaterial } from "../house-design/materials";

type Rgb = [number, number, number];

const W = 320, H = 220;

/** A tiny painter: everything is drawn in image coordinates onto sky and lawn. */
function canvas(sky: Rgb = [150, 195, 235], lawn: Rgb = [92, 140, 70]) {
  const data = new Uint8ClampedArray(W * H * 4);
  const set = (x: number, y: number, c: Rgb) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (Math.floor(y) * W + Math.floor(x)) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, y < 175 ? sky : lawn);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c);
  };
  return { data, set, rect };
}

type Paint = ReturnType<typeof canvas>;

function windows(p: Paint, x0: number, x1: number, y: number, h: number, count: number, width: number, glass: Rgb = [40, 48, 58], arch = false) {
  for (let i = 0; i < count; i++) {
    const cx = x0 + ((i + 0.5) * (x1 - x0)) / count;
    for (let py = y; py < y + h; py++) {
      for (let px = cx - width / 2; px < cx + width / 2; px++) {
        const topR = width / 2;
        const insideArch = !arch || py > y + topR || Math.hypot(px - cx, py - (y + topR)) <= topR;
        if (insideArch) p.set(px, py, glass);
      }
    }
  }
}

function image(p: Paint): PixelImage {
  return { width: W, height: H, data: p.data };
}

function gableHouse(wall: Rgb, roof: Rgb, options: { arch?: boolean } = {}): PixelImage {
  const p = canvas();
  p.rect(60, 90, 260, 180, wall);
  // A gable end facing the camera: wall-coloured triangle under a roof edge, slightly wider than the walls.
  for (let y = 30; y < 90; y++) {
    const half = ((y - 30) / 60) * 112;
    for (let x = 160 - half; x < 160 + half; x++) p.set(x, y, Math.abs(x - 160) > half - 11 ? roof : wall);
  }
  windows(p, 70, 250, 105, 42, 3, 34, undefined, options.arch);
  return image(p);
}

function flatHouse(wall: Rgb, glassWidth = 44): PixelImage {
  const p = canvas();
  p.rect(50, 50, 270, 180, wall);
  windows(p, 60, 260, 66, 40, 3, glassWidth);
  windows(p, 60, 260, 124, 40, 3, glassWidth);
  return image(p);
}

const channelDistance = (hex: string, rgb: Rgb) => {
  const n = parseInt(hex.slice(1), 16);
  return Math.max(Math.abs(((n >> 16) & 255) - rgb[0]), Math.abs(((n >> 8) & 255) - rgb[1]), Math.abs((n & 255) - rgb[2]));
};

describe("reading a house photo", () => {
  it("finds the building and leaves out sky and lawn", () => {
    const a = analyzeFacade(flatHouse([236, 232, 222]));
    expect(a.found).toBe(true);
    expect(a.box.x0).toBeGreaterThan(0.1);
    expect(a.box.x1).toBeLessThan(0.9);
    expect(a.skyShare).toBeGreaterThan(0.1);
    expect(a.greeneryShare).toBeGreaterThan(0.05);
  });

  it("reads the actual wall colour rather than a style default", () => {
    const pale: Rgb = [236, 232, 222], ochre: Rgb = [206, 164, 92];
    expect(channelDistance(analyzeFacade(flatHouse(pale)).wall.value.hex, pale)).toBeLessThan(10);
    expect(channelDistance(analyzeFacade(flatHouse(ochre)).wall.value.hex, ochre)).toBeLessThan(10);
  });

  it("does not lose a white house against a pale sky", () => {
    const p = canvas([214, 228, 240]);
    p.rect(50, 50, 270, 180, [244, 241, 232]);
    windows(p, 60, 260, 70, 40, 3, 40);
    const a = analyzeFacade(image(p));
    expect(a.found).toBe(true);
    expect(channelDistance(a.wall.value.hex, [244, 241, 232])).toBeLessThan(10);
  });

  it("tells a sunlit wall's true colour from its shaded side", () => {
    const p = canvas();
    p.rect(40, 60, 120, 180, [120, 116, 112]); // the shaded return of the wall, seen from a corner
    p.rect(120, 60, 280, 180, [232, 226, 212]); // the sunlit face
    const hex = analyzeFacade(image(p)).wall.value.hex;
    expect(channelDistance(hex, [232, 226, 212])).toBeLessThan(12);
  });

  it("tells a flat roof from a gable from the skyline", () => {
    expect(["flat", "cantilever"]).toContain(analyzeFacade(flatHouse([236, 232, 222])).roof.value.type);
    const gable = analyzeFacade(gableHouse([236, 232, 222], [120, 62, 44]));
    expect(gable.roof.value.type).toBe("gable");
    expect(gable.roof.value.pitch).toBeGreaterThan(20);
    expect(gable.roof.confidence).toBeGreaterThan(0.5);
  });

  it("tells a hip roof from a gable by the ridge plateau", () => {
    const p = canvas();
    p.rect(60, 100, 260, 180, [236, 232, 222]);
    for (let y = 50; y < 100; y++) {
      const half = 60 + ((y - 50) / 50) * 52;
      for (let x = 160 - half; x < 160 + half; x++) p.set(x, y, [70, 72, 78]);
    }
    expect(analyzeFacade(image(p)).roof.value.type).toBe("hip");
  });

  it("reads a roof colour from the roof, not the walls", () => {
    const clay: Rgb = [178, 88, 56];
    expect(channelDistance(analyzeFacade(gableHouse([236, 232, 222], clay)).roof.value.hex, clay)).toBeLessThan(14);
  });

  it("counts windows and estimates storeys from their rows", () => {
    const a = analyzeFacade(flatHouse([236, 232, 222]));
    expect(a.windows.value.count).toBe(6);
    expect(a.storeys.value).toBe(2);
    expect(a.windows.value.coverage).toBeGreaterThan(0.1);
  });

  it("measures more glass on a glassier facade", () => {
    const narrow = analyzeFacade(flatHouse([236, 232, 222], 24)).windows.value.coverage;
    const wide = analyzeFacade(flatHouse([236, 232, 222], 56)).windows.value.coverage;
    expect(wide).toBeGreaterThan(narrow * 1.6);
  });

  it("sees arched window heads", () => {
    expect(analyzeFacade(gableHouse([236, 232, 222], [120, 62, 44], { arch: true })).windows.value.shape).toBe("arched");
    expect(analyzeFacade(gableHouse([236, 232, 222], [120, 62, 44])).windows.value.shape).toBe("rectangular");
  });

  it("classifies a terracotta roof over warm arched stucco as Mediterranean", () => {
    const a = analyzeFacade(gableHouse([232, 214, 170], [180, 88, 54], { arch: true }));
    expect(a.style.value).toBe("mediterranean");
  });

  it("classifies a flat, glassy white box as modern or minimalist, not traditional", () => {
    expect(["modern", "minimalist"]).toContain(analyzeFacade(flatHouse([240, 238, 232], 56)).style.value);
  });

  it("gives the same answer for the same photo", () => {
    expect(analyzeFacade(flatHouse([236, 232, 222]))).toEqual(analyzeFacade(flatHouse([236, 232, 222])));
  });

  it("gives different answers for different photos", () => {
    const one = designFromAnalysis(analyzeFacade(flatHouse([240, 238, 232])), { levels: 2 }).design;
    const two = designFromAnalysis(analyzeFacade(gableHouse([232, 214, 170], [180, 88, 54], { arch: true })), { levels: 2 }).design;
    expect(one.exterior.wall.color).not.toBe(two.exterior.wall.color);
    expect(one.exterior.roof.type).not.toBe(two.exterior.roof.type);
    expect(one.exterior.window.shape).not.toBe(two.exterior.window.shape);
  });

  it("admits it when there is no house to read", () => {
    const p = canvas([150, 195, 235], [150, 195, 235]);
    const a = analyzeFacade(image(p));
    expect(a.found).toBe(false);
    expect(a.warnings.length).toBeGreaterThan(0);
    expect(a.wall.confidence).toBeLessThan(0.5);
  });

  it("gives a low confidence to what a blank facade cannot show", () => {
    const p = canvas();
    p.rect(60, 60, 260, 180, [230, 226, 216]);
    const a = analyzeFacade(image(p));
    expect(a.windows.value.count).toBe(0);
    expect(a.windows.confidence).toBeLessThan(0.5);
  });

  it("reads brick courses as a brick texture", () => {
    const p = canvas();
    const mortar: Rgb = [200, 190, 178], brick: Rgb = [158, 72, 52];
    p.rect(50, 50, 270, 180, mortar);
    for (let y = 50; y < 180; y += 6) {
      p.rect(50, y, 270, y + 4, brick);
      for (let x = 50 + (y % 12 ? 0 : 10); x < 270; x += 20) p.rect(x, y, x + 2, y + 4, mortar);
    }
    expect(analyzeFacade(image(p)).wall.value.texture).toBe("brick");
  });
});

describe("turning a reading into a design", () => {
  const reading = analyzeFacade(gableHouse([232, 214, 170], [180, 88, 54], { arch: true }));

  it("carries measured colours and forms onto the model", () => {
    const { design } = designFromAnalysis(reading, { levels: 2 });
    expect(design.exterior.wall.color).toBe(reading.wall.value.hex);
    expect(design.exterior.roof.type).toBe("gable");
    expect(design.exterior.roof.pitch).toBe(reading.roof.value.pitch);
    expect(design.exterior.window.shape).toBe("arched");
    expect(design.exterior.door.design).not.toBe(undefined);
  });

  it("uses a clay roof material for a clay-coloured roof", () => {
    expect(designFromAnalysis(reading, { levels: 2 }).design.exterior.roof.finish.materialId).toBe("roof_clay");
  });

  it("reports what it found, with confidence", () => {
    const summary = designFromAnalysis(reading, { levels: 2 }).reading;
    expect(summary.attributes.map((a) => a.id)).toEqual(expect.arrayContaining(["style", "wall", "roof", "windows", "door", "balcony"]));
    expect(summary.attributes.every((a) => a.confidence !== null && a.confidence >= 0 && a.confidence <= 1)).toBe(true);
    expect(summary.palette.length).toBeGreaterThan(1);
  });

  it("keeps the plan's floors when the photo shows a different number", () => {
    const flat = analyzeFacade(flatHouse([236, 232, 222]));
    const notes = designFromAnalysis(flat, { levels: 1 }).reading.notes.join(" ");
    expect(notes).toContain("your plan has 1");
    expect(notes).toContain("kept");
  });

  it("lets a deeper reading correct forms but never replaces measured colour", () => {
    const { design } = designFromAnalysis(reading, { levels: 2, deep: { roof: "hip", windowShape: "round", style: "luxury" } });
    expect(design.category).toBe("luxury");
    expect(design.exterior.roof.type).toBe("hip");
    expect(design.exterior.window.shape).toBe("round");
    expect(design.exterior.wall.color).toBe(reading.wall.value.hex);
  });

  it("maps textures to real library materials", () => {
    for (const texture of ["smooth", "concrete", "stucco", "brick", "siding", "timber", "stone"] as const) {
      for (const hex of ["#F2EFE8", "#8A6A4A", "#2A2A2E", "#B4593A"]) {
        expect(getMaterial(materialForTexture(texture, hex)).id).toBe(materialForTexture(texture, hex));
      }
    }
  });
});
