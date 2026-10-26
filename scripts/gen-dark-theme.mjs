// Generates apps/web/src/app/theme-dark.css from globals.css.
//
// Every rule in globals.css that sets a colour gets a counterpart under html[data-theme="dark"] with those colours
// re-mapped for a dark background (hue kept, lightness inverted; saturated accents are lifted rather than inverted).
// Run `npm run theme:build` after changing colours in globals.css.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "apps/web/src/app/globals.css");
const OUT = path.join(root, "apps/web/src/app/theme-dark.css");
const DARK = 'html[data-theme="dark"]';

// ── colour maths ─────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Dark-theme equivalent of one colour. */
function mapColor([r, g, b]) {
  const [h, s, l] = rgbToHsl(r, g, b);
  let l2, s2 = s;
  if (s > 0.3 && l >= 0.35 && l <= 0.7) {
    // Mid-tone accents (violet, amber, red): lift so they read on dark surfaces.
    l2 = 0.64 + (l - 0.35) * 0.15;
  } else if (l >= 0.75) {
    // Light surfaces become deep dark surfaces. Near-white neutrals take the brand blueberry hue so the dark theme
    // is tinted consistently rather than inheriting whatever faint cast the light colour had.
    l2 = 0.08 + 0.84 * (1 - l);
    if (Math.max(r, g, b) - Math.min(r, g, b) <= 14) return hslToRgb(248 / 360, 0.24, l2).map(Math.round);
    s2 = s * 0.7;
  } else {
    // Text and mid-greys become light text; muted greys stay clearly readable on dark.
    l2 = 0.55 + 0.4 * ((0.75 - l) / 0.75);
    s2 = s * 0.85;
  }
  const [R, G, B] = hslToRgb(h, clamp(s2), clamp(l2));
  return [Math.round(R), Math.round(G), Math.round(B)];
}

const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };

const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[^)]*\)|\bwhite\b|\bblack\b/g;

