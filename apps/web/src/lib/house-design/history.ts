import type { HouseDesign } from "./schema";

/** Undo history for design edits, separate from the 2D plan's history so the two never undo each other. */

export type DesignHistory = {
  past: (HouseDesign | null)[];
  present: HouseDesign | null;
  future: (HouseDesign | null)[];
  /** The control behind the last entry, so one colour drag is one undo step and not hundreds. */
  group: string | null;
  at: number;
};

const LIMIT = 100;
const GROUP_WINDOW_MS = 900;

export function startHistory(present: HouseDesign | null): DesignHistory {
  return { past: [], present, future: [], group: null, at: 0 };
}

export function commit(history: DesignHistory, next: HouseDesign | null, group: string | null = null, now = Date.now()): DesignHistory {
  const continuing = group !== null && group === history.group && now - history.at < GROUP_WINDOW_MS;
  return {
    past: continuing ? history.past : [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: [],
    group,
    at: now,
  };
}

export function undo(history: DesignHistory): DesignHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    group: null,
    at: 0,
  };
}

export function redo(history: DesignHistory): DesignHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    group: null,
    at: 0,
  };
}
