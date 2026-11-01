"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getHouseDesign, saveHouseDesign } from "../api";
import { commit, redo as redoHistory, startHistory, undo as undoHistory, type DesignHistory } from "./history";
import {
  EMPTY_DOCUMENT,
  MAX_VARIATIONS,
  cloneDesign,
  normalizeDocument,
  type DesignVariation,
  type HouseDesign,
  type HouseDesignDocument,
  type ReadingSummary,
  type ReferenceImage,
} from "./schema";

type SaveState = "saved" | "dirty" | "saving" | "error";

type Value = {
  ready: boolean;
  loadError: string | null;
  design: HouseDesign | null;
  document: HouseDesignDocument;
  saveState: SaveState;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Change the design. `group` merges a run of edits from one control into a single undo step. */
  update: (next: HouseDesign | null, group?: string) => void;
  undo: () => void;
  redo: () => void;
  applyGenerated: (design: HouseDesign, reading: ReadingSummary, reference: ReferenceImage | null) => void;
  setReference: (reference: ReferenceImage | null) => void;
  saveNow: () => Promise<boolean>;
  addVariation: (name: string, thumbnail: string | null) => string | null;
  overwriteVariation: (id: string, thumbnail: string | null) => void;
  openVariation: (id: string) => void;
  renameVariation: (id: string, name: string) => void;
  duplicateVariation: (id: string) => void;
  deleteVariation: (id: string) => void;
};

const HouseDesignContext = createContext<Value | null>(null);

const localKey = (projectId: string) => `nexora:house-design:${projectId}`;

/**
 * Owns one project's house design at the studio layout level, so the design page and the 3D page show the same state.
 * It is stored apart from the floor plan: the plan's version history stays free of colour changes, and undo here
 * never touches a wall.
 */
