"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Grid3x3,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Orbit,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  SquareDashed,
  Tag,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Armchair,
  Bath,
  BedDouble,
  Car,
  Home,
  Utensils,
  Footprints,
  Paintbrush,
  SunMedium,
  Download,
} from "lucide-react";
import { HouseScene, type HouseSceneHandle, type SceneView, ARCH_STYLES, type ArchStyleId } from "@/components/viewer/HouseScene";
import { WalkthroughHUD } from "@/components/viewer/WalkthroughHUD";
import { DesignWizardModal } from "@/components/plan/DesignWizardModal";
import { InteriorDesignerModal } from "@/components/interior/InteriorDesignerModal";
import { TerraceDesignerModal } from "@/components/exterior/TerraceDesignerModal";
import { ArchitecturalAnalysisModal } from "@/components/analysis/ArchitecturalAnalysisModal";
import { ExportModal } from "@/components/export/ExportModal";
import { DEFAULT_TERRACE_CONFIG, DEFAULT_EXTERIOR_CONFIG, type TerraceConfig, type ExteriorConfig } from "@/lib/terrace-catalog";
import { createProject, saveDesign } from "@/lib/api";
import { buildSceneGeometry } from "@/lib/scene-geometry";
import { usePlanContext } from "../plan-context";
import { floorName } from "@/lib/floors";
import { useRouter } from "next/navigation";
import type { FloorPlan } from "@houseplan/design-schema";

/* ── Room type metadata ─────────────────────────────────────── */
function getRoomMeta(type: string) {
  switch (type) {
    case "living_room":  return { label: "Living Room",   icon: Armchair, color: "#D7B58A" };
    case "dining_room":  return { label: "Dining Room",   icon: Utensils, color: "#CBA477" };
    case "bedroom":      return { label: "Bedroom",       icon: BedDouble, color: "#D3AF86" };
    case "study":        return { label: "Study / Office",icon: Home,     color: "#BE9C75" };
    case "kitchen":      return { label: "Kitchen",       icon: Utensils, color: "#D7DCE0" };
    case "bathroom":     return { label: "Bathroom",      icon: Bath,     color: "#DAE5ED" };
    case "parking":      return { label: "Parking",       icon: Car,      color: "#A8A59E" };
    default:             return { label: "Space",          icon: Home,     color: "#C6BBAA" };
  }
}

/* ── ID helpers ─────────────────────────────────────────────── */
function genId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
}

/* ════════════════════════════════════════════════════════════
   3D PREVIEW PAGE
   ════════════════════════════════════════════════════════════ */
