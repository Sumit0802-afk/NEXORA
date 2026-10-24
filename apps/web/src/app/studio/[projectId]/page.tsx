"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  FileText,
  Hand,
  History,
  Layers,
  Maximize2,
  Minus,
  MousePointer2,
  Paintbrush,
  Plus,
  Redo2,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Sparkles,
  Split,
  Square,
  SquareSplitHorizontal,
  SunMedium,
  Trash2,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import type { FloorPlanMode, Selection } from "@/components/editor/FloorPlanCanvas";
import { DesignWizardModal } from "@/components/plan/DesignWizardModal";
import { InteriorDesignerModal } from "@/components/interior/InteriorDesignerModal";
import { ArchitecturalAnalysisModal } from "@/components/analysis/ArchitecturalAnalysisModal";
import { ExportModal } from "@/components/export/ExportModal";
import { createProject, saveDesign } from "@/lib/api";
import { usePlanContext } from "./plan-context";
import { polygonArea, polygonPerimeter } from "@/lib/geometry";
import { validateDesign } from "@/lib/validation";
import { floorName, floorShortName } from "@/lib/floors";
import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import type Konva from "konva";

const FloorPlanCanvas = dynamic(
  () => import("@/components/editor/FloorPlanCanvas").then((m) => m.FloorPlanCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="canvas-loading muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>
        Loading 2D Canvas…
      </div>
    ),
  }
);

// The 3D renderer (three.js) loads only when split view is active.
const HouseScene = dynamic(() => import("@/components/viewer/HouseScene").then((m) => m.HouseScene), {
  ssr: false,
  loading: () => <div className="split-3d-loading">Loading 3D…</div>,
});

const ROOM_TYPES: { label: string; value: RoomType; defaultSize: [number, number] }[] = [
  { label: "Living room", value: "living_room", defaultSize: [16, 14] },
  { label: "Bedroom", value: "bedroom", defaultSize: [14, 12] },
  { label: "Kitchen", value: "kitchen", defaultSize: [12, 10] },
  { label: "Bathroom", value: "bathroom", defaultSize: [8, 6] },
  { label: "Dining room", value: "dining_room", defaultSize: [12, 10] },
  { label: "Study room", value: "study", defaultSize: [10, 10] },
  { label: "Corridor", value: "corridor", defaultSize: [4, 16] },
  { label: "Balcony", value: "balcony", defaultSize: [12, 5] },
  { label: "Utility", value: "utility", defaultSize: [6, 6] },
];

const OPENING_PRESETS = {
  door: [
    { label: "Standard Door", width: 3.0 },
    { label: "Wide Interior Door", width: 3.5 },
    { label: "Double Entry Door", width: 5.0 },
    { label: "Sliding Patio Door", width: 6.0 },
  ],
  window: [
    { label: "Standard Window", width: 3.0 },
    { label: "Wide Casement Window", width: 4.5 },
    { label: "Picture Window", width: 6.0 },
    { label: "Panoramic Window", width: 8.0 },
  ],
};

type SavedVersion = {
  id: string;
  name: string;
  timestamp: number;
  plan: FloorPlan;
};

function genId(prefix: string): string {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
}

function sameUnitPoint(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
}