export function HouseDesignProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const isDemo = projectId === "demo";
  const [doc, setDoc] = useState<HouseDesignDocument>(EMPTY_DOCUMENT);
  const [history, setHistoryState] = useState<DesignHistory>(() => startHistory(null));
  const historyRef = useRef(history);
  const setHistory = useCallback((next: DesignHistory) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const edited = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const finish = (loaded: HouseDesignDocument) => {
      if (cancelled) return;
      setDoc(loaded);
      setHistory(startHistory(loaded.design));
      setReady(true);
    };
    if (isDemo) {
      let saved: unknown = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(localKey(projectId)) ?? "null");
      } catch {
        saved = null;
      }
      finish(normalizeDocument(saved));
      return;
    }
    getHouseDesign(projectId)
      .then((stored) => finish(normalizeDocument(stored)))
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load this house design.");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, projectId, setHistory]);

  const persist = useCallback(
    async (current: HouseDesignDocument) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        if (isDemo) window.localStorage.setItem(localKey(projectId), JSON.stringify(current));
        else await saveHouseDesign(projectId, current);
        setSaveState("saved");
        return true;
      } catch (err) {
        setSaveState("error");
        if (err instanceof DOMException) setSaveError("This browser has run out of space for saved designs. Delete a variation and try again.");
        else setSaveError(err instanceof ApiError ? err.message : "Your design could not be saved.");
        return false;
      }
    },
    [isDemo, projectId]
  );

  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    if (!edited.current) return;
    setSaveState("dirty");
    const timer = setTimeout(() => void persist(docRef.current), 1400);
    return () => clearTimeout(timer);
  }, [doc, persist]);

  const change = useCallback((fn: (current: HouseDesignDocument) => HouseDesignDocument) => {
    edited.current = true;
    setDoc(fn);
  }, []);

  const update = useCallback<Value["update"]>(
    (next, group) => {
      setHistory(commit(historyRef.current, next, group ?? null));
      change((d) => ({ ...d, design: next }));
    },
    [change, setHistory]
  );

  const move = useCallback(
    (step: (h: DesignHistory) => DesignHistory) => {
      const moved = step(historyRef.current);
      if (moved === historyRef.current) return;
      setHistory(moved);
      change((d) => ({ ...d, design: moved.present }));
    },
    [change, setHistory]
  );
  const undo = useCallback(() => move(undoHistory), [move]);
  const redo = useCallback(() => move(redoHistory), [move]);

  const applyGenerated = useCallback<Value["applyGenerated"]>(
    (design, reading, reference) => {
      setHistory(commit(historyRef.current, design));
      change((d) => ({ ...d, design, generated: cloneDesign(design), reading, reference, activeVariationId: null }));
    },
    [change, setHistory]
  );

  const setReference = useCallback<Value["setReference"]>(
    (reference) => change((d) => ({ ...d, reference, reading: reference ? d.reading : null })),
    [change]
  );

  const saveNow = useCallback(() => persist(docRef.current), [persist]);

  const addVariation = useCallback<Value["addVariation"]>(
    (name, thumbnail) => {
      const current = docRef.current;
      if (!current.design || current.variations.length >= MAX_VARIATIONS) return null;
      const id = `var-${Date.now().toString(36)}`;
      const variation: DesignVariation = {
        id, name, thumbnail, updatedAt: new Date().toISOString(), design: cloneDesign(current.design), reference: current.reference, reading: current.reading,
      };
      change((d) => ({ ...d, variations: [variation, ...d.variations], activeVariationId: id }));
      return id;
    },
    [change]
  );

  const overwriteVariation = useCallback<Value["overwriteVariation"]>(
    (id, thumbnail) =>
      change((d) => ({
        ...d,
        variations: d.variations.map((v) =>
          v.id === id && d.design
            ? { ...v, thumbnail: thumbnail ?? v.thumbnail, updatedAt: new Date().toISOString(), design: cloneDesign(d.design), reference: d.reference, reading: d.reading }
            : v
        ),
      })),
    [change]
  );

  const openVariation = useCallback<Value["openVariation"]>(
    (id) => {
      const variation = docRef.current.variations.find((v) => v.id === id);
      if (!variation) return;
      const design = cloneDesign(variation.design);
      setHistory(commit(historyRef.current, design));
      change((d) => ({ ...d, design, reference: variation.reference, reading: variation.reading, activeVariationId: id }));
    },
    [change, setHistory]
  );

  const renameVariation = useCallback<Value["renameVariation"]>(
    (id, name) => change((d) => ({ ...d, variations: d.variations.map((v) => (v.id === id ? { ...v, name } : v)) })),
    [change]
  );

  const duplicateVariation = useCallback<Value["duplicateVariation"]>(
    (id) =>
      change((d) => {
        const source = d.variations.find((v) => v.id === id);
        if (!source || d.variations.length >= MAX_VARIATIONS) return d;
        const copy: DesignVariation = { ...source, id: `var-${Date.now().toString(36)}`, name: `${source.name} copy`, updatedAt: new Date().toISOString() };
        return { ...d, variations: [copy, ...d.variations] };
      }),
    [change]
  );

  const deleteVariation = useCallback<Value["deleteVariation"]>(
    (id) =>
      change((d) => ({ ...d, variations: d.variations.filter((v) => v.id !== id), activeVariationId: d.activeVariationId === id ? null : d.activeVariationId })),
    [change]
  );

  const value = useMemo<Value>(
    () => ({
      ready, loadError, design: doc.design, document: doc, saveState, saveError,
      canUndo: history.past.length > 0, canRedo: history.future.length > 0,
      update, undo, redo, applyGenerated, setReference, saveNow,
      addVariation, overwriteVariation, openVariation, renameVariation, duplicateVariation, deleteVariation,
    }),
    [ready, loadError, doc, saveState, saveError, history, update, undo, redo, applyGenerated, setReference, saveNow, addVariation, overwriteVariation, openVariation, renameVariation, duplicateVariation, deleteVariation]
  );

  return <HouseDesignContext.Provider value={value}>{children}</HouseDesignContext.Provider>;
}

export function useHouseDesign(): Value {
  const ctx = useContext(HouseDesignContext);
  if (!ctx) throw new Error("useHouseDesign must be used within a HouseDesignProvider");
  return ctx;
}
