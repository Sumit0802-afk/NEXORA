"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Copy,
  DoorOpen,
  Download,
  FileText,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Square,
  SquareSplitHorizontal,
  Trash2,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { FloorPlanCanvas, OPENING_WIDTH, type FloorPlanMode, type Selection } from "@/components/editor/FloorPlanCanvas";
import { usePlanContext } from "./plan-context";
import { polygonArea, polygonPerimeter } from "@/lib/geometry";
import { validateDesign } from "@/lib/validation";
import { floorName, floorShortName } from "@/lib/floors";
import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import type Konva from "konva";

// The 3D renderer (three.js) loads only when the split view is opened.
const HouseScene = dynamic(() => import("@/components/viewer/HouseScene").then((m) => m.HouseScene), {
  ssr: false,
  loading: () => <div className="split-3d-loading">Loading 3D…</div>,
});

const ROOM_TYPES: { label: string; value: RoomType }[] = [
  { label: "Living room", value: "living_room" },
  { label: "Bedroom", value: "bedroom" },
  { label: "Kitchen", value: "kitchen" },
  { label: "Bathroom", value: "bathroom" },
];

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

  const [mode, setMode] = useState<FloorPlanMode>("select");
  const [roomType, setRoomType] = useState<RoomType>("bedroom");
  const [openingKind, setOpeningKind] = useState<"door" | "window">("door");
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

  /** Selects a room on whichever floor holds it (3D clicks and validation can point at any floor). */
  const selectRoomAnyFloor = useCallback(
    (id: string | null) => {
      if (!id || !plan) return setSelection(null);
      const index = plan.levels.findIndex((lv) => lv.rooms.some((r) => r.id === id));
      if (index >= 0) setLevelIndex(index);
      setSelection({ type: "room", id });
    },
    [plan]
  );

  const addFloor = useCallback(() => {
    if (!plan || plan.levels.length >= 4) return;
    const top = plan.levels[plan.levels.length - 1];
    const ids = ["ground", "first", "second", "third"];
    const id = ids[plan.levels.length] ?? `level-${plan.levels.length}`;
    // Carry the staircase up so the new floor is reachable; everything else starts empty.
    const stairs = top.rooms
      .filter((r) => r.type === "staircase")
      .map((r) => ({ ...r, id: `${id}-${r.id.replace(/^[a-z]+-(?=room-)/, "")}` }));
    const level = { id, elevation: top.elevation + top.wallHeight, wallHeight: top.wallHeight, rooms: stairs, walls: [], openings: [], furniture: [] };
    pushPlan({ ...plan, plot: { ...plan.plot, floors: plan.levels.length + 1 }, levels: [...plan.levels, level] });
    setLevelIndex(plan.levels.length);
    setSelection(null);
    setStatus(`Added ${floorName(plan.levels.length)}`);
  }, [plan, pushPlan, setStatus]);

  const moveRoom = useCallback(
    (roomId: string, dx: number, dy: number) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level) => ({
          ...level,
          rooms: level.rooms.map((room) =>
            room.id === roomId
              ? { ...room, polygon: room.polygon.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
              : room
          ),
        })),
      };
      pushPlan(next);
      setStatus(`Moved ${roomId}`);
    },
    [plan, pushPlan, setStatus, levelIndex]
  );

  const resizeRoom = useCallback(
    (roomId: string, polygon: [number, number][]) => {
      if (!plan) return;
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level) => ({
          ...level,
          rooms: level.rooms.map((room) => (room.id === roomId ? { ...room, polygon } : room)),
        })),
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
      const opening = { id: openingId, wallId: wallEntry.id, kind, offset, width: OPENING_WIDTH };
      const next: FloorPlan = {
        ...plan,
        levels: plan.levels.map((level, i) =>
          i === levelIndex ? { ...level, walls, openings: [...level.openings, opening] } : level
        ),
      };
      pushPlan(next);
      setSelection({ type: "opening", id: openingId });
      setStatus(`Added ${kind === "door" ? "a door" : "a window"}`);
    },
    [plan, pushPlan, setStatus, levelIndex]
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

  if (loadError) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <Link href="/" className="brand"><Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/></Link>
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
          <Link href="/" className="brand"><Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/></Link>
        </header>
        <div style={{ padding: 40 }} className="muted">Loading project…</div>
      </main>
    );
  }

  const panEnabled = handTool || spaceHeld;
  const currentToolLabel = panEnabled
    ? "Pan"
    : mode === "select"
    ? "Select / move"
    : mode === "room"
    ? `Room tool — ${ROOM_TYPES.find((t) => t.value === roomType)?.label}`
    : mode === "wall"
    ? "Wall tool"
    : mode === "measure"
    ? "Measure"
    : `Opening tool — ${openingKind === "door" ? "Door" : "Window"}`;

  const selectedBounds = selectedRoom ? roomBoundsOf(selectedRoom.polygon) : null;
  const area = selectedRoom ? polygonArea(selectedRoom.polygon) : 0;
  const perimeter = selectedRoom ? polygonPerimeter(selectedRoom.polygon) : 0;
  const wallLength = selectedWall ? Math.hypot(selectedWall.end[0] - selectedWall.start[0], selectedWall.end[1] - selectedWall.start[1]) : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/>
        </Link>
        <div className="top-actions">
          <span className="muted" style={{ fontSize: 12 }}>{status}</span>
          <button className="button" onClick={save} disabled={saving}>
            <Save size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="button" onClick={handleExport}>
            <Download size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            PNG
          </button>
          <Link className="button primary" href={`/studio/${params.projectId}/sheet`}>
            <FileText size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Plan sheet / PDF
          </Link>
        </div>
      </header>
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="eyebrow">Components</div>
          <h3>Build your plan</h3>
          <p className="muted" style={{ fontSize: 12 }}>Starter tools</p>
          <button className={`room-item${mode === "select" && !panEnabled ? " active" : ""}`} onClick={() => { setMode("select"); setHandTool(false); }} title="Select / move (V)">
            <MousePointer2 size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Select / move
          </button>
          <button className={`room-item${mode === "room" ? " active" : ""}`} onClick={() => { setMode("room"); setHandTool(false); }} title="Room tool (R)">
            <Square size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Room tool
          </button>
          <button className={`room-item${mode === "wall" ? " active" : ""}`} onClick={() => { setMode("wall"); setHandTool(false); }} title="Wall tool (W)">
            <Minus size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Wall tool
          </button>
          <button className={`room-item${mode === "measure" ? " active" : ""}`} onClick={() => { setMode("measure"); setHandTool(false); }} title="Measure (M)">
            <Ruler size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Measure
          </button>
          <button className={`room-item${mode === "door" || mode === "window" ? " active" : ""}`} onClick={() => { setMode(openingKind); setHandTool(false); }}>
            <DoorOpen size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Doors & windows
          </button>
          <button className={`room-item${handTool ? " active" : ""}`} onClick={() => setHandTool((h) => !h)} title="Pan (H), or hold Space">
            <Hand size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /> Pan
          </button>

          {mode === "room" && !panEnabled && (
            <>
              <div style={{ height: 12 }} />
              <p className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Room type to draw</p>
              {ROOM_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`room-item${roomType === t.value ? " active" : ""}`}
                  onClick={() => setRoomType(t.value)}
                >
                  {t.label}
                </button>
              ))}
              <p className="muted" style={{ fontSize: 11 }}>Click and drag on the canvas to draw a room of this type. Snaps to a {gridSize} {plan.units} grid.</p>
            </>
          )}

          {mode === "wall" && !panEnabled && (
            <>
              <div style={{ height: 12 }} />
              <p className="muted" style={{ fontSize: 11 }}>Click and drag to draw a standalone wall. Snaps to a {gridSize} {plan.units} grid.</p>
            </>
          )}

          {(mode === "door" || mode === "window") && !panEnabled && (
            <>
              <div style={{ height: 12 }} />
              <p className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Opening type to place</p>
              <button
                className={`room-item${openingKind === "door" ? " active" : ""}`}
                onClick={() => {
                  setOpeningKind("door");
                  setMode("door");
                }}
              >
                <DoorOpen size={14} style={{ verticalAlign: "middle", marginRight: 8 }} /> Door
              </button>
              <button
                className={`room-item${openingKind === "window" ? " active" : ""}`}
                onClick={() => {
                  setOpeningKind("window");
                  setMode("window");
                }}
              >
                <RectangleHorizontal size={14} style={{ verticalAlign: "middle", marginRight: 8 }} /> Window
              </button>
              <p className="muted" style={{ fontSize: 11 }}>Click near a room&apos;s edge to place it there.</p>
            </>
          )}

          {mode === "measure" && !panEnabled && (
            <>
              <div style={{ height: 12 }} />
              <p className="muted" style={{ fontSize: 11 }}>Click and drag on the canvas to measure a distance in {plan.units}.</p>
            </>
          )}

          {mode === "select" && !panEnabled && (
            <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
              Click a room, wall, or opening to select it. Delete removes it; Ctrl+D duplicates a selected room. Drag a selected room&apos;s corner handles to resize it.
            </p>
          )}

          {panEnabled && (
            <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Drag the canvas to pan. Release Space or click Pan again to return to the previous tool.</p>
          )}

          <div className="grid-controls">
            <label className="grid-toggle">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Show grid
            </label>
            <label className="grid-size">
              Snap ({plan.units})
              <input
                type="number"
                min="0.25"
                step="0.25"
                className="field"
                value={gridSize}
                onChange={(e) => setGridSize(Math.max(0.25, Number(e.target.value) || 0.5))}
              />
            </label>
          </div>

          {issues.length > 0 && (
            <div className="validation-panel">
              <div className="validation-header"><AlertTriangle size={14}/> {issues.length} issue{issues.length === 1 ? "" : "s"}</div>
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  className={`validation-item ${issue.severity}`}
                  onClick={() => issue.roomId && selectRoomAnyFloor(issue.roomId)}
                  disabled={!issue.roomId}
                >
                  {issue.message}
                </button>
              ))}
            </div>
          )}
        </aside>
        <section className="studio-main">
          <div className="floor-tabs" role="tablist" aria-label="Floor">
            {plan.levels.map((lv, i) => (
              <button
                key={lv.id}
                role="tab"
                aria-selected={i === levelIndex}
                className={`floor-tab${i === levelIndex ? " active" : ""}`}
                onClick={() => switchLevel(i)}
              >
                {floorShortName(i)}<small>{lv.rooms.length} rooms</small>
              </button>
            ))}
            {plan.levels.length < 4 && (
              <button className="floor-tab add" onClick={addFloor} title="Add a floor above">
                <Plus size={13}/> Add floor
              </button>
            )}
          </div>
          <div className="tool-row">
            <button className="tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Undo
            </button>
            <button className="tool" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Redo
            </button>
            <button className="tool" onClick={resetView} title="Reset zoom and pan">
              <RotateCcw size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Reset view
            </button>
            <button className="tool" onClick={fitToPlan} title="Fit the whole plot in view">
              <Maximize2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Fit to plan
            </button>
            <button className={`tool${split3d ? " active" : ""}`} onClick={() => setSplit3d((s) => !s)} aria-pressed={split3d} title="Show the live 3D model beside the plan">
              <SquareSplitHorizontal size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Split 3D
            </button>
            <Link className="tool" href={`/studio/${params.projectId}/3d`}>
              <Box size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              3D View
            </Link>
            <button className="tool" onClick={() => setStatus("smart edit workflow is not connected")}>
              <WandSparkles size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Ask smart
            </button>
            <div className="zoom-control">
              <button className="zoom-btn" onClick={zoomOut} disabled={zoom <= 0.4} aria-label="Zoom out"><Minus size={13}/></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button className="zoom-btn" onClick={zoomIn} disabled={zoom >= 2.5} aria-label="Zoom in"><Plus size={13}/></button>
            </div>
          </div>
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
              onAddOpening={addOpening}
              onMeasure={setMeasureDistance}
            />
          </div>
          {split3d && (
            <div className="split-3d">
              <div className="split-3d-bar">
                <span>Live 3D · updates as you edit</span>
                <button className={`tool${cutaway3d ? " active" : ""}`} onClick={() => setCutaway3d((c) => !c)} aria-pressed={cutaway3d}>
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
                selectedRoomId={selection?.type === "room" ? selection.id : null}
                onSelectRoom={selectRoomAnyFloor}
              />
            </div>
          )}
          </div>
          <div className="status-bar">
            <span>{plan.plot.width} × {plan.plot.length} {plan.units}</span>
            {plan.levels.length > 1 && <span>{floorName(levelIndex)}</span>}
            <span>Zoom {Math.round(zoom * 100)}%</span>
            <span>Units: {plan.units}</span>
            {mode === "measure" && measureDistance !== null && <span>Measured: {measureDistance.toFixed(1)} {plan.units}</span>}
            {issues.length > 0 && <span className="status-issue"><AlertTriangle size={12}/> {issues.length} validation issue{issues.length === 1 ? "" : "s"}</span>}
          </div>
        </section>
        <aside className="studio-sidebar properties">
          <div className="eyebrow">Properties</div>
          <h3>Plan settings</h3>
          <label>
            Plot width ({plan.units})
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
            Plot length ({plan.units})
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
            Current tool<input className="field" value={currentToolLabel} readOnly />
          </label>

          {selectedRoom && selectedBounds && (
            <>
              <label>
                Room name
                <input
                  className="field"
                  key={`room-name-${selectedRoom.id}-${selectedRoom.name}`}
                  defaultValue={selectedRoom.name}
                  onBlur={(e) => renameSelectedRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>
              <div className="dual-field">
                <label>
                  Width ({plan.units})
                  <input
                    className="field"
                    type="number"
                    min="1"
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
                    key={`d-${selectedRoom.id}-${selectedBounds.maxY - selectedBounds.minY}`}
                    defaultValue={(selectedBounds.maxY - selectedBounds.minY).toFixed(1)}
                    onBlur={(e) => setRoomDimension("depth", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
              </div>
              <label>
                Area (calculated)<input className="field" value={`${area.toFixed(1)} ${plan.units}²`} readOnly />
              </label>
              <label>
                Perimeter (calculated)<input className="field" value={`${perimeter.toFixed(1)} ${plan.units}`} readOnly />
              </label>
              <div className="room-actions">
                <button className="button" onClick={duplicateSelectedRoom}><Copy size={14}/> Duplicate</button>
                <button className="button danger" onClick={deleteSelected}><Trash2 size={14}/> Delete</button>
              </div>
            </>
          )}

          {selectedWall && (
            <>
              <label>
                Wall length (calculated)<input className="field" value={`${wallLength.toFixed(1)} ${plan.units}`} readOnly />
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
              <div className="room-actions">
                <button className="button danger" onClick={deleteSelected}><Trash2 size={14}/> Delete wall</button>
              </div>
            </>
          )}

          {selectedOpening && (
            <>
              <label>
                Type<input className="field" value={selectedOpening.kind === "door" ? "Door" : "Window"} readOnly />
              </label>
              <label>
                Position along wall<input className="field" value={`${selectedOpening.offset.toFixed(1)} ${plan.units}`} readOnly />
              </label>
              <label>
                Width ({plan.units})
                <input
                  className="field"
                  type="number"
                  min="0.5"
                  step="0.5"
                  key={`opening-width-${selectedOpening.id}-${selectedOpening.width}`}
                  defaultValue={selectedOpening.width}
                  onBlur={(e) => setOpeningWidth(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>
              <div className="room-actions">
                <button className="button danger" onClick={deleteSelected}><Trash2 size={14}/> Delete {selectedOpening.kind}</button>
              </div>
            </>
          )}

          {!selection && (
            <label>
              Selected<input className="field" value="None" readOnly />
            </label>
          )}

          <p className="muted" style={{ fontSize: 12 }}>Project: {params.projectId}</p>
          <p className="muted" style={{ fontSize: 12 }}>
            Click a room, wall, or opening to select and edit it. Edit plot or object dimensions and press Enter or click away to apply. Undo/redo tracks all of these changes.
            {isDemo ? " This is a local sandbox plan — Save does not write to the API." : " Save writes a new version to the NEXORA API, and edits autosave a couple of seconds after you stop typing or drawing."}
          </p>
        </aside>
      </div>
    </main>
  );
}