export default function Preview3DPage({ params }: { params: { projectId: string } }) {
  const { plan, loadError, isDemo, projectName, pushPlan } = usePlanContext();

  // ── 3D viewport state ──
  const [view, setView]           = useState<SceneView>("perspective");
  const [showGrid, setShowGrid]   = useState(true);
  const [showRoof, setShowRoof]   = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [topLevel, setTopLevel]   = useState<number | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // ── Floor visibility (hide without deleting) ──
  const [hiddenFloors, setHiddenFloors] = useState<Set<number>>(new Set());

  // ── Architectural style ──
  const [styleTheme, setStyleTheme] = useState<ArchStyleId>("modern");
  const [styleTab, setStyleTab]     = useState<"floors" | "style">("floors");

  // ── UI state ──
  const [showFloorMenu, setShowFloorMenu] = useState(false);
  const [showGestureGuide, setShowGestureGuide] = useState(true);
  const [toast, setToast]           = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── 3D Walkthrough state ──
  const [walkthrough, setWalkthrough]       = useState(false);
  const [isFirstPerson, setIsFirstPerson]   = useState(false);
  const [walkRoomName, setWalkRoomName]     = useState("");
  const [walkFloorLevel, setWalkFloorLevel] = useState(0);
  const [walkTargetRoomId, setWalkTargetRoomId] = useState<string | null>(null);
  const [walkTargetFloor, setWalkTargetFloor]   = useState<number | null>(null);
  const [mobileWalkInputs, setMobileWalkInputs] = useState<{
    joystickX: number;
    joystickY: number;
    touchLookX: number;
    touchLookY: number;
  }>({ joystickX: 0, joystickY: 0, touchLookX: 0, touchLookY: 0 });

  // ── Architectural design wizard state ──
  const router = useRouter();
  const [showDesignWizard, setShowDesignWizard] = useState(false);
  const [showInteriorModal, setShowInteriorModal] = useState(false);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [showFurniture, setShowFurniture] = useState(true);
  const originalPlanRef = useRef<FloorPlan | null>(null);

  // ── Terrace & Exterior Designer state ──
  const [showTerraceModal, setShowTerraceModal] = useState(false);
  const [terraceConfig, setTerraceConfig] = useState<TerraceConfig>(DEFAULT_TERRACE_CONFIG);
  const [exteriorConfig, setExteriorConfig] = useState<ExteriorConfig>(DEFAULT_EXTERIOR_CONFIG);

  // ── Architectural Analysis (Sunlight, Ventilation & Vastu) state ──
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [liveSunPosition, setLiveSunPosition] = useState<[number, number, number] | undefined>(undefined);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (plan && !originalPlanRef.current) {
      originalPlanRef.current = JSON.parse(JSON.stringify(plan));
    }
  }, [plan]);

  const handleApplyWizardPlan = useCallback(
    (newPlan: FloorPlan) => {
      pushPlan(newPlan);
      showToast("Applied new architectural layout in 3D");
    },
    [pushPlan]
  );

  const handleSaveAsNew = useCallback(
    async (newPlan: FloorPlan, name: string) => {
      try {
        if (isDemo) {
          pushPlan(newPlan);
          showToast(`Saved "${name}" as new design locally`);
          return;
        }
        const created = await createProject({
          name,
          units: newPlan.units,
          plotWidth: newPlan.plot.width,
          plotLength: newPlan.plot.length,
        });
        await saveDesign(created.id, newPlan);
        showToast(`Created new project: "${name}"`);
        router.push(`/studio/${created.id}/3d`);
      } catch (err) {
        showToast(err instanceof Error ? `Failed: ${err.message}` : "Failed to create new design");
      }
    },
    [isDemo, pushPlan, router]
  );

  const handleRestoreOriginal = useCallback(() => {
    if (originalPlanRef.current) {
      pushPlan(JSON.parse(JSON.stringify(originalPlanRef.current)));
      showToast("Restored initial floor plan design");
    }
  }, [pushPlan]);

  // ── Refs ──
  const sceneRef       = useRef<HouseSceneHandle | null>(null);
  const viewerShellRef = useRef<HTMLDivElement | null>(null);
  const floorMenuRef   = useRef<HTMLDivElement | null>(null);

  /* ── Helpers ─────────────────────────────────────────────── */
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((c) => (c === msg ? null : c)), 3000);
  };

  // Fullscreen listener
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  // Close floor menu on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (floorMenuRef.current && !floorMenuRef.current.contains(e.target as Node)) {
        setShowFloorMenu(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* ── Computed ────────────────────────────────────────────── */
  const rooms      = useMemo(() => plan?.levels.flatMap((lv) => lv.rooms) ?? [], [plan]);
  const levelCount = plan?.levels.length ?? 1;

  const selected = useMemo(() => rooms.find((r) => r.id === selectedRoomId) ?? null, [rooms, selectedRoomId]);

  const selectedLevelIndex = useMemo(() => {
    if (!selected || !plan) return null;
    return plan.levels.findIndex((lv) => lv.rooms.some((r) => r.id === selected.id));
  }, [selected, plan]);

  const selectedSize = useMemo(() => {
    if (!selected) return null;
    const xs = selected.polygon.map((p) => p[0]);
    const ys = selected.polygon.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...ys) - Math.min(...ys);
    return { w, d, area: w * d, perimeter: 2 * (w + d), ratio: d > 0 ? (w / d).toFixed(2) : "1.00" };
  }, [selected]);

  const totalBuiltArea = useMemo(() => {
    if (!plan) return 0;
    return rooms.reduce((acc, r) => {
      const xs = r.polygon.map((p) => p[0]);
      const ys = r.polygon.map((p) => p[1]);
      return acc + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    }, 0);
  }, [plan, rooms]);

  const activeFloorLabel = topLevel === undefined ? "All Floors" : floorName(topLevel);
  const visibleCount = levelCount - hiddenFloors.size;

  const sceneGeo = useMemo(() => {
    if (!plan) return null;
    return buildSceneGeometry(plan, topLevel, hiddenFloors);
  }, [plan, topLevel, hiddenFloors]);

  /* ── Floor operations ────────────────────────────────────── */

  /** Hide a floor from the 3D view (non-destructive). */
  const hideFloor = useCallback((idx: number) => {
    setHiddenFloors((s) => new Set(s).add(idx));
    if (topLevel === idx) setTopLevel(undefined);
    showToast(`${floorName(idx)} hidden — click Restore to bring it back`);
  }, [topLevel]);

  /** Restore a previously hidden floor. */
  const restoreFloor = useCallback((idx: number) => {
    setHiddenFloors((s) => { const n = new Set(s); n.delete(idx); return n; });
    showToast(`${floorName(idx)} restored`);
  }, []);

  /** Show all floors. */
  const showAllFloors = useCallback(() => {
    setHiddenFloors(new Set());
    showToast("All floors visible");
  }, []);

  /** Add the next floor. */
  const addFloor = useCallback(() => {
    if (!plan) return;
    if (plan.levels.length >= 4) { showToast("Maximum 4 floors (Ground + 3)"); return; }
    const top = plan.levels[plan.levels.length - 1];
    const ids = ["ground", "first", "second", "third"];
    const id = ids[plan.levels.length] ?? `level-${plan.levels.length}`;
    const stairs = top.rooms
      .filter((r) => r.type === "staircase")
      .map((r) => ({ ...r, id: `${id}-${r.id.replace(/^[a-z]+-(?=room-)/, "")}` }));
    const newElevation = (top.elevation ?? 0) + (top.wallHeight || 10);
    pushPlan({
      ...plan,
      plot: { ...plan.plot, floors: plan.levels.length + 1 },
      levels: [...plan.levels, { id, elevation: newElevation, wallHeight: top.wallHeight || 10, rooms: stairs, walls: [], openings: [], furniture: [] }],
    });
    setTopLevel(undefined);
    setSelectedRoomId(null);
    showToast(`Added ${floorName(plan.levels.length)}`);
  }, [plan, pushPlan]);

  /** Duplicate a floor (independent geometry with new IDs). */
  const duplicateFloor = useCallback((srcIdx: number) => {
    if (!plan) return;
    if (plan.levels.length >= 4) { showToast("Maximum 4 floors reached"); return; }
    const src = plan.levels[srcIdx];
    const ids = ["ground", "first", "second", "third"];
    const newId = ids[plan.levels.length] ?? `level-${plan.levels.length}`;
    const newElevation = (plan.levels[plan.levels.length - 1].elevation ?? 0) +
                          (plan.levels[plan.levels.length - 1].wallHeight || 10);
    // Deep-clone with new IDs
    const newRooms = src.rooms.map((r) => ({ ...r, id: genId("room") }));
    const newWalls = src.walls.map((w) => ({ ...w, id: genId("wall") }));
    const newOpenings = src.openings.map((o) => ({ ...o, id: genId("opening") }));
    pushPlan({
      ...plan,
      plot: { ...plan.plot, floors: plan.levels.length + 1 },
      levels: [...plan.levels, { id: newId, elevation: newElevation, wallHeight: src.wallHeight, rooms: newRooms, walls: newWalls, openings: newOpenings, furniture: [] }],
    });
    setTopLevel(plan.levels.length);
    showToast(`Duplicated ${floorName(srcIdx)} → ${floorName(plan.levels.length)}`);
  }, [plan, pushPlan]);

  /** Delete a particular floor with confirmation. */
  const deleteFloor = useCallback((idx: number) => {
    if (!plan) return;
    if (plan.levels.length <= 1) { showToast("Cannot delete the only floor"); return; }
    const targetName = floorName(idx);
    const remaining = plan.levels.filter((_, i) => i !== idx);
    let elevation = 0;
    const ids = ["ground", "first", "second", "third"];
    const updated = remaining.map((lvl, i) => {
      const wh = lvl.wallHeight || 10;
      const res = { ...lvl, id: ids[i] ?? `level-${i}`, elevation };
      elevation += wh;
      return res;
    });
    pushPlan({ ...plan, plot: { ...plan.plot, floors: updated.length }, levels: updated });
    setTopLevel(undefined);
    setSelectedRoomId(null);
    setDeleteConfirm(null);
    // Remove from hidden if it was there
    setHiddenFloors((s) => { const n = new Set<number>(); s.forEach((v) => { if (v < idx) n.add(v); else if (v > idx) n.add(v - 1); }); return n; });
    showToast(`Deleted ${targetName} permanently`);
  }, [plan, pushPlan]);

  /* ── Camera operations ───────────────────────────────────── */
  const handleRoomSelect = (id: string | null) => {
    setSelectedRoomId(id);
    if (id && !inspectorOpen) setInspectorOpen(true);
  };

  const handleScreenshot = () => {
    const uri = sceneRef.current?.captureScreenshot();
    if (!uri) { showToast("Unable to capture frame"); return; }
    const link = document.createElement("a");
    link.download = `${isDemo ? "demo" : params.projectId}-3d-preview.png`;
    link.href = uri;
    link.click();
    showToast("PNG exported");
  };

  const handleFitToView = () => { sceneRef.current?.fitToView(); showToast("Fitted to view"); };
  const handleResetCamera = () => { setView("perspective"); sceneRef.current?.resetCamera(); showToast("Camera reset"); };
  const handleToggleFullscreen = () => {
    if (!viewerShellRef.current) return;
    if (!document.fullscreenElement) viewerShellRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };
  const handleFocusRoom = () => {
    if (!selectedRoomId) return;
    sceneRef.current?.focusRoom(selectedRoomId);
    showToast(`Focused on ${selected?.name ?? "room"}`);
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div className="studio-shell">
      {/* ── Top Header ── */}
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <Link href={`/studio/${params.projectId}`} className="brand" title="Back to 2D Editor">
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text" priority />
          </Link>
          <div className="studio-tag">
            <Sparkles size={11} style={{ verticalAlign: "middle" }} /> 3D Studio
          </div>
          <div className="studio-breadcrumb">
            <span>/</span>
            <strong>{projectName || (isDemo ? "Demo Plan" : "Untitled Project")}</strong>
            <span>/</span>
            <span>3D Model</span>
          </div>
        </div>
        <div className="studio-topbar-right">
          <div className="studio-sync-pill" title="Changes sync live between 2D and 3D">
            <span className="studio-sync-dot" />
            <span>Live 2D Sync</span>
          </div>
          <button
            className="button"
            onClick={() => setShowTerraceModal(true)}
            title="Design the rooftop terrace, exterior facade, railings, and outdoor furniture"
            style={{ background: "#FFF8EC", borderColor: "#FCD68A", color: "#92400E", fontWeight: 700 }}
          >
            🏛️ Terrace & Exterior
          </button>
          <button
            className="button"
            onClick={() => setShowInteriorModal(true)}
            title="Open Realistic Interior Designer for room furniture and styling"
            style={{ background: "#F5F3FF", borderColor: "#DDD6FE", color: "#5B21B6", fontWeight: 700 }}
          >
            <Paintbrush size={14} style={{ marginRight: 5, color: "#7C3AED" }} />Interior Designer
          </button>
          <button className="button" onClick={() => setShowDesignWizard(true)} title="Choose from 8 architectural designs and structural terrace layouts">
            <Sparkles size={14} style={{ marginRight: 5, color: "#7B68EE" }} />House Designs
          </button>
          <button
            className="button"
            onClick={() => setShowExportModal(true)}
            title="Export 3D Model (GLB, OBJ) and 2D Architectural Plans"
          >
            <Download size={14} style={{ marginRight: 5 }} />Export
          </button>
          <button className="button" onClick={handleScreenshot} title="Export PNG screenshot">
            <Camera size={14} style={{ marginRight: 5 }} />Screenshot
          </button>
          <Link className="button primary" href={`/studio/${params.projectId}`} title="Back to 2D Editor">
            <ArrowLeft size={14} style={{ marginRight: 5 }} />2D Editor
          </Link>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="studio-main">
        {/* Toast */}
        {toast && (
          <div className="studio-toast" role="status">
            <Sparkles size={13} /> {toast}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteConfirm !== null && (
          <div className="studio-confirm-overlay">
            <div className="studio-confirm-dialog">
              <div className="studio-confirm-icon">
                <Trash2 size={22} />
              </div>
              <h3>Delete {floorName(deleteConfirm)}?</h3>
              <p>
                All rooms, walls, and openings on this floor will be <strong>permanently removed</strong>. This cannot be undone.
                <br /><br />
                <em>If you just want to hide it from view, use Hide Floor instead.</em>
              </p>
              <div className="studio-confirm-actions">
                <button className="button" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="button danger" onClick={() => deleteFloor(deleteConfirm)}>
                  <Trash2 size={13} style={{ marginRight: 5 }} />Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error / Loading */}
        {loadError ? (
          <div className="studio-viewport-card" style={{ display: "grid", placeItems: "center" }}>
            <div className="studio-empty-card">
              <h3>Unable to load project</h3>
              <p>{loadError}</p>
              <Link className="button primary" href="/">Return to Dashboard</Link>
            </div>
          </div>
        ) : !plan ? (
          <div className="studio-viewport-card" style={{ display: "grid", placeItems: "center" }}>
            <div className="studio-empty-card">
              <div className="studio-sync-dot" style={{ width: 12, height: 12, marginBottom: 12 }} />
              <h3>Initializing 3D Engine…</h3>
              <p>Building walls, rooms, doors, and windows from your design.</p>
            </div>
          </div>
        ) : (
          <div className="studio-stage">
            {/* ── 3D Viewport ── */}
            <div className="studio-viewport-card" ref={viewerShellRef}>

              {/* ── Floating Toolbar ── */}
              <div className="studio-floating-toolbar" role="toolbar" aria-label="3D Studio Controls">

                {/* TERRACE & EXTERIOR DESIGNER */}
                <div className="studio-toolbar-cluster">
                  <button
                    className="studio-tool-btn"
                    onClick={() => setShowTerraceModal(true)}
                    title="Design rooftop terrace, exterior facade, railings & outdoor furniture"
                    style={{ background: "rgba(245, 158, 11, 0.12)", color: "#92400E", fontWeight: 700 }}
                  >
                    <span style={{ fontSize: 13 }}>🏛️</span>
                    <span>Terrace</span>
                  </button>

                  <button
                    className="studio-tool-btn"
                    onClick={() => { sceneRef.current?.viewTerrace?.(); showToast("Camera moved to rooftop terrace"); }}
                    title="Orient camera onto the rooftop terrace"
                    style={{ background: "rgba(245, 158, 11, 0.08)", color: "#92400E" }}
                  >
                    <span style={{ fontSize: 13 }}>🔭</span>
                    <span>View Roof</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* INTERIOR DESIGNER */}
                <div className="studio-toolbar-cluster">
                  <button
                    className="studio-tool-btn"
                    onClick={() => setShowInteriorModal(true)}
                    title="Furnish & customize rooms with 3D furniture and finishes"
                    style={{ background: "rgba(124, 58, 237, 0.12)", color: "#5B21B6", fontWeight: 700 }}
                  >
                    <Paintbrush size={13} style={{ color: "#7C3AED" }} />
                    <span>Interior</span>
                  </button>

                  <button
                    className={`studio-toggle-btn${showFurniture ? " active" : ""}`}
                    onClick={() => {
                      setShowFurniture((f) => !f);
                      showToast(!showFurniture ? "Showing furniture" : "Hiding furniture (empty rooms)");
                    }}
                    title="Toggle between furnished and empty-room shell view"
                  >
                    {showFurniture ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span>{showFurniture ? "Furnished" : "Empty"}</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* ARCHITECTURAL DESIGNS */}
                <div className="studio-toolbar-cluster">
                  <button
                    className="studio-tool-btn"
                    onClick={() => setShowDesignWizard(true)}
                    title="Change architectural layout or structural terrace"
                    style={{ background: "rgba(123, 104, 238, 0.15)", color: "#5146A5", fontWeight: 600 }}
                  >
                    <Sparkles size={13} style={{ color: "#7B68EE" }} />
                    <span>Designs</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* ARCHITECTURAL ANALYSIS (SUNLIGHT, VENTILATION & VASTU) */}
                <div className="studio-toolbar-cluster">
                  <button
                    className="studio-tool-btn"
                    onClick={() => setShowAnalysisModal(true)}
                    title="Analyze sunlight exposure, cross-ventilation, and optional Vastu layout"
                    style={{ background: "rgba(245, 158, 11, 0.14)", color: "#B45309", fontWeight: 700 }}
                  >
                    <SunMedium size={13} style={{ color: "#D97706" }} />
                    <span>Sun & Vastu</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* EXPORT 3D & 2D */}
                <div className="studio-toolbar-cluster">
                  <button
                    className="studio-tool-btn"
                    onClick={() => setShowExportModal(true)}
                    title="Export 3D GLB/OBJ model, screenshot, or 2D floor plans"
                    style={{ background: "rgba(16, 185, 129, 0.12)", color: "#047857", fontWeight: 700 }}
                  >
                    <Download size={13} style={{ color: "#059669" }} />
                    <span>Export</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* FLOORS */}
                <div className="studio-toolbar-cluster" ref={floorMenuRef} style={{ position: "relative" }}>
                  <button
                    className="studio-floor-select"
                    onClick={() => setShowFloorMenu((m) => !m)}
                    aria-haspopup="listbox"
                    aria-expanded={showFloorMenu}
                    title="Manage floors — select, hide, add or delete"
                  >
                    <Layers size={13} style={{ color: "#5146A5", flexShrink: 0 }} />
                    <span className="studio-floor-select-label">{activeFloorLabel}</span>
                    {hiddenFloors.size > 0 && (
                      <span className="studio-floor-badge" style={{ background: "#FFF4D6", color: "#7A5B00" }} title={`${hiddenFloors.size} floor(s) hidden`}>
                        {hiddenFloors.size} hidden
                      </span>
                    )}
                    <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                  </button>

                  {showFloorMenu && (
                    <div className="studio-floor-menu" role="listbox">
                      <div className="studio-floor-menu-head">
                        <span className="studio-floor-menu-title">Building Floors</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className="studio-floor-menu-count">{levelCount} floor{levelCount !== 1 ? "s" : ""}</span>
                          {hiddenFloors.size > 0 && (
                            <button className="studio-floor-show-all" onClick={() => { showAllFloors(); setShowFloorMenu(false); }}>
                              Show All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* All floors option */}
                      <div
                        className={`studio-floor-row${topLevel === undefined ? " active" : ""}`}
                        onClick={() => { setTopLevel(undefined); setShowFloorMenu(false); showToast("Showing all floors"); }}
                        role="option"
                        aria-selected={topLevel === undefined}
                      >
                        <div className="studio-floor-info">
                          <div className="studio-floor-circle">All</div>
                          <div>
                            <div className="studio-floor-label">All Floors</div>
                            <div className="studio-floor-sub">Whole building · {visibleCount}/{levelCount} visible</div>
                          </div>
                        </div>
                        {topLevel === undefined && <Check size={13} style={{ color: "#5146A5", flexShrink: 0 }} />}
                      </div>

                      {/* Per-floor rows */}
                      {Array.from({ length: levelCount }, (_, i) => i).map((lv) => {
                        const lvlRooms = plan.levels[lv]?.rooms ?? [];
                        const isHidden = hiddenFloors.has(lv);
                        const isOnlyFloor = levelCount === 1;
                        const isActive = topLevel === lv;

                        return (
                          <div key={lv} className={`studio-floor-row${isActive ? " active" : ""}${isHidden ? " hidden-floor" : ""}`}>
                            {/* Left: select floor */}
                            <div
                              className="studio-floor-info"
                              onClick={() => {
                                setTopLevel(lv);
                                setShowFloorMenu(false);
                                if (selectedLevelIndex !== null && selectedLevelIndex > lv) setSelectedRoomId(null);
                                showToast(`Viewing ${floorName(lv)}`);
                              }}
                              role="option"
                              aria-selected={isActive}
                            >
                              <div className="studio-floor-circle" style={isHidden ? { opacity: 0.4 } : {}}>
                                {lv === 0 ? "G" : lv}
                              </div>
                              <div>
                                <div className="studio-floor-label" style={isHidden ? { color: "#999" } : {}}>
                                  {floorName(lv)}
                                  {isHidden && <span className="studio-hidden-badge"> (Hidden)</span>}
                                </div>
                                <div className="studio-floor-sub">{lvlRooms.length} room{lvlRooms.length !== 1 ? "s" : ""}</div>
                              </div>
                            </div>

                            {/* Right: actions */}
                            <div className="studio-floor-actions">
                              {isActive && !isHidden && <Check size={13} style={{ color: "#5146A5", flexShrink: 0 }} />}

                              {/* Hide / Restore */}
                              <button
                                type="button"
                                className={`studio-floor-action-btn${isHidden ? " restore" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isHidden) restoreFloor(lv);
                                  else hideFloor(lv);
                                }}
                                title={isHidden ? `Restore ${floorName(lv)} to the 3D view` : `Hide ${floorName(lv)} from the 3D view (data is preserved)`}
                              >
                                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>

                              {/* Duplicate */}
                              <button
                                type="button"
                                className="studio-floor-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateFloor(lv);
                                  setShowFloorMenu(false);
                                }}
                                disabled={levelCount >= 4}
                                title={levelCount >= 4 ? "Max 4 floors" : `Duplicate ${floorName(lv)}`}
                              >
                                <Copy size={13} />
                              </button>

                              {/* Delete (permanent) */}
                              <button
                                type="button"
                                className="studio-floor-del-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFloorMenu(false);
                                  setDeleteConfirm(lv);
                                }}
                                disabled={isOnlyFloor}
                                title={isOnlyFloor ? "Cannot delete the only floor" : `Delete ${floorName(lv)} permanently`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add floor */}
                      {levelCount < 4 && (
                        <button
                          type="button"
                          className="studio-add-floor-btn"
                          style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                          onClick={() => { addFloor(); setShowFloorMenu(false); }}
                        >
                          <Plus size={13} />
                          <span>Add {floorName(levelCount)}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="studio-toolbar-divider" />

                {/* ROOF TOGGLE */}
                <div className="studio-toolbar-cluster">
                  <button
                    className={`studio-roof-btn${!showRoof ? " active" : ""}`}
                    onClick={() => {
                      setShowRoof((r) => !r);
                      showToast(!showRoof ? "Roof restored" : "Roof removed — viewing inside rooms");
                    }}
                    title={showRoof ? "Remove roof to look inside rooms" : "Restore roof"}
                    aria-pressed={!showRoof}
                  >
                    <Home size={13} style={{ color: !showRoof ? "#FFF4D6" : "#5146A5", flexShrink: 0 }} />
                    <span>{showRoof ? "Remove Roof" : "Restore Roof"}</span>
                    <span className="studio-roof-status">{showRoof ? "ON" : "OFF"}</span>
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* 3D WALKTHROUGH BUTTON */}
                <div className="studio-toolbar-cluster">
                  <button
                    className={`studio-walk-btn${walkthrough ? " active" : ""}`}
                    onClick={() => {
                      const next = !walkthrough;
                      setWalkthrough(next);
                      if (next) {
                        showToast("Entered 3D Walkthrough — use WASD & Mouse to explore!");
                      } else {
                        showToast("Exited Walkthrough mode");
                      }
                    }}
                    title="Enter interactive 3D Walkthrough inside the house"
                    aria-pressed={walkthrough}
                  >
                    <Footprints size={13} style={{ color: walkthrough ? "#FFF4D6" : "#5146A5", flexShrink: 0 }} />
                    <span>Walkthrough</span>
                    {walkthrough && <span className="studio-walk-status">LIVE</span>}
                  </button>
                </div>

                <div className="studio-toolbar-divider" />

                {/* CAMERA VIEWS */}
                <div className="studio-toolbar-cluster" role="group" aria-label="Camera Views">
                  <div className="studio-btn-group">
                    <button className={`studio-tool-btn${view === "perspective" ? " active" : ""}`} onClick={() => setView("perspective")} title="3D Perspective">
                      <Orbit size={13} /><span>3D</span>
                    </button>
                    <button className={`studio-tool-btn${view === "top" ? " active" : ""}`} onClick={() => setView("top")} title="Top-down view">
                      <SquareDashed size={13} /><span>Top</span>
                    </button>
                    <button className={`studio-tool-btn${view === "isometric" ? " active" : ""}`} onClick={() => setView("isometric")} title="Isometric view">
                      <Layers size={13} /><span>Iso</span>
                    </button>
                  </div>
                </div>

                <div className="studio-toolbar-divider" />

                {/* QUICK TOGGLES */}
                <div className="studio-toolbar-cluster">
                  <button className={`studio-toggle-btn${showLabels ? " active" : ""}`} onClick={() => setShowLabels((l) => !l)} title="Toggle room labels" aria-pressed={showLabels}>
                    <Tag size={13} /><span>Labels</span>
                  </button>
                  <button className={`studio-toggle-btn${showGrid ? " active" : ""}`} onClick={() => setShowGrid((g) => !g)} title="Toggle grid" aria-pressed={showGrid}>
                    <Grid3x3 size={13} /><span>Grid</span>
                  </button>
                  <button className="studio-icon-btn" onClick={handleFitToView} title="Fit to view">
                    <Maximize2 size={13} />
                  </button>
                  <button className={`studio-icon-btn${isFullscreen ? " active" : ""}`} onClick={handleToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>

              {/* ── 3D Canvas ── */}
              <div className="studio-canvas-container">
                {rooms.length === 0 ? (
                  <div className="studio-empty-card">
                    <Orbit size={36} style={{ color: "#5146A5", opacity: 0.8, marginBottom: 12 }} />
                    <h3>Empty Plot</h3>
                    <p>Add rooms in the 2D editor and they will appear here in 3D.</p>
                    <Link className="button primary" href={`/studio/${params.projectId}`}>
                      <ArrowLeft size={13} style={{ marginRight: 5 }} />Open 2D Editor
                    </Link>
                  </div>
                ) : (
                  <HouseScene
                    ref={sceneRef}
                    plan={plan}
                    view={view}
                    showGrid={showGrid}
                    showRoof={showRoof}
                    showLabels={showLabels}
                    topLevel={topLevel}
                    selectedRoomId={selectedRoomId}
                    onSelectRoom={handleRoomSelect}
                    showFurniture={showFurniture}
                    selectedFurnitureId={selectedFurnitureId}
                    onSelectFurniture={setSelectedFurnitureId}
                    hiddenLevels={hiddenFloors}
                    styleTheme={styleTheme}
                    sunPosition={liveSunPosition}
                    walkthroughMode={walkthrough}
                    isFirstPerson={isFirstPerson}
                    onToggleFirstPerson={() => setIsFirstPerson((p) => !p)}
                    onExitWalkthrough={() => {
                      setWalkthrough(false);
                      showToast("Exited Walkthrough mode");
                    }}
                    onWalkthroughRoomChange={(name, lvl) => {
                      setWalkRoomName(name);
                      setWalkFloorLevel(lvl);
                    }}
                    walkthroughTargetRoomId={walkTargetRoomId}
                    onClearWalkthroughTeleport={() => setWalkTargetRoomId(null)}
                    walkthroughTargetFloor={walkTargetFloor}
                    onClearWalkthroughTargetFloor={() => setWalkTargetFloor(null)}
                    mobileWalkthroughInputs={mobileWalkInputs}
                    terraceConfig={terraceConfig}
                    exteriorConfig={exteriorConfig}
                  />
                )}
              </div>

              {/* ── Walkthrough Interactive HUD Overlay ── */}
              {walkthrough && sceneGeo && (
                <WalkthroughHUD
                  geometry={sceneGeo}
                  active={walkthrough}
                  currentRoomName={walkRoomName}
                  currentFloorLevel={walkFloorLevel}
                  isFirstPerson={isFirstPerson}
                  onToggleFirstPerson={() => setIsFirstPerson((p) => !p)}
                  onExit={() => {
                    setWalkthrough(false);
                    showToast("Exited Walkthrough mode");
                  }}
                  onSelectRoom={(roomId) => {
                    setWalkTargetRoomId(roomId);
                    const r = sceneGeo.floors.find((f) => f.id === roomId);
                    showToast(`Teleporting to ${r?.name ?? "room"}...`);
                  }}
                  onSelectFloor={(lvl) => {
                    setWalkTargetFloor(lvl);
                    showToast(`Navigating to ${floorName(lvl)}...`);
                  }}
                  onResetPosition={() => {
                    setWalkTargetRoomId(null);
                    setWalkTargetFloor(0);
                    showToast("Reset position to Ground Floor");
                  }}
                  onMobileInputChange={(inputs) => setMobileWalkInputs(inputs)}
                />
              )}

              {/* ── Hidden Floors Banner ── */}
              {hiddenFloors.size > 0 && (
                <div className="studio-hidden-banner">
                  <EyeOff size={13} />
                  <span>
                    {hiddenFloors.size === 1
                      ? `${floorName([...hiddenFloors][0])} is hidden`
                      : `${hiddenFloors.size} floors are hidden`} — floor data is preserved
                  </span>
                  <button onClick={showAllFloors}>Restore All</button>
                </div>
              )}

              {/* ── Gesture Guide ── */}
              {showGestureGuide ? (
                <div className="studio-gesture-guide" role="region" aria-label="Navigation help">
                  <div className="studio-gesture-head">
                    <div className="studio-gesture-title">
                      <HelpCircle size={13} style={{ color: "#5146A5" }} /> 3D Controls
                    </div>
                    <button className="studio-hud-btn" style={{ width: 22, height: 22 }} onClick={() => setShowGestureGuide(false)} title="Dismiss">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="studio-gesture-list">
                    <div className="studio-gesture-item"><span>🖱️ <strong>Left-drag</strong> orbit</span></div>
                    <div className="studio-gesture-item"><span>🖱️ <strong>Right-drag</strong> pan</span></div>
                    <div className="studio-gesture-item"><span>🔄 <strong>Scroll</strong> zoom</span></div>
                    <div className="studio-gesture-item"><span>👆 <strong>Click room</strong> inspect</span></div>
                  </div>
                </div>
              ) : (
                <button className="studio-gesture-badge-btn" onClick={() => setShowGestureGuide(true)} title="Show controls">
                  <HelpCircle size={13} /> Controls
                </button>
              )}

              {/* ── HUD Navigation Controls ── */}
              <div className="studio-hud-controls" role="group" aria-label="Camera controls">
                <button className="studio-hud-btn" onClick={() => sceneRef.current?.zoomIn()} title="Zoom in"><ZoomIn size={15} /></button>
                <button className="studio-hud-btn" onClick={() => sceneRef.current?.zoomOut()} title="Zoom out"><ZoomOut size={15} /></button>
                <button className="studio-hud-btn" onClick={handleFitToView} title="Fit to view"><Maximize2 size={14} /></button>
                <button className="studio-hud-btn" onClick={handleResetCamera} title="Reset camera"><RotateCcw size={14} /></button>
              </div>
            </div>

            {/* ── Inspector Panel ── */}
            {inspectorOpen && (
              <aside className="studio-inspector" aria-label="Inspector Panel">

                {/* Inspector tabs: Floors vs Style */}
                <div className="studio-inspector-tabs">
                  <button
                    className={`studio-inspector-tab${styleTab === "floors" ? " active" : ""}`}
                    onClick={() => setStyleTab("floors")}
                  >
                    <Layers size={13} /> Floors
                  </button>
                  <button
                    className={`studio-inspector-tab${styleTab === "style" ? " active" : ""}`}
                    onClick={() => setStyleTab("style")}
                  >
                    <Sparkles size={13} /> Style
                  </button>
                </div>

                {/* ══ FLOORS TAB ══ */}
                {styleTab === "floors" && (
                  <>
                    {/* Selected room inspector */}
                    {selected && selectedSize ? (
                      <>
                        <div className="studio-inspector-head">
                          <div>
                            <div className="studio-inspector-eyebrow"><Sparkles size={11} /> Room Inspector</div>
                            <h2 className="studio-inspector-title">{selected.name}</h2>
                          </div>
                          <button className="studio-icon-btn" style={{ width: 28, height: 28 }} onClick={() => setSelectedRoomId(null)} title="Deselect">
                            <X size={14} />
                          </button>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(() => { const meta = getRoomMeta(selected.type); const Icon = meta.icon; return (
                            <div className="studio-type-badge"><Icon size={12} style={{ color: "#5146A5" }} /><span>{meta.label}</span></div>
                          ); })()}
                          <div className="studio-type-badge" style={{ background: "#F6F5F2", borderColor: "#E5E1D8" }}>
                            <Layers size={11} /><span>{selectedLevelIndex !== null ? floorName(selectedLevelIndex) : "Ground Floor"}</span>
                          </div>
                        </div>

                        <div className="studio-metrics-grid">
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Dimensions</span>
                            <div className="studio-metric-value">{+selectedSize.w.toFixed(1)} × {+selectedSize.d.toFixed(1)}<span className="studio-metric-unit">{plan.units}</span></div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Floor Area</span>
                            <div className="studio-metric-value">{Math.round(selectedSize.area)}<span className="studio-metric-unit">{plan.units === "ft" ? "sq ft" : "m²"}</span></div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Perimeter</span>
                            <div className="studio-metric-value">{+selectedSize.perimeter.toFixed(1)}<span className="studio-metric-unit">{plan.units}</span></div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Aspect Ratio</span>
                            <div className="studio-metric-value">{selectedSize.ratio}<span className="studio-metric-unit">:1</span></div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button
                            className="button primary"
                            style={{ background: "#6D28D9" }}
                            onClick={() => setShowInteriorModal(true)}
                          >
                            <Paintbrush size={14} style={{ marginRight: 5 }} /> Furnish & Style {selected.name}
                          </button>
                          <button className="button" onClick={handleFocusRoom}><Crosshair size={14} style={{ marginRight: 5 }} />Focus Camera on Room</button>
                          <button className="button" onClick={() => setSelectedRoomId(null)}>Clear Selection</button>
                        </div>
                      </>
                    ) : (
                      /* Project overview when no room selected */
                      <>
                        <div className="studio-inspector-head">
                          <div>
                            <div className="studio-inspector-eyebrow"><Layers size={11} /> Project Overview</div>
                            <h2 className="studio-inspector-title">{projectName || "Architectural Model"}</h2>
                          </div>
                        </div>

                        {/* Floor management card */}
                        <div className="studio-floor-mgmt-card">
                          <div className="studio-floor-mgmt-header">
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "#302A65", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Building Floors
                              </div>
                              <div style={{ fontSize: 10, color: "#7D7896", marginTop: 2 }}>
                                {levelCount} floor{levelCount !== 1 ? "s" : ""} · {visibleCount} visible
                              </div>
                            </div>
                            {levelCount < 4 && (
                              <button className="studio-add-floor-btn" style={{ padding: "4px 9px", fontSize: 10.5 }} onClick={addFloor}>
                                <Plus size={11} /> Add Floor
                              </button>
                            )}
                          </div>

                          {/* All-floors option */}
                          <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: topLevel === undefined ? "#302A65" : "#FFFFFF", color: topLevel === undefined ? "#FFF4D6" : "#302A65", border: "1px solid #EAE5F6", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                            onClick={() => { setTopLevel(undefined); showToast("Showing all floors"); }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Layers size={13} /><span>All Floors</span>
                            </div>
                            {topLevel === undefined && <Check size={13} />}
                          </div>

                          {/* Per-floor rows in inspector */}
                          {Array.from({ length: levelCount }, (_, i) => i).map((lv) => {
                            const lvlRooms = plan.levels[lv]?.rooms ?? [];
                            const isHidden = hiddenFloors.has(lv);
                            const isActive = topLevel === lv;
                            const isOnlyFloor = levelCount === 1;

                            return (
                              <div key={lv} className="studio-inspector-floor-row" style={{ background: isActive ? "#F0EDFA" : isHidden ? "#FAFAF7" : "#FFFFFF", border: isActive ? "1.5px solid #5146A5" : "1px solid #EAE5F6", opacity: isHidden ? 0.75 : 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }} onClick={() => { setTopLevel(lv); showToast(`Viewing ${floorName(lv)}`); }}>
                                  <span className="studio-floor-circle" style={{ flexShrink: 0, opacity: isHidden ? 0.5 : 1 }}>{lv === 0 ? "G" : lv}</span>
                                  <div>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: isHidden ? "#999" : "#1D1A40" }}>
                                      {floorName(lv)}{isHidden && <span style={{ color: "#B8A060", fontSize: 10, marginLeft: 5 }}>HIDDEN</span>}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#7D7896" }}>{lvlRooms.length} rooms</div>
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {/* Hide/Restore */}
                                  <button
                                    type="button"
                                    className={`studio-floor-action-btn${isHidden ? " restore" : ""}`}
                                    style={{ width: 26, height: 26 }}
                                    onClick={() => isHidden ? restoreFloor(lv) : hideFloor(lv)}
                                    title={isHidden ? `Restore ${floorName(lv)}` : `Hide ${floorName(lv)}`}
                                  >
                                    {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                  {/* Duplicate */}
                                  <button
                                    type="button"
                                    className="studio-floor-action-btn"
                                    style={{ width: 26, height: 26 }}
                                    onClick={() => duplicateFloor(lv)}
                                    disabled={levelCount >= 4}
                                    title={levelCount >= 4 ? "Max 4 floors" : `Duplicate ${floorName(lv)}`}
                                  >
                                    <Copy size={12} />
                                  </button>
                                  {/* Delete */}
                                  <button
                                    type="button"
                                    className="studio-floor-del-btn"
                                    style={{ width: 26, height: 26 }}
                                    onClick={() => setDeleteConfirm(lv)}
                                    disabled={isOnlyFloor}
                                    title={isOnlyFloor ? "Cannot delete the only floor" : `Delete ${floorName(lv)}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Project metrics */}
                        <div className="studio-metrics-grid">
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Total Area</span>
                            <div className="studio-metric-value">{Math.round(totalBuiltArea)}<span className="studio-metric-unit">{plan.units === "ft" ? "sq ft" : "m²"}</span></div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Plot</span>
                            <div className="studio-metric-value">{plan.plot.width}×{plan.plot.length}<span className="studio-metric-unit">{plan.units}</span></div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Rooms</span>
                            <div className="studio-metric-value">{rooms.length}</div>
                          </div>
                          <div className="studio-metric-card">
                            <span className="studio-metric-label">Levels</span>
                            <div className="studio-metric-value">{levelCount}</div>
                          </div>
                        </div>

                        {/* Rooms directory */}
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7D7896", marginBottom: 8 }}>
                            Rooms (click to inspect)
                          </div>
                          <div className="studio-room-list">
                            {rooms.map((room) => {
                              const meta = getRoomMeta(room.type);
                              const Icon = meta.icon;
                              const xs = room.polygon.map((p) => p[0]);
                              const ys = room.polygon.map((p) => p[1]);
                              const area = Math.round((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
                              return (
                                <button key={room.id} className={`studio-room-item${selectedRoomId === room.id ? " selected" : ""}`} onClick={() => handleRoomSelect(room.id)}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Icon size={13} style={{ color: "#5146A5" }} />
                                    <span>{room.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{area} {plan.units === "ft" ? "sq ft" : "m²"}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ══ STYLE TAB ══ */}
                {styleTab === "style" && (
                  <>
                    <div className="studio-inspector-head">
                      <div>
                        <div className="studio-inspector-eyebrow"><Sparkles size={11} /> Architectural Style</div>
                        <h2 className="studio-inspector-title">Customize Look</h2>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "#7D7896", margin: 0, lineHeight: 1.5 }}>
                      Choose an architectural style. Layout and room positions are preserved — only materials and colours change.
                    </p>

                    <div className="studio-style-grid">
                      {ARCH_STYLES.map((s) => (
                        <button
                          key={s.id}
                          className={`studio-style-card${styleTheme === s.id ? " active" : ""}`}
                          onClick={() => { setStyleTheme(s.id); showToast(`Applied ${s.label} style`); }}
                          title={s.desc}
                        >
                          <span className="studio-style-emoji">{s.emoji}</span>
                          <span className="studio-style-label">{s.label}</span>
                          {styleTheme === s.id && <Check size={12} className="studio-style-check" />}
                        </button>
                      ))}
                    </div>

                    <div className="studio-style-active-desc">
                      {(() => { const s = ARCH_STYLES.find((x) => x.id === styleTheme); return s ? <><strong>{s.label}</strong> — {s.desc}</> : null; })()}
                    </div>
                  </>
                )}
              </aside>
            )}
          </div>
        )}
      </main>

      <DesignWizardModal
        isOpen={showDesignWizard}
        onClose={() => setShowDesignWizard(false)}
        currentPlan={plan}
        onApplyPlan={handleApplyWizardPlan}
        onSaveAsNew={handleSaveAsNew}
        onRestoreOriginal={handleRestoreOriginal}
        canRestoreOriginal={Boolean(originalPlanRef.current)}
      />

      <InteriorDesignerModal
        isOpen={showInteriorModal}
        onClose={() => setShowInteriorModal(false)}
        plan={plan}
        onUpdatePlan={(updated) => {
          pushPlan(updated);
          showToast("Updated room interior & furniture");
        }}
        initialRoomId={selectedRoomId}
        selectedFurnitureId={selectedFurnitureId}
        onSelectFurniture={setSelectedFurnitureId}
      />

      {plan && (
        <TerraceDesignerModal
          isOpen={showTerraceModal}
          onClose={() => setShowTerraceModal(false)}
          plan={plan}
          onUpdatePlan={(updated) => {
            pushPlan(updated);
            showToast("Applied terrace layout to 3D model");
          }}
          terraceConfig={terraceConfig}
          onUpdateTerraceConfig={setTerraceConfig}
          exteriorConfig={exteriorConfig}
          onUpdateExteriorConfig={setExteriorConfig}
          onViewTerrace={() => { sceneRef.current?.viewTerrace?.(); setShowTerraceModal(false); showToast("Camera moved to rooftop terrace"); }}
        />
      )}

      {plan && (
        <ArchitecturalAnalysisModal
          isOpen={showAnalysisModal}
          onClose={() => setShowAnalysisModal(false)}
          plan={plan}
          onUpdateSunPosition={setLiveSunPosition}
        />
      )}

      {plan && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          plan={plan}
          renderer={sceneRef.current?.getRenderer()}
          liveScene={sceneRef.current?.getScene()}
          activeLevelIndex={topLevel ?? 0}
          initialTab="3d"
        />
      )}
    </div>
  );
}
