/**
 * Fits a room's label (name, dimensions, area) inside the room's rectangle on the 2D plan.
 *
 * Canvas text does not clip or wrap on its own, so narrow rooms used to get overlapping, overflowing labels. This
 * picks the richest label that fits, shrinking the font and wrapping the name first, and for tall narrow rooms it
 * turns the text 90 degrees so it runs along the room.
 */
export type LabelLine = { text: string; size: number; kind: "name" | "dims" | "area" };

export type FittedLabel = {
  lines: LabelLine[];
  /** 0 = horizontal, -90 = text runs bottom-to-top along a tall narrow room. */
  rotation: 0 | -90;
  /** Width the text may use before it would cross the room's edge (in the text's own direction). */
  maxWidth: number;
  /** Combined height of all lines (in the text's own direction). */
  totalHeight: number;
};

const PAD = 5;
const NAME_SIZES = [13, 12, 11, 10, 9, 8];
// Detail lines never go below 9px: if they would be smaller, the label shows fewer lines at a bigger size instead.
const DETAIL_SIZES = [10, 9.5, 9];
export const LABEL_LINE_GAP = 2;
const LINE_GAP = LABEL_LINE_GAP;
// Average glyph width as a fraction of the font size for the UI font (bold is wider).
const CHAR_W = 0.58;
const CHAR_W_BOLD = 0.64;

const textWidth = (text: string, size: number, bold: boolean) => text.length * size * (bold ? CHAR_W_BOLD : CHAR_W);

/** Break a name onto at most two lines that each fit `width`; null if it cannot be done at this size. */
function wrapName(name: string, size: number, width: number): string[] | null {
  if (textWidth(name, size, true) <= width) return [name];
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: string[] | null = null;
  let bestWidest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const widest = Math.max(textWidth(a, size, true), textWidth(b, size, true));
    if (widest <= width && widest < bestWidest) {
      best = [a, b];
      bestWidest = widest;
    }
  }
  return best;
}

type Tier = "full" | "area" | "name";

function build(name: string, dims: string, area: string, tier: Tier, availW: number, availH: number): { lines: LabelLine[]; total: number } | null {
  for (const nameSize of NAME_SIZES) {
    const wrapped = wrapName(name, nameSize, availW);
    if (!wrapped) continue;
    const detailSize = Math.min(DETAIL_SIZES[0], nameSize - 2);
    const lines: LabelLine[] = wrapped.map((text) => ({ text, size: nameSize, kind: "name" as const }));
    const detail: { text: string; kind: "dims" | "area" }[] = [];
    if (tier === "full") detail.push({ text: dims, kind: "dims" }, { text: area, kind: "area" });
    else if (tier === "area") detail.push({ text: area, kind: "area" });
    // Every detail line must fit at some size that does not outgrow the name.
    let ok = true;
    for (const d of detail) {
      const size = DETAIL_SIZES.find((s) => s <= detailSize && textWidth(d.text, s, false) <= availW);
      if (!size) { ok = false; break; }
      lines.push({ text: d.text, size, kind: d.kind });
    }
    if (!ok) continue;
    const total = lines.reduce((h, l) => h + l.size * 1.15, 0) + LINE_GAP * (lines.length - 1);
    if (total <= availH) return { lines, total };
  }
  return null;
}

/** Last resort: a truncated name at the smallest size. Returns null when not even a few letters fit. */
function truncated(name: string, availW: number, availH: number): { lines: LabelLine[]; total: number } | null {
  const size = 8;
  if (size * 1.15 > availH) return null;
  const fit = Math.floor(availW / (size * CHAR_W_BOLD));
  if (fit < 3) return null;
  const text = name.length <= fit ? name : `${name.slice(0, Math.max(2, fit - 1)).trimEnd()}…`;
  return { lines: [{ text, size, kind: "name" }], total: size * 1.15 };
}

const SCORE: Record<Tier | "short", number> = { full: 4, area: 3, name: 2, short: 1 };

export function fitRoomLabel(args: { widthPx: number; heightPx: number; name: string; dims: string; area: string }): FittedLabel | null {
  const { widthPx, heightPx, name, dims, area } = args;
  const options: { rotation: 0 | -90; availW: number; availH: number }[] = [
    { rotation: 0, availW: widthPx - PAD * 2, availH: heightPx - PAD * 2 },
  ];
  // Tall, narrow rooms read better with the text turned to run along them.
  if (heightPx > widthPx * 1.5) options.push({ rotation: -90, availW: heightPx - PAD * 2, availH: widthPx - PAD * 2 });

  let best: { score: number; size: number; label: FittedLabel } | null = null;
  for (const opt of options) {
    if (opt.availW < 16 || opt.availH < 9) continue;
    const tries: { tier: Tier | "short"; res: { lines: LabelLine[]; total: number } | null }[] = [
      { tier: "full", res: build(name, dims, area, "full", opt.availW, opt.availH) },
      { tier: "area", res: build(name, dims, area, "area", opt.availW, opt.availH) },
      { tier: "name", res: build(name, dims, area, "name", opt.availW, opt.availH) },
      { tier: "short", res: truncated(name, opt.availW, opt.availH) },
    ];
    const hit = tries.find((t) => t.res);
    if (!hit?.res) continue;
    const size = hit.res.lines[0].size;
    const score = SCORE[hit.tier] * 100 + size - (opt.rotation === 0 ? 0 : 3); // prefer upright text on a tie
    if (!best || score > best.score) {
      best = { score, size, label: { lines: hit.res.lines, rotation: opt.rotation, maxWidth: opt.availW, totalHeight: hit.res.total } };
    }
  }
  return best ? best.label : null;
}
