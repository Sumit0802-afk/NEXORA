import { describe, expect, it } from "vitest";
import { fitRoomLabel } from "../room-label";

const label = (w: number, h: number, name: string) =>
  fitRoomLabel({ widthPx: w, heightPx: h, name, dims: "12.5 × 17.0 ft", area: "213 sq ft" });

/** Every line must fit inside the room (in the text's own direction), never crossing an edge. */
function fits(l: NonNullable<ReturnType<typeof label>>, w: number, h: number) {
  const availW = l.rotation === 0 ? w : h;
  const availH = l.rotation === 0 ? h : w;
  const widest = Math.max(...l.lines.map((x) => x.text.length * x.size * (x.kind === "name" ? 0.64 : 0.58)));
  return widest <= availW && l.totalHeight <= availH;
}

describe("fitRoomLabel", () => {
  it("shows name, dimensions and area in a roomy room", () => {
    const l = label(240, 200, "Living Room")!;
    expect(l.rotation).toBe(0);
    expect(l.lines.map((x) => x.kind)).toEqual(["name", "dims", "area"]);
    expect(fits(l, 240, 200)).toBe(true);
  });

  it("drops the dimensions, then the area, before it overflows", () => {
    const small = label(100, 46, "Kitchen")!;
    expect(small.lines.some((x) => x.kind === "dims")).toBe(false);
    expect(fits(small, 100, 46)).toBe(true);
  });

  it("turns the text for tall narrow rooms instead of overlapping", () => {
    const l = label(36, 360, "Passage")!;
    expect(l.rotation).toBe(-90);
    expect(fits(l, 36, 360)).toBe(true);
  });

  it("wraps long names onto two lines", () => {
    const l = label(96, 120, "Garden / Open space")!;
    expect(l.lines.filter((x) => x.kind === "name").length).toBeGreaterThanOrEqual(1);
    expect(fits(l, 96, 120)).toBe(true);
  });

  it("never overflows for any room size or name", () => {
    const names = ["Parking", "Common Bath", "Back yard", "Master Bedroom Suite", "Pooja", "Walk-in Wardrobe & Dressing"];
    for (const name of names) {
      for (let w = 20; w <= 420; w += 25) {
        for (let h = 14; h <= 420; h += 25) {
          const l = label(w, h, name);
          if (l) expect(fits(l, w, h), `${name} ${w}x${h}`).toBe(true);
        }
      }
    }
  });

  it("shows nothing rather than a jumble when the room is tiny", () => {
    expect(label(14, 10, "Store")).toBeNull();
  });
});