function parseColor(tok) {
  const t = tok.trim().toLowerCase();
  if (NAMED[t]) return { rgb: NAMED[t], a: 1 };
  if (t.startsWith("#")) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { rgb: [n(0), n(2), n(4)], a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = t.match(/rgba?\(\s*([^)]*)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (x) => (x.endsWith("%") ? (parseFloat(x) / 100) * 255 : parseFloat(x));
  const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  const rgb = parts.slice(0, 3).map(num);
  if (rgb.some(Number.isNaN)) return null;
  return { rgb, a };
}

const fmt = ({ rgb, a }) =>
  a >= 0.999 ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${+a.toFixed(3)})`;

function mapValue(prop, value) {
  const isShadow = /shadow|^filter$|^-webkit-filter$|^backdrop-filter$/.test(prop);
  return value.replace(COLOR_RE, (tok) => {
    const c = parseColor(tok);
    if (!c) return tok;
    const [, , l] = rgbToHsl(...c.rgb);
    if (isShadow && c.a < 0.95 && l < 0.5) {
      // Soft dark shadows: on a dark surface they must stay black, not turn into pale glows.
      return fmt({ rgb: [0, 0, 0], a: Math.min(1, c.a * 2) });
    }
    return fmt({ rgb: mapColor(c.rgb), a: c.a });
  });
}

// ── tolerant CSS reader ──────────────────────────────────────────────────────
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Split `a;b;c` at top level (ignoring `;` inside parentheses and quotes, e.g. data: URLs). */
function splitDeclarations(body) {
  const out = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Parse a block list into [{prelude, body}] respecting nested braces. */
function parseBlocks(css) {
  const blocks = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1, j = open + 1, quote = null;
    while (j < css.length && depth > 0) {
      const ch = css[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      j++;
    }
    blocks.push({ prelude, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return blocks;
}

function darkSelector(sel) {
  const s = sel.trim();
  if (!s) return null;
  if (s.startsWith(":root")) return DARK + s.slice(5);
  if (/^html\b/.test(s)) return DARK + s.slice(4);
  if (/^body\b/.test(s)) return `${DARK} ${s}`;
  return `${DARK} ${s}`;
}

// Surfaces that are dark in both themes (sidebar, login brand panel). Their rules are left alone and the shared
// colour variables are restored inside them, so they look the same as in light mode.
const KEEP = /^\s*\.(app-rail|rail-|auth-brand|auth-wave|auth-photo|auth-wordmark|auth-points|auth-welcome|auth-bg|blob)/;

const SKIP_PROPS = /^(content|src|font|font-family|animation|animation-name|grid-template-areas|--font)/;

const COLOR_PROPS = /^(color|background(-color|-image)?|border(-top|-right|-bottom|-left)?(-color)?|outline(-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color)$/;
const VAR_RE = /var\(\s*--(navy|violet|canvas|ink|muted|line|surface|soft-lilac|background)\s*[,)]/;

/**
 * Colour declarations copied through unchanged (values that use the theme variables, or any colour in a surface that
 * keeps its light-theme look). They still have to be emitted: a dark rule for a less specific selector would
 * otherwise outrank this rule's original declaration.
 */
function keptDecls(body, literalsToo) {
  const out = [];
  for (const raw of splitDeclarations(body)) {
    const idx = raw.indexOf(":");
    if (idx === -1) continue;
    const prop = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (!COLOR_PROPS.test(prop)) continue;
    COLOR_RE.lastIndex = 0;
    const hasLiteral = COLOR_RE.test(value);
    COLOR_RE.lastIndex = 0;
    if (VAR_RE.test(value) || (literalsToo && hasLiteral)) out.push(`${prop}: ${value.replace(/;$/, "")};`);
  }
  return out;
}

function colourDecls(body) {
  const out = [];
  for (const raw of splitDeclarations(body)) {
    const idx = raw.indexOf(":");
    if (idx === -1) continue;
    const prop = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (!prop || SKIP_PROPS.test(prop) || /url\(/i.test(value)) continue;
    COLOR_RE.lastIndex = 0;
    if (!COLOR_RE.test(value)) continue;
    COLOR_RE.lastIndex = 0;
    const mapped = mapValue(prop, value.replace(/\s*!important\s*$/i, ""));
    if (mapped === value) continue;
    out.push(`${prop}: ${mapped}${/!important/i.test(value) ? " !important" : ""};`);
  }
  return out;
}

/** True when the rule paints an opaque dark background: such a surface already suits a dark theme. */
function hasDarkOpaqueBackground(body) {
  for (const raw of splitDeclarations(body)) {
    const idx = raw.indexOf(":");
    if (idx === -1) continue;
    const prop = raw.slice(0, idx).trim();
    if (!/^background(-color|-image)?$/.test(prop)) continue;
    const value = raw.slice(idx + 1);
    COLOR_RE.lastIndex = 0;
    const m = COLOR_RE.exec(value);
    if (!m) continue;
    const c = parseColor(m[0]);
    if (c && c.a > 0.6 && rgbToHsl(...c.rgb)[2] < 0.3) return true;
  }
  return false;
}

function convert(css) {
  const out = [];
  for (const { prelude, body } of parseBlocks(css)) {
    if (/^@(keyframes|-webkit-keyframes|font-face|import|charset|page)/i.test(prelude)) continue;
    if (/^@(media|supports|layer)/i.test(prelude)) {
      const inner = convert(body);
      if (inner.length) out.push(`${prelude} {\n${inner.map((l) => "  " + l.split("\n").join("\n  ")).join("\n")}\n}`);
      continue;
    }
    if (prelude.startsWith("@")) continue;
    const keepSurface = !prelude.startsWith(":root") &&
      (prelude.split(",").every((sel) => KEEP.test(sel)) || hasDarkOpaqueBackground(body));
    const decls = keepSurface ? keptDecls(body, true) : [...colourDecls(body), ...keptDecls(body, false)];
    if (!decls.length) continue;
    const selectors = prelude.split(",").map(darkSelector).filter(Boolean);
    if (!selectors.length) continue;
    out.push(`${selectors.join(",\n")} {\n  ${decls.join("\n  ")}\n}`);
  }
  return out;
}

const css = stripComments(readFileSync(SRC, "utf8")).replace(/@(import|charset)[^\n]*\n/g, "");
const rules = convert(css);
// Inside the always-dark surfaces, restore the light-theme values of the shared colour variables.
const rootBlock = parseBlocks(css).find((b) => b.prelude === ":root");
const keepVars = rootBlock
  ? splitDeclarations(rootBlock.body).map((d) => d.trim()).filter((d) => /^--(navy|violet|canvas|ink|muted|line|surface|soft-lilac|background)\s*:/.test(d))
  : [];
if (keepVars.length) {
  const scopes = [".app-rail", ".auth-brand", ".auth-bg"].map((s) => `${DARK} ${s}`).join(",\n");
  const vars = keepVars.map((d) => `${d};`).join("\n  ");
  rules.push(`${scopes} {\n  ${vars}\n}`);
}

// Inline `style={{ ... }}` colours in components are written as var(--c-RRGGBB, #RRGGBB): identical in light mode, and
// here each one gets its dark value.
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx$/.test(name)) files.push(full);
  }
  return files;
}
const inlineColours = new Set();
for (const file of walk(path.join(root, "apps/web/src"))) {
  for (const m of readFileSync(file, "utf8").matchAll(/--c-([0-9A-Fa-f]{6})/g)) inlineColours.add(m[1].toUpperCase());
}
if (inlineColours.size) {
  const lines = [...inlineColours].sort().map((hex) => {
    const c = parseColor("#" + hex);
    return `--c-${hex}: ${fmt({ rgb: mapColor(c.rgb), a: 1 })};`;
  });
  rules.push(`${DARK} {\n  ${lines.join("\n  ")}\n}`);
}

const header = `/* GENERATED by scripts/gen-dark-theme.mjs from globals.css. Do not edit by hand; run \`npm run theme:build\`. */
${DARK} { color-scheme: dark; }
`;
writeFileSync(OUT, header + rules.join("\n") + "\n");
console.log(`[theme] wrote ${path.relative(root, OUT)}: ${rules.length} rules`);
