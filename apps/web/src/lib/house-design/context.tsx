"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getHouseDesign, saveHouseDesign } from "../api";
import { commit, redo as redoHistory, startHistory, undo as undoHistory, type DesignHistory } from "./history";
import {
  EMPTY_DOCUMENT,
  MAX_REVISIONS,
  MAX_VARIATIONS,
  cloneDesign,
  normalizeDocument,
  pruneImages,
  type BaseRecord,
  type DesignParameters,
  type DesignRevision,
  type DesignVariation,
  type Elevation,
  type GalleryState,
  type HouseDesign,
  type HouseDesignDocument,
  type ReadingSummary,
  type ReferenceImage,
  type ReferenceSlot,
} from "./schema";

type SaveState = "saved" | "dirty" | "saving" | "error";

export type GeneratedResult = { design: HouseDesign; reading: ReadingSummary; parameters: DesignParameters };

/** A generation in progress. It lives here, so it carries on while the user moves between panels and pages. */
export type GenerationJob = { stage: string | null; error: string | null };

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
  job: GenerationJob;
  /** Runs a generation. `run` reports each stage and resolves to the result to apply. */
  runGeneration: (run: (onStage: (stage: string) => void) => Promise<GeneratedResult>, base: (design: HouseDesign) => BaseRecord) => Promise<boolean>;
  placeReference: (elevation: Elevation, image: ReferenceImage) => void;
  removeReference: (elevation: Elevation) => void;
  applyGallery: (result: GeneratedResult, image: ReferenceImage, base: BaseRecord | null) => void;
  saveNow: () => Promise<boolean>;
  /** Selection, favorites and recently viewed. Not part of undo, since no design changes. */
  updateGallery: (fn: (gallery: GalleryState) => GalleryState) => void;
  addVariation: (name: string, thumbnail: string | null, planFingerprint: string | null) => string | null;
  overwriteVariation: (id: string, thumbnail: string | null, planFingerprint: string | null) => void;
  openVariation: (id: string) => void;
  renameVariation: (id: string, name: string) => void;
  duplicateVariation: (id: string) => void;
  deleteVariation: (id: string) => void;
  restoreRevision: (id: string) => void;
  /** Replaces the whole document from a saved project file. The current design stays restorable. */
  restoreDocument: (saved: unknown) => void;
};

const HouseDesignContext = createContext<Value | null>(null);