function roomBoundsOf(polygon: [number, number][]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export default function StudioPage({ params }: { params: { projectId: string } }) {
  const { isDemo, plan, loadError, saving, status, setStatus, canUndo, canRedo, undo, redo, pushPlan, save } =
    usePlanContext();
  const router = useRouter();

  const [mode, setMode] = useState<FloorPlanMode>("select");
  const [roomType, setRoomType] = useState<RoomType>("bedroom");
  const [openingKind, setOpeningKind] = useState<"door" | "window">("door");
  const [selectedOpeningPreset, setSelectedOpeningPreset] = useState(3.0);
  const [selection, setSelection] = useState<Selection>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [split3d, setSplit3d] = useState(false);
  const [cutaway3d, setCutaway3d] = useState(true);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(0.5);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [handTool, setHandTool] = useState(false);
  const [showDesignWizard, setShowDesignWizard] = useState(false);
  const [showInteriorModal, setShowInteriorModal] = useState(false);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [hiddenLevels, setHiddenLevels] = useState<Set<number>>(new Set());
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [liveSunPosition, setLiveSunPosition] = useState<[number, number, number] | undefined>(undefined);
  const [showExportModal, setShowExportModal] = useState(false);

  // Version History states
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const originalPlanRef = useRef<FloorPlan | null>(null);

  // Load saved versions from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(`nexora_versions_${params.projectId}`);
      if (stored) {
        setSavedVersions(JSON.parse(stored));
      }
    } catch {
      // ignore JSON parse errors
    }
  }, [params.projectId]);

  const persistVersions = (versions: SavedVersion[]) => {
    setSavedVersions(versions);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`nexora_versions_${params.projectId}`, JSON.stringify(versions));
      } catch {
        // ignore storage errors
      }
    }
  };

  useEffect(() => {
    if (plan && !originalPlanRef.current) {
      originalPlanRef.current = JSON.parse(JSON.stringify(plan));
    }
  }, [plan]);

  const handleSaveNamedVersion = () => {
    if (!plan) return;
    const name = newVersionName.trim() || `Design Snapshot ${savedVersions.length + 1}`;
    const newVer: SavedVersion = {
      id: genId("ver"),
      name,
      timestamp: Date.now(),
      plan: JSON.parse(JSON.stringify(plan)),
    };
    const updated = [newVer, ...savedVersions];
    persistVersions(updated);
    setNewVersionName("");
    setStatus(`Saved version: "${name}"`);
  };

  const handleRestoreVersion = (ver: SavedVersion) => {
    pushPlan(JSON.parse(JSON.stringify(ver.plan)));
    setStatus(`Restored version: "${ver.name}"`);
    setShowVersionModal(false);
  };

  const handleDeleteVersion = (id: string) => {
    const updated = savedVersions.filter((v) => v.id !== id);
    persistVersions(updated);
  };

  const handleMoveFurniture = useCallback(
    (id: string, x: number, y: number) => {
      if (!plan) return;
      const currentLevel = plan.levels[levelIndex];
      const updatedFurniture = ((currentLevel.furniture || []) as any[]).map((f) => {
        if (f.id !== id) return f;
        return { ...f, position: [x, y, 0] };
      });
      const nextLevels = plan.levels.map((lv, idx) => (idx === levelIndex ? { ...lv, furniture: updatedFurniture } : lv));
      pushPlan({ ...plan, levels: nextLevels });
    },
    [plan, levelIndex, pushPlan]
  );

  const handleApplyWizardPlan = useCallback(
    (newPlan: FloorPlan, open3d?: boolean) => {
      pushPlan(newPlan);
      setStatus("Applied architectural layout design");
      if (open3d) {
        router.push(`/studio/${params.projectId}/3d`);
      }
    },
    [pushPlan, router, params.projectId, setStatus]
  );

  const handleSaveAsNew = useCallback(
    async (newPlan: FloorPlan, name: string) => {
      try {
        if (isDemo) {
          pushPlan(newPlan);
          setStatus(`Saved "${name}" as new design locally`);
          return;
        }
        const created = await createProject({
          name,
          units: newPlan.units,
          plotWidth: newPlan.plot.width,
          plotLength: newPlan.plot.length,
        });
        await saveDesign(created.id, newPlan);
        setStatus(`Created new project: "${name}"`);
        router.push(`/studio/${created.id}`);
      } catch (err) {
        setStatus(err instanceof Error ? `Failed to create new design: ${err.message}` : "Failed to create new design");
      }
    },
    [isDemo, pushPlan, router, setStatus]
  );

  const handleRestoreOriginal = useCallback(() => {
    if (originalPlanRef.current) {
      if (window.confirm("Reset floor plan to the original initial layout? Unsaved changes will be replaced.")) {
        pushPlan(JSON.parse(JSON.stringify(originalPlanRef.current)));
        setStatus("Restored initial floor plan design");
      }
    }
  }, [pushPlan, setStatus]);

  const zoomIn = () => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 100) / 100));
  const stageRef = useRef<Konva.Stage | null>(null);

  const resetView = () => {
    stageRef.current?.position({ x: 0, y: 0 });
    stageRef.current?.batchDraw();
    setZoom(1);
  };

  const fitToPlan = () => {
    if (!plan) return;
    const viewportW = 760;
    const viewportH = 560;
    const planPxW = plan.plot.width * 10 + 96;
    const planPxH = plan.plot.length * 10 + 96;
    const fit = Math.min(2.5, Math.max(0.4, Math.min(viewportW / planPxW, viewportH / planPxH)));
    stageRef.current?.position({ x: 0, y: 0 });
    stageRef.current?.batchDraw();
    setZoom(Math.round(fit * 100) / 100);
  };

  const floorCount = plan?.levels.length ?? 1;
  useEffect(() => {
    if (levelIndex > floorCount - 1) setLevelIndex(Math.max(floorCount - 1, 0));
  }, [floorCount, levelIndex]);

  const switchLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setSelection(null);
  }, []);

  const selectRoomAnyFloor = useCallback(
    (id: string | null) => {
      if (!id || !plan) return setSelection(null);
      const index = plan.levels.findIndex((lv) => lv.rooms.some((r) => r.id === id));
      if (index >= 0) setLevelIndex(index);
      setSelection({ type: "room", id });
    },
    [plan]
  );

  // ── Multi-Floor Editing Operations ──
  const addFloor = useCallback(() => {
    if (!plan || plan.levels.length >= 4) return;
    const top = plan.levels[plan.levels.length - 1];
    const ids = ["ground", "first", "second", "third"];
    const id = ids[plan.levels.length] ?? `level-${plan.levels.length}`;
    // Carry the staircase up so the new floor is reachable; other areas start clear.
    const stairs = top.rooms
      .filter((r) => r.type === "staircase")
      .map((r) => ({ ...r, id: `${id}-${r.id.replace(/^[a-z0-9]+-(?=room-)/, "")}` }));
    const level = {
      id,
      elevation: top.elevation + top.wallHeight,
      wallHeight: top.wallHeight,
      rooms: stairs,
      walls: [],
      openings: [],
      furniture: [],
    };
    pushPlan({ ...plan, plot: { ...plan.plot, floors: plan.levels.length + 1 }, levels: [...plan.levels, level] });
    setLevelIndex(plan.levels.length);
    setSelection(null);
    setStatus(`Added ${floorName(plan.levels.length)}`);
  }, [plan, pushPlan, setStatus]);

  const duplicateFloor = useCallback(() => {
    if (!plan || plan.levels.length >= 4) return;
    const current = plan.levels[levelIndex];
    const top = plan.levels[plan.levels.length - 1];
    const newIdx = plan.levels.length;
    const ids = ["ground", "first", "second", "third"];
    const newId = ids[newIdx] ?? `level-${newIdx}`;
    const newRooms = current.rooms.map((r) => ({
      ...r,
      id: `${newId}-${r.id.replace(/^[a-z0-9]+-/, "")}`,
    }));
    const newWalls = current.walls.map((w) => ({
      ...w,
      id: `${newId}-${w.id.replace(/^[a-z0-9]+-/, "")}`,
    }));
    const newOpenings = current.openings.map((o) => ({
      ...o,
      id: `${newId}-${o.id.replace(/^[a-z0-9]+-/, "")}`,
      wallId: `${newId}-${o.wallId.replace(/^[a-z0-9]+-/, "")}`,
    }));
    const newLevel = {
      id: newId,
      elevation: top.elevation + top.wallHeight,
      wallHeight: top.wallHeight,
      rooms: newRooms,
      walls: newWalls,
      openings: newOpenings,
      furniture: [],
    };
    pushPlan({
      ...plan,
      plot: { ...plan.plot, floors: plan.levels.length + 1 },
      levels: [...plan.levels, newLevel],
    });
    setLevelIndex(newIdx);
    setSelection(null);
    setStatus(`Duplicated layout to ${floorName(newIdx)}`);
  }, [plan, levelIndex, pushPlan, setStatus]);

  const toggleHideFloor = useCallback(
    (idx: number) => {
      setHiddenLevels((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
          setStatus(`Restored 3D visibility for ${floorName(idx)}`);
        } else {
          next.add(idx);
          setStatus(`Hidden ${floorName(idx)} from 3D view (data preserved)`);
        }
        return next;
      });
    },
    [setStatus]
  );

  const deleteFloor = useCallback(
    (idx: number) => {
      if (!plan || plan.levels.length <= 1) {
        setStatus("Cannot delete the only remaining floor.");
        return;
      }
      if (window.confirm(`Are you sure you want to delete ${floorName(idx)}? This will remove its rooms permanently.`)) {
        const remaining = plan.levels.filter((_, i) => i !== idx);
        pushPlan({
          ...plan,
          plot: { ...plan.plot, floors: remaining.length },
          levels: remaining,
        });
        setLevelIndex(Math.max(0, idx - 1));
        setSelection(null);
        setStatus(`Deleted floor ${idx + 1}`);
      }
    },
    [plan, pushPlan, setStatus]
  );

  // ── Room Editing Operations ──
  const moveRoom = useCallback(
    (roomId: string, dx: number, dy: number) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex
            ? {
                ...level,
                rooms: level.rooms.map((room) =>
                  room.id === roomId
                    ? { ...room, polygon: room.polygon.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
                    : room
                ),
              }
            : level
        ),
      };
      pushPlan(next);
      setStatus("Moved room");
    },
    [plan, pushPlan, setStatus, levelIndex]
  );

  const resizeRoom = useCallback(
    (roomId: string, polygon: [number, number][]) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex
            ? {
                ...level,
                rooms: level.rooms.map((room) => (room.id === roomId ? { ...room, polygon } : room)),
              }
            : level
        ),
      };
      pushPlan(next);
      setStatus("Resized room");
    },
    [plan, pushPlan, setStatus, levelIndex]
  );

  const addRoom = useCallback(
    (polygon: [number, number][]) => {
      if (!plan) return;
      const existingOfType = plan.levels[levelIndex]?.rooms.filter((r) => r.type === roomType).length ?? 0;
      const typeLabel = ROOM_TYPES.find((t) => t.value === roomType)?.label ?? "Room";
      const name = existingOfType === 0 ? typeLabel : `${typeLabel} ${existingOfType + 1}`;
      const id = genId("room");
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex ? { ...level, rooms: [...level.rooms, { id, type: roomType, name, polygon }] } : level
        ),
      };
      pushPlan(next);
      setSelection({ type: "room", id });
      setMode("select");
      setStatus(`Added ${name}`);
    },
    [plan, pushPlan, roomType, setStatus, levelIndex]
  );

  const quickAddRoom = useCallback(
    (type: RoomType, defaultSize?: [number, number]) => {
      if (!plan) return;
      const currentLevel = plan.levels[levelIndex];
      const [rw, rd] = defaultSize ?? [12, 10];
      const existingRooms = currentLevel?.rooms ?? [];
      let px = 2;
      let py = 2;
      let placed = false;
      for (let y = 1; y <= Math.max(1, plan.plot.length - rd - 1); y += 2) {
        for (let x = 1; x <= Math.max(1, plan.plot.width - rw - 1); x += 2) {
          const testBounds = { minX: x, minY: y, maxX: x + rw, maxY: y + rd };
          const collides = existingRooms.some((r) => {
            const b = roomBoundsOf(r.polygon);
            return !(testBounds.maxX <= b.minX || testBounds.minX >= b.maxX || testBounds.maxY <= b.minY || testBounds.minY >= b.maxY);
          });
          if (!collides) {
            px = x;
            py = y;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      const polygon: [number, number][] = [
        [px, py],
        [px + rw, py],
        [px + rw, py + rd],
        [px, py + rd],
      ];
      const typeInfo = ROOM_TYPES.find((t) => t.value === type);
      const count = existingRooms.filter((r) => r.type === type).length;
      const name = count === 0 ? (typeInfo?.label ?? "Room") : `${typeInfo?.label ?? "Room"} ${count + 1}`;
      const id = genId("room");
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((lv, i) =>
          i === levelIndex ? { ...lv, rooms: [...lv.rooms, { id, type, name, polygon }] } : lv
        ),
      };
      pushPlan(next);
      setSelection({ type: "room", id });
      setStatus(`Added ${name} (${rw} × ${rd} ${plan.units})`);
    },
    [plan, levelIndex, pushPlan, setStatus]
  );

  // ── Wall Editing Operations ──
  const addWall = useCallback(
    (start: [number, number], end: [number, number]) => {
      if (!plan) return;
      const id = genId("wall");
      const wall = { id, start, end, thickness: 0.5, height: 10, kind: "interior" as const };
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) => (i === levelIndex ? { ...level, walls: [...level.walls, wall] } : level)),
      };
      pushPlan(next);
      setSelection({ type: "wall", id });
      setStatus("Added a wall");
    },
    [plan, pushPlan, setStatus, levelIndex]
  );

  const updateWall = useCallback(
    (wallId: string, start: [number, number], end: [number, number]) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex
            ? {
                ...level,
                walls: level.walls.map((w) => (w.id === wallId ? { ...w, start, end } : w)),
              }
            : level
        ),
      };
      pushPlan(next);
      setStatus("Updated wall endpoints");
    },
    [plan, levelIndex, pushPlan, setStatus]
  );

  const splitWall = useCallback(
    (wallId: string) => {
      if (!plan) return;
      const wall = plan.levels[levelIndex]?.walls.find((w) => w.id === wallId);
      if (!wall) return;
      const mid: [number, number] = [
        Math.round(((wall.start[0] + wall.end[0]) / 2) * 100) / 100,
        Math.round(((wall.start[1] + wall.end[1]) / 2) * 100) / 100,
      ];
      const wall1Id = genId("wall");
      const wall2Id = genId("wall");
      const halfLen = Math.hypot(mid[0] - wall.start[0], mid[1] - wall.start[1]);
      const w1 = { ...wall, id: wall1Id, start: wall.start, end: mid };
      const w2 = { ...wall, id: wall2Id, start: mid, end: wall.end };

      const updatedOpenings = (plan.levels[levelIndex]?.openings ?? []).map((o) => {
        if (o.wallId !== wallId) return o;
        if (o.offset <= halfLen) {
          return { ...o, wallId: wall1Id };
        } else {
          return { ...o, wallId: wall2Id, offset: o.offset - halfLen };
        }
      });

      const nextWalls = plan.levels[levelIndex]?.walls.flatMap((w) => (w.id === wallId ? [w1, w2] : [w])) ?? [];
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((lv, i) =>
          i === levelIndex ? { ...lv, walls: nextWalls, openings: updatedOpenings } : lv
        ),
      };
      pushPlan(next);
      setSelection({ type: "wall", id: wall1Id });
      setStatus("Split wall into two segments");
    },
    [plan, levelIndex, pushPlan, setStatus]
  );

  // ── Doors and Windows Operations ──
  const addOpening = useCallback(
    (wall: { start: [number, number]; end: [number, number] }, offset: number, kind: "door" | "window") => {
      if (!plan) return;
      const existingWalls = plan.levels[levelIndex]?.walls ?? [];
      let wallEntry = existingWalls.find(
        (w) =>
          (sameUnitPoint(w.start, wall.start) && sameUnitPoint(w.end, wall.end)) ||
          (sameUnitPoint(w.start, wall.end) && sameUnitPoint(w.end, wall.start))
      );
      let walls = existingWalls;
      if (!wallEntry) {
        wallEntry = { id: genId("wall"), start: wall.start, end: wall.end, thickness: 0.5, height: 10, kind: "interior" };
        walls = [...existingWalls, wallEntry];
      }
      const openingId = genId("opening");
      const opening = { id: openingId, wallId: wallEntry.id, kind, offset, width: selectedOpeningPreset };
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex ? { ...level, walls, openings: [...level.openings, opening] } : level
        ),
      };
      pushPlan(next);
      setSelection({ type: "opening", id: openingId });
      setStatus(`Added ${kind === "door" ? "a door" : "a window"} (${selectedOpeningPreset} ${plan.units})`);
    },
    [plan, pushPlan, setStatus, levelIndex, selectedOpeningPreset]
  );

  const moveOpening = useCallback(
    (openingId: string, offset: number) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex
            ? {
                ...level,
                openings: level.openings.map((o) => (o.id === openingId ? { ...o, offset } : o)),
              }
            : level
        ),
      };
      pushPlan(next);
      setStatus("Repositioned opening along wall");
    },
    [plan, levelIndex, pushPlan, setStatus]
  );

  const deleteSelected = useCallback(() => {
    if (!plan || !selection) return;
    if (selection.type === "room") {
      const name = plan.levels[levelIndex]?.rooms.find((r) => r.id === selection.id)?.name ?? "room";
      pushPlan({
        ...plan,
        levels: plan.levels.map((level) => ({ ...level, rooms: level.rooms.filter((r) => r.id !== selection.id) })),
      });
      setStatus(`Deleted ${name}`);
    } else if (selection.type === "wall") {
      pushPlan({
        ...plan,
        levels: plan.levels.map((level) => ({
          ...level,
          walls: level.walls.filter((w) => w.id !== selection.id),
          openings: level.openings.filter((o) => o.wallId !== selection.id),
        })),
      });
      setStatus("Deleted wall");
    } else if (selection.type === "opening") {
      pushPlan({
        ...plan,
        levels: plan.levels.map((level) => ({ ...level, openings: level.openings.filter((o) => o.id !== selection.id) })),
      });
      setStatus("Deleted opening");
    }
    setSelection(null);
  }, [plan, selection, pushPlan, setStatus, levelIndex]);

  const duplicateSelectedRoom = useCallback(() => {
    if (!plan || selection?.type !== "room") return;
    const room = plan.levels[levelIndex]?.rooms.find((r) => r.id === selection.id);
    if (!room) return;
    const id = genId("room");
    const copy = { ...room, id, name: `${room.name} copy`, polygon: room.polygon.map(([x, y]) => [x + 2, y + 2] as [number, number]) };
    pushPlan({
      ...plan,
      levels: plan.levels.map((level, i) => (i === levelIndex ? { ...level, rooms: [...level.rooms, copy] } : level)),
    });
    setSelection({ type: "room", id });
    setStatus(`Duplicated ${room.name}`);
  }, [plan, selection, pushPlan, setStatus, levelIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (e.code === "Space" && !typing) {
        setSpaceHeld(true);
        return;
      }
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selection?.type === "room") {
        e.preventDefault();
        duplicateSelectedRoom();
        return;
      }
      if (e.key === "Escape") {
        setMode("select");
        setHandTool(false);
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case "v":
          setMode("select");
          break;
        case "r":
          setMode("room");
          break;
        case "w":
          setMode("wall");
          break;
        case "m":
          setMode("measure");
          break;
        case "h":
          setHandTool((h) => !h);
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [undo, redo, selection, deleteSelected, duplicateSelectedRoom]);

  const handleExport = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `${isDemo ? "demo" : params.projectId}-floor-plan.png`;
    link.href = uri;
    link.click();
    setStatus("Exported floor plan as PNG");
  };

  const selectedRoom = useMemo(
    () => (selection?.type === "room" ? plan?.levels[levelIndex]?.rooms.find((r) => r.id === selection.id) ?? null : null),
    [plan, selection, levelIndex]
  );
  const selectedWall = useMemo(
    () => (selection?.type === "wall" ? plan?.levels[levelIndex]?.walls.find((w) => w.id === selection.id) ?? null : null),
    [plan, selection, levelIndex]
  );
  const selectedOpening = useMemo(
    () => (selection?.type === "opening" ? plan?.levels[levelIndex]?.openings.find((o) => o.id === selection.id) ?? null : null),
    [plan, selection, levelIndex]
  );

  const issues = useMemo(() => (plan ? validateDesign(plan) : []), [plan]);

  const totalBuiltUpArea = useMemo(() => {
    if (!plan) return 0;
    return plan.levels.reduce((sum, lv) => {
      return (
        sum +
        lv.rooms.reduce((rSum, r) => {
          return rSum + polygonArea(r.polygon as [number, number][]);
        }, 0)
      );
    }, 0);
  }, [plan]);

  const currentLevelArea = useMemo(() => {
    if (!plan) return 0;
    const lv = plan.levels[levelIndex];
    if (!lv) return 0;
    return lv.rooms.reduce((rSum, r) => rSum + polygonArea(r.polygon as [number, number][]), 0);
  }, [plan, levelIndex]);

  const plotArea = plan ? plan.plot.width * plan.plot.length : 0;
  const coveragePercent = plotArea > 0 ? Math.min(100, Math.round((currentLevelArea / plotArea) * 100)) : 0;

  const resizePlot = (dimension: "width" | "length", value: string) => {
    const num = Number(value);
    if (!plan || !Number.isFinite(num) || num <= 0 || num === plan.plot[dimension]) return;
    pushPlan({ ...plan, plot: { ...plan.plot, [dimension]: num } });
    setStatus(`Plot ${dimension} set to ${num} ${plan.units}`);
  };

  const renameSelectedRoom = (value: string) => {
    if (!plan || !selectedRoom || !value.trim() || value === selectedRoom.name) return;
    pushPlan({
      ...plan,
      levels: plan.levels.map((level) => ({
        ...level,
        rooms: level.rooms.map((room) => (room.id === selectedRoom.id ? { ...room, name: value.trim() } : room)),
      })),
    });
    setStatus(`Renamed room to "${value.trim()}"`);
  };

  const changeRoomType = (newType: RoomType) => {
    if (!plan || !selectedRoom || selectedRoom.type === newType) return;
    pushPlan({
      ...plan,
      levels: plan.levels.map((level) => ({
        ...level,
        rooms: level.rooms.map((room) => (room.id === selectedRoom.id ? { ...room, type: newType } : room)),
      })),
    });
    setStatus(`Changed room type to ${newType}`);
  };

  const setRoomDimension = (dimension: "width" | "depth", value: string) => {
    if (!plan || !selectedRoom) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1) return;
    const b = roomBoundsOf(selectedRoom.polygon);
    const polygon: [number, number][] =
      dimension === "width"
        ? [[b.minX, b.minY], [b.minX + num, b.minY], [b.minX + num, b.maxY], [b.minX, b.maxY]]
        : [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.minY + num], [b.minX, b.minY + num]];
    resizeRoom(selectedRoom.id, polygon);
  };

  const setWallProperty = (property: "thickness" | "height", value: string) => {
    if (!plan || !selectedWall) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    pushPlan({
      ...plan,
      levels: plan.levels.map((level) => ({
        ...level,
        walls: level.walls.map((w) => (w.id === selectedWall.id ? { ...w, [property]: num } : w)),
      })),
    });
    setStatus(`Wall ${property} set to ${num} ${plan.units}`);
  };

  const setWallKind = (kind: "interior" | "exterior") => {
    if (!plan || !selectedWall || selectedWall.kind === kind) return;
    pushPlan({
      ...plan,
      levels: plan.levels.map((level) => ({
        ...level,
        walls: level.walls.map((w) => (w.id === selectedWall.id ? { ...w, kind } : w)),
      })),
    });
    setStatus(`Wall type set to ${kind}`);
  };

  const setWallLengthNumeric = (val: string) => {
    if (!plan || !selectedWall) return;
    const targetLen = Number(val);
    if (!Number.isFinite(targetLen) || targetLen < 0.5) return;
    const dx = selectedWall.end[0] - selectedWall.start[0];
    const dy = selectedWall.end[1] - selectedWall.start[1];
    const curLen = Math.hypot(dx, dy) || 1;
    const ux = dx / curLen;
    const uy = dy / curLen;
    const newEnd: [number, number] = [
      Math.round((selectedWall.start[0] + ux * targetLen) * 100) / 100,
      Math.round((selectedWall.start[1] + uy * targetLen) * 100) / 100,
    ];
    updateWall(selectedWall.id, selectedWall.start, newEnd);
  };

  const setOpeningWidth = (value: string) => {
    if (!plan || !selectedOpening) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    pushPlan({
      ...plan,
      levels: plan.levels.map((level) => ({
        ...level,
        openings: level.openings.map((o) => (o.id === selectedOpening.id ? { ...o, width: num } : o)),
      })),
    });
    setStatus(`${selectedOpening.kind === "door" ? "Door" : "Window"} width set to ${num} ${plan.units}`);
  };

  const setOpeningOffsetNumeric = (value: string) => {
    if (!plan || !selectedOpening) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    moveOpening(selectedOpening.id, num);
  };

  if (loadError) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text" />
          </Link>
        </header>
        <div className="error-state" style={{ margin: 40 }}>
          <h3>Couldn&apos;t load this project</h3>
          <p>{loadError}</p>
          <Link className="button" href="/">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <Link href="/" className="brand">
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text" />
          </Link>
        </header>
        <div style={{ padding: 40 }} className="muted">Loading project…</div>
      </main>
    );
  }

  const panEnabled = handTool || spaceHeld;
  const currentToolLabel = panEnabled
    ? "Pan (dragging canvas)"
    : mode === "room"
    ? `Add room (${ROOM_TYPES.find((t) => t.value === roomType)?.label})`
    : mode === "wall"
    ? "Draw Wall"
    : mode === "door"
    ? `Add Door (${selectedOpeningPreset} ${plan.units})`
    : mode === "window"
    ? `Add Window (${selectedOpeningPreset} ${plan.units})`
    : mode === "measure"
    ? "Measure Distance"
    : "Select & Move";

  const selectedBounds = selectedRoom ? roomBoundsOf(selectedRoom.polygon) : null;
  const areaSqUnits = selectedRoom ? polygonArea(selectedRoom.polygon as [number, number][]) : 0;
  const areaSqFt = plan.units === "ft" ? areaSqUnits : areaSqUnits * 10.7639;
  const areaSqM = plan.units === "m" ? areaSqUnits : areaSqUnits * 0.092903;
  const perimeter = selectedRoom ? polygonPerimeter(selectedRoom.polygon as [number, number][]) : 0;
  const wallLength = selectedWall ? Math.hypot(selectedWall.end[0] - selectedWall.start[0], selectedWall.end[1] - selectedWall.start[1]) : 0;

  return (
    <main className="app-shell studio-shell">
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <Link href="/" className="studio-back-btn" title="Back to Dashboard">
            <ArrowLeft size={16} />
          </Link>
          <div className="studio-breadcrumb">
            <Link href="/" className="studio-crumb">Projects</Link>
            <span className="studio-crumb-sep">/</span>
            <span className="studio-crumb-curr">{plan.projectId}</span>
          </div>
          <span className={`save-pill-indicator${saving ? " saving" : ""}`}>
            {saving ? <RotateCcw size={11} className="spin" /> : <Check size={11} />}
            {saving ? "Saving…" : "All changes saved"}
          </span>
        </div>

        <div className="studio-topbar-actions">
          <button className="button" onClick={() => setShowVersionModal(true)} title="Save or restore named versions">
            <History size={14} /> Version History ({savedVersions.length})
          </button>
          <button className="button" onClick={() => setShowExportModal(true)} title="Export 2D Floor Plan (PNG, PDF, SVG) and 3D Models (GLB, OBJ)">
            <Download size={14} /> Export
          </button>
          <button className="button" onClick={handleRestoreOriginal} title="Reset to initial layout">
            <RotateCcw size={14} /> Reset
          </button>
          <button className="button primary" onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? "Saving…" : "Save Design"}
          </button>
        </div>
      </header>

      <div className="studio-layout">
        {/* Left Sidebar: Tools & Room Presets */}
        <aside className="studio-sidebar">
          <div className="eyebrow"><Square size={11} /> 2D Tools</div>

          <button
            className={`room-item${mode === "select" && !panEnabled ? " active" : ""}`}
            onClick={() => { setMode("select"); setHandTool(false); }}
            title="Select & Move (V)"
          >
            <MousePointer2 size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Select & Move (V)
          </button>

          <button
            className={`room-item${mode === "room" && !panEnabled ? " active" : ""}`}
            onClick={() => { setMode("room"); setHandTool(false); }}
            title="Add Room (R)"
          >
            <Plus size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Add Room (R)
          </button>

          <button
            className={`room-item${mode === "wall" && !panEnabled ? " active" : ""}`}
            onClick={() => { setMode("wall"); setHandTool(false); }}
            title="Draw Wall (W)"
          >
            <Minus size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Draw Wall (W)
          </button>

          <button
            className={`room-item${(mode === "door" || mode === "window") && !panEnabled ? " active" : ""}`}
            onClick={() => { setMode(openingKind); setHandTool(false); }}
            title="Doors & Windows"
          >
            <DoorOpen size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Doors & Windows
          </button>

          <button
            className={`room-item${mode === "measure" && !panEnabled ? " active" : ""}`}
            onClick={() => { setMode("measure"); setHandTool(false); }}
            title="Measure (M)"
          >
            <Ruler size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Measure Tool (M)
          </button>

          <button
            className={`room-item${handTool ? " active" : ""}`}
            onClick={() => setHandTool((h) => !h)}
            title="Pan (H), or hold Space"
          >
            <Hand size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Pan Canvas (H)
          </button>

          {/* Room Type Selector & Quick Add */}
          {mode === "room" && !panEnabled && (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ fontSize: 11, marginBottom: 6, fontWeight: 700 }}>Room Type</p>
              {ROOM_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`room-item${roomType === t.value ? " active" : ""}`}
                  onClick={() => setRoomType(t.value)}
                  style={{ padding: "8px 10px", margin: "4px 0" }}
                >
                  {t.label}
                </button>
              ))}

              <p className="muted" style={{ fontSize: 11, margin: "10px 0 4px", fontWeight: 700 }}>Quick 1-Click Add</p>
              <div className="chip-group">
                {ROOM_TYPES.map((t) => (
                  <button
                    key={`quick-${t.value}`}
                    className="chip-btn"
                    onClick={() => quickAddRoom(t.value, t.defaultSize)}
                    title={`Click to add ${t.label} (${t.defaultSize[0]}×${t.defaultSize[1]} ${plan.units})`}
                  >
                    + {t.label.split(" ")[0]} ({t.defaultSize[0]}×{t.defaultSize[1]})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wall Tool Hints */}
          {mode === "wall" && !panEnabled && (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
                Click & drag to draw straight interior or exterior walls. Dragging snaps to the {gridSize} {plan.units} grid and other wall vertices.
              </p>
            </div>
          )}

          {/* Doors & Windows Library */}
          {(mode === "door" || mode === "window") && !panEnabled && (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ fontSize: 11, marginBottom: 6, fontWeight: 700 }}>Component Type</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 10 }}>
                <button
                  className={`room-item${openingKind === "door" ? " active" : ""}`}
                  style={{ margin: 0, padding: 8, textAlign: "center" }}
                  onClick={() => { setOpeningKind("door"); setMode("door"); }}
                >
                  <DoorOpen size={13} style={{ marginRight: 4 }} /> Door
                </button>
                <button
                  className={`room-item${openingKind === "window" ? " active" : ""}`}
                  style={{ margin: 0, padding: 8, textAlign: "center" }}
                  onClick={() => { setOpeningKind("window"); setMode("window"); }}
                >
                  <RectangleHorizontal size={13} style={{ marginRight: 4 }} /> Window
                </button>
              </div>

              <p className="muted" style={{ fontSize: 11, marginBottom: 5, fontWeight: 700 }}>Component Library</p>
              <div className="opening-preset-grid">
                {OPENING_PRESETS[openingKind].map((preset) => (
                  <button
                    key={preset.label}
                    className={`opening-preset-card${selectedOpeningPreset === preset.width ? " active" : ""}`}
                    onClick={() => setSelectedOpeningPreset(preset.width)}
                  >
                    <span>{preset.label}</span>
                    <span className="opening-width-pill">{preset.width} {plan.units}</span>
                  </button>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Click near any wall edge or room border to place. Selected openings can be dragged along the wall.
              </p>
            </div>
          )}

          <div className="grid-controls">
            <label className="grid-toggle">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Show Grid
            </label>
            <label className="grid-size">
              Snap Step ({plan.units})
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="field"
                value={gridSize}
                onChange={(e) => setGridSize(Math.max(0.1, Number(e.target.value) || 0.5))}
              />
            </label>
          </div>

          {/* Validation Panel */}
          {issues.length > 0 && (
            <div className="validation-panel">
              <div className="validation-header">
                <AlertTriangle size={13} /> {issues.length} {issues.length === 1 ? "Issue" : "Issues"} Detected
              </div>
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  className={`validation-item ${issue.severity}`}
                  onClick={() => {
                    if (issue.roomId) selectRoomAnyFloor(issue.roomId);
                    else if (issue.wallId) setSelection({ type: "wall", id: issue.wallId });
                  }}
                  title={issue.fixSuggestion ? `Fix suggestion: ${issue.fixSuggestion}` : undefined}
                >
                  <div>{issue.message}</div>
                  {issue.fixSuggestion && (
                    <div style={{ fontSize: 9.5, opacity: 0.85, marginTop: 2 }}>💡 {issue.fixSuggestion}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Center Canvas Shell */}
        <section className="studio-main">
          {/* Floor Tabs with Multi-Floor Controls */}
          <div className="floor-tabs" role="tablist" aria-label="Floor Tabs">
            {plan.levels.map((lv, i) => {
              const isHidden = hiddenLevels.has(i);
              return (
                <div key={lv.id} className="floor-tab-wrapper">
                  <button
                    role="tab"
                    aria-selected={i === levelIndex}
                    className={`floor-tab${i === levelIndex ? " active" : ""}`}
                    onClick={() => switchLevel(i)}
                    title={`Switch to ${floorName(i)}`}
                  >
                    {floorShortName(i)}
                    <small>{lv.rooms.length} rooms</small>
                    {isHidden && <span className="floor-hide-badge">Hidden 3D</span>}
                  </button>

                  {/* Quick toggle hide */}
                  <button
                    className="floor-more-btn"
                    onClick={(e) => { e.stopPropagation(); toggleHideFloor(i); }}
                    title={isHidden ? "Restore in 3D" : "Hide in 3D (preserves data)"}
                  >
                    {isHidden ? <EyeOff size={11} color="#B45309" /> : <Eye size={11} />}
                  </button>

                  {/* Delete upper floor */}
                  {i > 0 && (
                    <button
                      className="floor-more-btn"
                      onClick={(e) => { e.stopPropagation(); deleteFloor(i); }}
                      title={`Permanently delete ${floorName(i)}`}
                    >
                      <Trash2 size={11} color="#DC2626" />
                    </button>
                  )}
                </div>
              );
            })}

            {plan.levels.length < 4 && (
              <>
                <button className="floor-tab add" onClick={addFloor} title="Add empty upper floor">
                  <Plus size={13} /> Add Floor
                </button>
                <button className="floor-tab add" onClick={duplicateFloor} title="Duplicate current floor layout to floor above">
                  <Copy size={13} /> Duplicate Floor
                </button>
              </>
            )}
          </div>

          {/* Studio Actions Bar */}
          <div className="tool-row">
            <button className="tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> Undo
            </button>
            <button className="tool" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> Redo
            </button>
            <button className="tool" onClick={resetView} title="Reset zoom and center view">
              <RotateCcw size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> Reset View
            </button>
            <button className="tool" onClick={fitToPlan} title="Fit entire plot in view">
              <Maximize2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> Fit to Plot
            </button>
            <button
              className={`tool${split3d ? " active" : ""}`}
              onClick={() => setSplit3d((s) => !s)}
              aria-pressed={split3d}
              title="Show live synchronized 3D view side-by-side"
            >
              <SquareSplitHorizontal size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Split 3D View
            </button>
            <button
              className="tool"
              onClick={() => setShowInteriorModal(true)}
              title="Furnish & style rooms with realistic 3D furniture"
              style={{ color: "#7C3AED", fontWeight: 600 }}
            >
              <Paintbrush size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Interior
            </button>
            <button
              className="tool"
              onClick={() => setShowDesignWizard(true)}
              title="Select architectural layouts and explore designs"
              style={{ color: "#7B68EE", fontWeight: 600 }}
            >
              <Sparkles size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Layout Suggestions
            </button>
            <button
              className="tool"
              onClick={() => setShowAnalysisModal(true)}
              title="Sunlight, Ventilation & Vastu architectural analysis"
              style={{ color: "#D97706", fontWeight: 600 }}
            >
              <SunMedium size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Sun & Vastu
            </button>
            <button
              className="tool"
              onClick={() => router.push(`/studio/${params.projectId}/3d`)}
              title="Full 3D Walkthrough & Architectural View"
            >
              <Box size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              3D Walkthrough
            </button>

            <div className="zoom-control">
              <button className="zoom-btn" onClick={zoomOut} disabled={zoom <= 0.4} aria-label="Zoom out"><Minus size={13} /></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button className="zoom-btn" onClick={zoomIn} disabled={zoom >= 2.5} aria-label="Zoom in"><Plus size={13} /></button>
            </div>
          </div>

          {/* Interactive Canvas Area */}
          <div className={`canvas-area${split3d ? " split" : ""}`}>
            <div className="canvas-shell">
              <FloorPlanCanvas
                ref={stageRef}
                plan={plan}
                levelIndex={levelIndex}
                selection={selection}
                onSelect={setSelection}
                onMoveRoom={moveRoom}
                onResizeRoom={resizeRoom}
                zoom={zoom}
                onZoomChange={setZoom}
                mode={mode}
                showGrid={showGrid}
                gridSize={gridSize}
                panEnabled={panEnabled}
                onAddRoom={addRoom}
                onAddWall={addWall}
                onUpdateWall={updateWall}
                onAddOpening={addOpening}
                onMoveOpening={moveOpening}
                onMeasure={setMeasureDistance}
                onSelectFurniture={setSelectedFurnitureId}
                onMoveFurniture={handleMoveFurniture}
              />
            </div>

            {split3d && (
              <div className="split-3d">
                <div className="split-3d-bar">
                  <span>Live 3D · updates synchronously with every edit</span>
                  <button
                    className={`tool${cutaway3d ? " active" : ""}`}
                    onClick={() => setCutaway3d((c) => !c)}
                    aria-pressed={cutaway3d}
                  >
                    <Scissors size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    Cutaway
                  </button>
                </div>
                <HouseScene
                  plan={plan}
                  view="isometric"
                  showGrid={false}
                  cutaway={cutaway3d}
                  topLevel={levelIndex}
                  hiddenLevels={hiddenLevels}
                  sunPosition={liveSunPosition}
                  selectedRoomId={selection?.type === "room" ? selection.id : null}
                  onSelectRoom={selectRoomAnyFloor}
                />
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="status-bar">
            <span>Plot: {plan.plot.width} × {plan.plot.length} {plan.units} ({plotArea} {plan.units}²)</span>
            <span>Floor: {floorName(levelIndex)} ({currentLevelArea.toFixed(0)} {plan.units}² · {coveragePercent}% coverage)</span>
            <span>Total Built-up: {totalBuiltUpArea.toFixed(0)} {plan.units}²</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            {mode === "measure" && measureDistance !== null && (
              <span style={{ color: "#E0631E", fontWeight: 700 }}>
                Measured: {measureDistance.toFixed(2)} {plan.units}
              </span>
            )}
            {issues.length > 0 && (
              <span className="status-issue">
                <AlertTriangle size={12} /> {issues.length} {issues.length === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
        </section>

        {/* Right Sidebar: Contextual Properties Panel */}
        <aside className="studio-sidebar properties">
          <div className="eyebrow">Properties</div>

          {/* Room Selection Properties */}
          {selectedRoom && selectedBounds && (
            <>
              <h3>Room Settings</h3>
              <label>
                Room Name
                <input
                  className="field"
                  key={`room-name-${selectedRoom.id}-${selectedRoom.name}`}
                  defaultValue={selectedRoom.name}
                  onBlur={(e) => renameSelectedRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>

              <label>
                Room Classification
                <select
                  className="field"
                  value={selectedRoom.type}
                  onChange={(e) => changeRoomType(e.target.value as RoomType)}
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <div className="dual-field">
                <label>
                  Width ({plan.units})
                  <input
                    className="field"
                    type="number"
                    min="1"
                    step="0.5"
                    key={`w-${selectedRoom.id}-${selectedBounds.maxX - selectedBounds.minX}`}
                    defaultValue={(selectedBounds.maxX - selectedBounds.minX).toFixed(1)}
                    onBlur={(e) => setRoomDimension("width", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
                <label>
                  Depth ({plan.units})
                  <input
                    className="field"
                    type="number"
                    min="1"
                    step="0.5"
                    key={`d-${selectedRoom.id}-${selectedBounds.maxY - selectedBounds.minY}`}
                    defaultValue={(selectedBounds.maxY - selectedBounds.minY).toFixed(1)}
                    onBlur={(e) => setRoomDimension("depth", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
              </div>

              <label>
                Room Floor Area
                <input
                  className="field"
                  value={`${areaSqFt.toFixed(1)} sq ft (${areaSqM.toFixed(1)} m²)`}
                  readOnly
                />
              </label>

              <div className="room-actions">
                <button className="button" onClick={duplicateSelectedRoom}><Copy size={14} /> Duplicate</button>
                <button className="button danger" onClick={deleteSelected}><Trash2 size={14} /> Delete</button>
              </div>

              <div style={{ height: 12 }} />
            </>
          )}

          {/* Wall Selection Properties */}
          {selectedWall && (
            <>
              <h3>Wall Settings</h3>
              <label>
                Wall Length ({plan.units})
                <input
                  className="field"
                  type="number"
                  min="0.5"
                  step="0.5"
                  key={`wall-len-${selectedWall.id}-${wallLength.toFixed(2)}`}
                  defaultValue={wallLength.toFixed(1)}
                  onBlur={(e) => setWallLengthNumeric(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>

              <div className="dual-field">
                <label>
                  Thickness ({plan.units})
                  <input
                    className="field"
                    type="number"
                    min="0.1"
                    step="0.1"
                    key={`thick-${selectedWall.id}-${selectedWall.thickness}`}
                    defaultValue={selectedWall.thickness}
                    onBlur={(e) => setWallProperty("thickness", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
                <label>
                  Height ({plan.units})
                  <input
                    className="field"
                    type="number"
                    min="1"
                    key={`height-${selectedWall.id}-${selectedWall.height}`}
                    defaultValue={selectedWall.height}
                    onBlur={(e) => setWallProperty("height", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
              </div>

              <label>
                Wall Type
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "4px 0 10px" }}>
                  <button
                    className={`chip-btn${selectedWall.kind === "interior" ? " active" : ""}`}
                    style={{ justifyContent: "center", padding: "6px" }}
                    onClick={() => setWallKind("interior")}
                  >
                    Interior
                  </button>
                  <button
                    className={`chip-btn${selectedWall.kind === "exterior" ? " active" : ""}`}
                    style={{ justifyContent: "center", padding: "6px" }}
                    onClick={() => setWallKind("exterior")}
                  >
                    Exterior
                  </button>
                </div>
              </label>

              <div className="room-actions">
                <button className="button" onClick={() => splitWall(selectedWall.id)} title="Split into two wall segments">
                  <Split size={14} /> Split Wall
                </button>
                <button className="button danger" onClick={deleteSelected}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              <div style={{ height: 12 }} />
            </>
          )}

          {/* Opening Selection Properties */}
          {selectedOpening && (
            <>
              <h3>{selectedOpening.kind === "door" ? "Door Settings" : "Window Settings"}</h3>
              <label>
                Width ({plan.units})
                <input
                  className="field"
                  type="number"
                  min="0.5"
                  step="0.5"
                  key={`opening-w-${selectedOpening.id}-${selectedOpening.width}`}
                  defaultValue={selectedOpening.width}
                  onBlur={(e) => setOpeningWidth(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>

              <label>
                Offset Along Wall ({plan.units})
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.25"
                  key={`opening-offset-${selectedOpening.id}-${selectedOpening.offset}`}
                  defaultValue={selectedOpening.offset.toFixed(1)}
                  onBlur={(e) => setOpeningOffsetNumeric(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>

              <div className="room-actions">
                <button className="button danger" onClick={deleteSelected}>
                  <Trash2 size={14} /> Delete {selectedOpening.kind}
                </button>
              </div>

              <div style={{ height: 12 }} />
            </>
          )}

          {/* Overall Plan Settings */}
          <h3>Plot Settings</h3>
          <label>
            Plot Width ({plan.units})
            <input
              className="field"
              type="number"
              min="1"
              key={`width-${plan.metadata.version}-${plan.plot.width}`}
              defaultValue={plan.plot.width}
              onBlur={(e) => resizePlot("width", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
          <label>
            Plot Length ({plan.units})
            <input
              className="field"
              type="number"
              min="1"
              key={`length-${plan.metadata.version}-${plan.plot.length}`}
              defaultValue={plan.plot.length}
              onBlur={(e) => resizePlot("length", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>

          <label>
            Active Tool
            <input className="field" value={currentToolLabel} readOnly />
          </label>

          <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            • Select a room to resize or duplicate.<br />
            • Select a wall to drag its endpoints or split it.<br />
            • Select a door or window to slide along its wall.<br />
            • Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z) at any time.
          </p>
        </aside>
      </div>

      {/* Version History Modal */}
      {showVersionModal && (
        <div className="nexora-modal-overlay">
          <div className="nexora-modal-card">
            <div className="nexora-modal-header">
              <h3>Design Version History</h3>
              <button className="icon-button" onClick={() => setShowVersionModal(false)}><X size={16} /></button>
            </div>
            <div className="nexora-modal-body">
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: "#47406E", margin: "0 0 8px", fontWeight: 600 }}>
                  Save Current Design Version
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="field"
                    style={{ margin: 0 }}
                    placeholder="e.g. Master Bedroom Extended, Open Living V2"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveNamedVersion()}
                  />
                  <button className="button primary" onClick={handleSaveNamedVersion}>
                    <Plus size={14} /> Save Version
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: "#EAE6F2", margin: "14px 0" }} />

              <p style={{ fontSize: 13, color: "#47406E", margin: "0 0 10px", fontWeight: 600 }}>
                Saved Versions ({savedVersions.length})
              </p>

              {savedVersions.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                  No named versions saved yet. Create a snapshot version above to bookmark key layout stages.
                </div>
              ) : (
                savedVersions.map((v) => (
                  <div key={v.id} className="version-item-card">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>{v.name}</div>
                      <div className="version-meta">
                        <Clock size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                        {new Date(v.timestamp).toLocaleString()} · {v.plan.levels.length} floor{v.plan.levels.length > 1 ? "s" : ""} · {v.plan.levels[0]?.rooms.length ?? 0} rooms
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="button" onClick={() => handleRestoreVersion(v)}>
                        Restore
                      </button>
                      <button className="icon-button" onClick={() => handleDeleteVersion(v.id)} title="Delete version">
                        <Trash2 size={13} color="#DC2626" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="nexora-modal-footer">
              <button className="button" onClick={() => setShowVersionModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Architectural Design Wizard Modal */}
      <DesignWizardModal
        isOpen={showDesignWizard}
        onClose={() => setShowDesignWizard(false)}
        currentPlan={plan}
        onApplyPlan={handleApplyWizardPlan}
        onSaveAsNew={handleSaveAsNew}
        onRestoreOriginal={handleRestoreOriginal}
        canRestoreOriginal={Boolean(originalPlanRef.current)}
        direct3dUrl={`/studio/${params.projectId}/3d`}
      />

      {/* Interior Designer Modal */}
      <InteriorDesignerModal
        isOpen={showInteriorModal}
        onClose={() => setShowInteriorModal(false)}
        plan={plan}
        onUpdatePlan={(updated) => {
          pushPlan(updated);
          setStatus("Updated room interior & furniture");
        }}
        initialRoomId={selection?.type === "room" ? selection.id : null}
        selectedFurnitureId={selectedFurnitureId}
        onSelectFurniture={setSelectedFurnitureId}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      {/* Sunlight, Ventilation & Vastu Architectural Analysis Modal */}
      <ArchitecturalAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        plan={plan}
        onUpdateSunPosition={setLiveSunPosition}
      />

      {/* 2D & 3D Architectural Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        plan={plan}
        activeLevelIndex={levelIndex}
        initialTab="2d"
      />
    </main>
  );
}
