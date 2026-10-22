"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoPlan } from "@/lib/demo-plan";
import { ApiError, getProject, saveDesign } from "@/lib/api";
import type { FloorPlan } from "@houseplan/design-schema";

type PlanContextValue = {
  projectId: string;
  isDemo: boolean;
  plan: FloorPlan | null;
  loadError: string | null;
  saving: boolean;
  status: string;
  setStatus: (status: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushPlan: (next: FloorPlan) => void;
  save: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/**
 * Owns the canonical FloorPlan + undo history for one project, at the
 * /studio/[projectId] layout level so the 2D editor and the 3D viewer read
 * the exact same live state. Without this, each route fetched and held its
 * own copy, so navigating 2D -> 3D silently dropped any unsaved edits and
 * the 3D view showed stale (or demo) data instead of what was on screen.
 */
export function PlanProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const isDemo = projectId === "demo";
  const [history, setHistory] = useState<FloorPlan[] | null>(isDemo ? [demoPlan] : null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(isDemo ? "Demo plan" : "Loading…");

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    getProject(projectId)
      .then((project) => {
        if (cancelled) return;
        setHistory([project.design]);
        setHistoryIndex(0);
        setStatus(`Loaded "${project.name}"`);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load this project.");
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, projectId]);

  const plan = history?.[historyIndex] ?? null;

  const pushPlan = useCallback(
    (next: FloorPlan) => {
      setHistory((prev) => [...(prev ?? []).slice(0, historyIndex + 1), next]);
      setHistoryIndex((i) => i + 1);
    },
    [historyIndex]
  );

  const canUndo = historyIndex > 0;
  const canRedo = (history?.length ?? 0) > historyIndex + 1;
  const undo = useCallback(() => {
    setHistoryIndex((i) => (i > 0 ? i - 1 : i));
    setStatus("Undid last change");
  }, []);
  const redo = useCallback(() => {
    setHistoryIndex((i) => i + 1);
    setStatus("Redid change");
  }, []);

  const save = useCallback(async () => {
    if (!plan) return;
    if (isDemo) {
      setStatus("Saved locally — this sandbox project isn't backed by the API");
      return;
    }
    setSaving(true);
    try {
      const result = await saveDesign(projectId, plan);
      setStatus(`Saved as version ${result.version}`);
    } catch (err) {
      setStatus(err instanceof ApiError ? `Save failed: ${err.message}` : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [plan, isDemo, projectId]);

  // Debounced autosave: skip the very first plan (the initial load/demo
  // seed) so we only autosave actual edits, not a load-triggered no-op.
  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (isDemo || !plan) return;
    if (!didInitialLoad.current) {
      didInitialLoad.current = true;
      return;
    }
    const timer = setTimeout(() => {
      save();
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isDemo]);

  const value = useMemo<PlanContextValue>(
    () => ({ projectId, isDemo, plan, loadError, saving, status, setStatus, canUndo, canRedo, undo, redo, pushPlan, save }),
    [projectId, isDemo, plan, loadError, saving, status, canUndo, canRedo, undo, redo, pushPlan, save]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlanContext(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlanContext must be used within a PlanProvider");
  return ctx;
}
