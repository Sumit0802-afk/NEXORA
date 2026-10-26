import { describe, expect, it } from "vitest";
import { checkPhotoFile, checkPhotoSize, MAX_PHOTO_BYTES, sniffImage } from "../photo-upload";
import { matchesStairSide, stairSides } from "../stair-position";
import type { FloorPlan } from "@houseplan/design-schema";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("photo validation", () => {
  it("recognises real image formats by their bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImage(webp)).toBe("webp");
  });

  it("rejects look-alike files, whatever they are named", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    const exe = bytes(0x4d, 0x5a);
    const gif = new TextEncoder().encode("GIF89a");
    for (const head of [svg, html, exe, gif, new Uint8Array(0)]) {
      expect(checkPhotoFile({ size: 1000 }, head).ok).toBe(false);
    }
  });

  it("enforces the size limits", () => {
    const jpeg = bytes(0xff, 0xd8, 0xff);
    expect(checkPhotoFile({ size: 0 }, jpeg).ok).toBe(false);
    expect(checkPhotoFile({ size: MAX_PHOTO_BYTES + 1 }, jpeg).ok).toBe(false);
    expect(checkPhotoFile({ size: 2_000_000 }, jpeg)).toEqual({ ok: true, kind: "jpeg" });
    expect(checkPhotoSize(200, 800).ok).toBe(false);
    expect(checkPhotoSize(1600, 1200).ok).toBe(true);
    expect(checkPhotoSize(20000, 900).ok).toBe(false);
  });
});

function planWithStair(x0: number, y0: number, x1: number, y1: number): FloorPlan {
  return {
    schemaVersion: 1, projectId: "t", units: "ft", plot: { width: 30, length: 40, floors: 2, shape: "rectangle" },
    levels: [{ id: "ground", elevation: 0, wallHeight: 10, rooms: [{ id: "s", type: "staircase", name: "Staircase", polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }], walls: [], openings: [], furniture: [] }],
    metadata: { version: 1, status: "draft" },
  };
}

describe("staircase position", () => {
  it("names the side and end of the plot", () => {
    expect(stairSides(planWithStair(20, 0, 30, 8))).toEqual(["right", "front"]);
    expect(stairSides(planWithStair(0, 30, 8, 40))).toEqual(["left", "back"]);
    expect(stairSides(planWithStair(11, 15, 19, 25))).toEqual(["centre"]);
  });
  it("matches a preference", () => {
    const p = planWithStair(20, 0, 30, 8);
    expect(matchesStairSide(p, "any")).toBe(true);
    expect(matchesStairSide(p, "right")).toBe(true);
    expect(matchesStairSide(p, "left")).toBe(false);
  });
});