const localKey = (projectId: string) => `nexora:house-design:${projectId}`;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function withRevision(doc: HouseDesignDocument, label: string): HouseDesignDocument {
  if (!doc.design) return doc;
  const revision: DesignRevision = { id: uid("rev"), at: new Date().toISOString(), label, design: cloneDesign(doc.design) };
  return { ...doc, revisions: [revision, ...doc.revisions].slice(0, MAX_REVISIONS) };
}

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
  const [job, setJob] = useState<GenerationJob>({ stage: null, error: null });
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
        const payload = pruneImages(current);
        if (isDemo) window.localStorage.setItem(localKey(projectId), JSON.stringify(payload));
        else await saveHouseDesign(projectId, payload);
        setSaveState("saved");
        return true;
      } catch (err) {
        setSaveState("error");
        if (err instanceof DOMException) setSaveError("This browser has run out of space for saved designs. Remove a reference image or delete a variation, then try again.");
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

  const applyResult = useCallback(
    (result: GeneratedResult, base: BaseRecord | null, doc: (d: HouseDesignDocument) => Partial<HouseDesignDocument> = () => ({})) => {
      setHistory(commit(historyRef.current, result.design));
      change((d) => ({
        ...withRevision(d, "Before a new design was generated"),
        design: result.design, generated: cloneDesign(result.design), reading: result.reading, parameters: result.parameters, base: base ?? d.base, activeVariationId: null,
        ...doc(d),
      }));
    },
    [change, setHistory]
  );

  const running = useRef(false);
  const runGeneration = useCallback<Value["runGeneration"]>(
    async (run, base) => {
      if (running.current) return false;
      running.current = true;
      setJob({ stage: "preparing", error: null });
      try {
        const result = await run((stage) => setJob({ stage, error: null }));
        applyResult(result, base(result.design));
        setJob({ stage: null, error: null });
        return true;
      } catch (err) {
        setJob({ stage: null, error: err instanceof Error ? err.message : "The design could not be generated. Try another image." });
        return false;
      } finally {
        running.current = false;
      }
    },
    [applyResult]
  );

  const placeReference = useCallback<Value["placeReference"]>(
    (elevation, image) =>
      change((d) => ({
        ...d,
        images: { ...d.images, [image.id]: image },
        references: [...d.references.filter((r) => r.elevation !== elevation), { elevation, imageId: image.id }],
      })),
    [change]
  );

  const removeReference = useCallback<Value["removeReference"]>(
    (elevation) =>
      change((d) => {
        const references = d.references.filter((r) => r.elevation !== elevation);
        return { ...d, references, reading: references.length ? d.reading : null, parameters: references.length ? d.parameters : null };
      }),
    [change]
  );

  const applyGallery = useCallback<Value["applyGallery"]>(
    (result, image, base) => {
      const slot: ReferenceSlot = { elevation: "front", imageId: image.id };
      applyResult(result, base, (d) => ({ images: { ...d.images, [image.id]: image }, references: [...d.references.filter((r) => r.elevation !== "front"), slot] }));
    },
    [applyResult]
  );

  const saveNow = useCallback(() => persist(docRef.current), [persist]);
  const updateGallery = useCallback<Value["updateGallery"]>((fn) => change((d) => ({ ...d, gallery: fn(d.gallery) })), [change]);

  const snapshot = (d: HouseDesignDocument) => ({ design: cloneDesign(d.design!), references: d.references, reading: d.reading, parameters: d.parameters });

  const addVariation = useCallback<Value["addVariation"]>(
    (name, thumbnail, planFingerprint) => {
      const current = docRef.current;
      if (!current.design || current.variations.length >= MAX_VARIATIONS) return null;
      const id = uid("var");
      const variation: DesignVariation = { id, name, thumbnail, planFingerprint, updatedAt: new Date().toISOString(), ...snapshot(current) };
      change((d) => ({ ...d, variations: [variation, ...d.variations], activeVariationId: id }));
      return id;
    },
    [change]
  );

  const overwriteVariation = useCallback<Value["overwriteVariation"]>(
    (id, thumbnail, planFingerprint) =>
      change((d) => {
        const target = d.variations.find((v) => v.id === id);
        if (!target || !d.design) return d;
        const kept: DesignRevision = { id: uid("rev"), at: target.updatedAt, label: `${target.name} before it was updated`, design: target.design };
        return {
          ...d,
          revisions: [kept, ...d.revisions].slice(0, MAX_REVISIONS),
          variations: d.variations.map((v) => (v.id === id ? { ...v, thumbnail: thumbnail ?? v.thumbnail, planFingerprint, updatedAt: new Date().toISOString(), ...snapshot(d) } : v)),
        };
      }),
    [change]
  );

  const openVariation = useCallback<Value["openVariation"]>(
    (id) => {
      const variation = docRef.current.variations.find((v) => v.id === id);
      if (!variation) return;
      const design = cloneDesign(variation.design);
      setHistory(commit(historyRef.current, design));
      change((d) => ({
        ...withRevision(d, `Before switching to ${variation.name}`),
        design, references: variation.references, reading: variation.reading, parameters: variation.parameters, activeVariationId: id,
      }));
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
        const copy: DesignVariation = { ...source, id: uid("var"), name: `${source.name} copy`, updatedAt: new Date().toISOString(), design: cloneDesign(source.design) };
        return { ...d, variations: [copy, ...d.variations] };
      }),
    [change]
  );

  const deleteVariation = useCallback<Value["deleteVariation"]>(
    (id) =>
      change((d) => ({ ...d, variations: d.variations.filter((v) => v.id !== id), activeVariationId: d.activeVariationId === id ? null : d.activeVariationId })),
    [change]
  );

  const restoreRevision = useCallback<Value["restoreRevision"]>(
    (id) => {
      const revision = docRef.current.revisions.find((r) => r.id === id);
      if (!revision?.design) return;
      const design = cloneDesign(revision.design);
      setHistory(commit(historyRef.current, design));
      change((d) => ({ ...withRevision(d, "Before restoring an earlier design"), design, activeVariationId: null }));
    },
    [change, setHistory]
  );

  const restoreDocument = useCallback<Value["restoreDocument"]>(
    (saved) => {
      const restored = normalizeDocument(saved);
      setHistory(commit(historyRef.current, restored.design));
      change((d) => ({ ...restored, revisions: withRevision(d, "Before a project file was restored").revisions }));
    },
    [change, setHistory]
  );

  const value = useMemo<Value>(
    () => ({
      ready, loadError, design: doc.design, document: doc, saveState, saveError,
      canUndo: history.past.length > 0, canRedo: history.future.length > 0,
      update, undo, redo, job, runGeneration, placeReference, removeReference, applyGallery, saveNow, updateGallery,
      addVariation, overwriteVariation, openVariation, renameVariation, duplicateVariation, deleteVariation, restoreRevision, restoreDocument,
    }),
    [ready, loadError, doc, saveState, saveError, history, update, undo, redo, job, runGeneration, placeReference, removeReference, applyGallery, saveNow, updateGallery, addVariation, overwriteVariation, openVariation, renameVariation, duplicateVariation, deleteVariation, restoreRevision, restoreDocument]
  );

  return <HouseDesignContext.Provider value={value}>{children}</HouseDesignContext.Provider>;
}

export function useHouseDesign(): Value {
  const ctx = useContext(HouseDesignContext);
  if (!ctx) throw new Error("useHouseDesign must be used within a HouseDesignProvider");
  return ctx;
}
