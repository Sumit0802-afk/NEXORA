import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("dark theme stylesheet", () => {
  const dark = readFileSync(path.join(SRC, "app/theme-dark.css"), "utf8");

  it("defines a dark value for every inline colour variable used in components (run `npm run theme:build` if this fails)", () => {
    const used = new Set<string>();
    for (const file of tsxFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/var\(--c-([0-9A-Fa-f]{6}),/g)) used.add(m[1].toUpperCase());
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((hex) => !dark.includes(`--c-${hex}:`));
    expect(missing).toEqual([]);
  });

  it("only affects the dark theme and keeps the base colour scheme", () => {
    expect(dark).toContain('html[data-theme="dark"] { color-scheme: dark; }');
    const stray = dark.split("\n").filter((l) => /^[.#a-z]/i.test(l) && l.includes("{") && !l.startsWith("html[data-theme"));
    expect(stray).toEqual([]);
  });
});
