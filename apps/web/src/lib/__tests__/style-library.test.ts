import { describe, expect, it } from "vitest";
import { ARCHITECTURAL_DESIGNS } from "../architectural-layouts";
import { buildStylePlan, styleCatalog } from "../style-library";
import { validateDesign } from "../validation";

describe("style library", () => {
  const catalog = styleCatalog();

  it("only lists plans the engine builds without errors, and counts are real", () => {
    expect(catalog.length).toBeGreaterThan(100);
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
    for (const e of catalog) {
      const plan = buildStylePlan(e);
      expect(validateDesign(plan).filter((i) => i.severity === "error"), e.id).toEqual([]);
      expect(plan.levels.length).toBe(e.floors);
      expect(plan.plot.width).toBe(e.plot.width);
    }
  });

  it("covers every architectural style, including courtyard, L-shaped and U-shaped", () => {
    const covered = new Set(catalog.map((e) => e.designId));
    expect([...covered].sort()).toEqual(Object.keys(ARCHITECTURAL_DESIGNS).sort());
    const footprints = new Set(catalog.map((e) => e.footprint));
    for (const f of ["Courtyard Core", "L-Wing", "U-Pavilion"]) expect(footprints.has(f)).toBe(true);
  });

  it("is deterministic", () => {
    expect(styleCatalog().map((e) => e.id)).toEqual(catalog.map((e) => e.id));
  });
});
