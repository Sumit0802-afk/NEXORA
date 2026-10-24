"use client";

import { forwardRef, useEffect, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Line, Arc, Circle } from "react-konva";
import type { FloorPlan, FurnitureItem, Room, RoomType, Wall, Opening } from "@houseplan/design-schema";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { nearestWallOrEdge, snapToGrid } from "@/lib/geometry";

type RoomBounds = { minX: number; minY: number; maxX: number; maxY: number };
type Mode = "select" | "room" | "wall" | "measure" | "door" | "window";
export type Selection = { type: "room" | "wall" | "opening" | "furniture"; id: string } | null;
type HandleCorner = "nw" | "ne" | "se" | "sw";

function roomBounds(room: Room): RoomBounds {
  const xs = room.polygon.map((p) => p[0]);
  const ys = room.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const MIN_ROOM_SIZE = 3;
const EDGE_SNAP_TOLERANCE = 1.6;
const OPENING_WIDTH = 3;

const ROOM_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
  bedroom:     { fill: "#EBF1F8", stroke: "#4B6B94", label: "Bedroom" },
  living_room: { fill: "#F8F3E8", stroke: "#8B6B3E", label: "Living Room" },
  kitchen:     { fill: "#ECF4E8", stroke: "#4F7843", label: "Kitchen" },
  bathroom:    { fill: "#E2F0F4", stroke: "#3E7B8D", label: "Bathroom" },
  dining_room: { fill: "#F7EEDC", stroke: "#9C6B38", label: "Dining Room" },
  study:       { fill: "#F1EBF4", stroke: "#6E4E80", label: "Study Room" },
  corridor:    { fill: "#F3F2F7", stroke: "#656080", label: "Corridor" },
  hallway:     { fill: "#F3F2F7", stroke: "#656080", label: "Hallway" },
  balcony:     { fill: "#E2ECE5", stroke: "#3B7A58", label: "Balcony" },
  utility:     { fill: "#EFECE6", stroke: "#746E65", label: "Utility" },
  staircase:   { fill: "#EBE6DE", stroke: "#6E6254", label: "Staircase" },
  parking:     { fill: "#EAE9EE", stroke: "#5D5970", label: "Parking" },
  other:       { fill: "#EAECE8", stroke: "#5E6E60", label: "Other" },
};

export const FloorPlanCanvas = forwardRef<Konva.Stage, {
  plan: FloorPlan;
  /** Which floor to edit (0 = ground). Upper floors show the floor below as a faint outline. */
  levelIndex?: number;
  selection?: Selection;
  onSelect?: (selection: Selection) => void;
  onMoveRoom?: (roomId: string, dx: number, dy: number) => void;
  onResizeRoom?: (roomId: string, polygon: [number, number][]) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  mode?: Mode;
  showGrid?: boolean;
  gridSize?: number;
  panEnabled?: boolean;
  onAddRoom?: (polygon: [number, number][]) => void;
  onAddWall?: (start: [number, number], end: [number, number]) => void;
  onUpdateWall?: (wallId: string, start: [number, number], end: [number, number]) => void;
  onAddOpening?: (wall: { start: [number, number]; end: [number, number] }, offset: number, kind: "door" | "window") => void;
  onMoveOpening?: (openingId: string, newOffset: number) => void;
  onMeasure?: (distance: number | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  onMoveFurniture?: (id: string, x: number, y: number) => void;
}>(function FloorPlanCanvas(
  {
    plan,
    levelIndex = 0,
    selection = null,
    onSelect,
    onMoveRoom,
    onResizeRoom,
    zoom = 1,
    onZoomChange,
    mode = "select",
    showGrid = true,
    gridSize = 0.5,
    panEnabled = false,
    onAddRoom,
    onAddWall,
    onUpdateWall,
    onAddOpening,
    onMoveOpening,
    onMeasure,
    onSelectFurniture,
    onMoveFurniture,
  },
  stageRef
) {
  const scale = 10;
  const offsetX = 48;
  const offsetY = 42;
  const width = 760;
  const height = 560;
  const level = plan.levels[levelIndex] ?? plan.levels[0];
  const rooms = level?.rooms ?? [];
  const walls = level?.walls ?? [];
  const openings = level?.openings ?? [];
  const roomsBelow = levelIndex > 0 ? plan.levels[levelIndex - 1]?.rooms ?? [] : [];

  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [measureLine, setMeasureLine] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{ start: [number, number]; end: [number, number]; point: [number, number] } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [resizeDraft, setResizeDraft] = useState<RoomBounds | null>(null);
  const [wallDraft, setWallDraft] = useState<{ id: string; start: [number, number]; end: [number, number] } | null>(null);
  const [openingDraft, setOpeningDraft] = useState<{ id: string; offset: number } | null>(null);
  const [activeGuides, setActiveGuides] = useState<{ axis: "h" | "v"; pos: number }[]>([]);

  useEffect(() => {
    setDraft(null);
    setMeasureLine(null);
    setHoverEdge(null);
    setResizeDraft(null);
    setWallDraft(null);
    setOpeningDraft(null);
    setActiveGuides([]);
  }, [mode]);

  const toUnits = (stage: Konva.Stage, snap = false) => {
    const pos = stage.getRelativePointerPosition();
    if (!pos) return null;
    let x = Math.min(plan.plot.width, Math.max(0, (pos.x - offsetX) / scale));
    let y = Math.min(plan.plot.length, Math.max(0, (pos.y - offsetY) / scale));
    if (snap) {
      x = Math.min(plan.plot.width, Math.max(0, snapToGrid(x, gridSize)));
      y = Math.min(plan.plot.length, Math.max(0, snapToGrid(y, gridSize)));
    }
    return { x, y };
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = zoom;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.08;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.min(2.5, Math.max(0.4, Math.round(newScale * 100) / 100));
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    stage.position(newPos);
    stage.batchDraw();
    onZoomChange?.(newScale);
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage() as Konva.Stage;
    if (panEnabled) return;
    const point = toUnits(stage, mode === "room" || mode === "wall");
    if (!point) return;

    if (mode === "room" || mode === "wall") {
      setDraft({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
      return;
    }
    if (mode === "measure") {
      setMeasureLine({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
      onMeasure?.(0);
      return;
    }
    if (mode === "door" || mode === "window") {
      const edge = nearestWallOrEdge(
        rooms.map((r) => r.polygon),
        walls.map((w) => ({ start: w.start, end: w.end })),
        [point.x, point.y],
        EDGE_SNAP_TOLERANCE
      );
      if (edge) onAddOpening?.({ start: edge.start, end: edge.end }, edge.offset, mode);
      return;
    }
    if (e.target === stage) onSelect?.(null);
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage() as Konva.Stage;
    if ((mode === "room" || mode === "wall") && draft) {
      const point = toUnits(stage, true);
      if (point) setDraft((d) => (d ? { ...d, x1: point.x, y1: point.y } : d));
      return;
    }
    if (mode === "measure" && measureLine) {
      const point = toUnits(stage);
      if (point) {
        setMeasureLine((m) => (m ? { ...m, x1: point.x, y1: point.y } : m));
        const dx = point.x - measureLine.x0;
        const dy = point.y - measureLine.y0;
        onMeasure?.(Math.hypot(dx, dy));
      }
      return;
    }
    if (mode === "door" || mode === "window") {
      const point = toUnits(stage);
      if (!point) return;
      const edge = nearestWallOrEdge(
        rooms.map((r) => r.polygon),
        walls.map((w) => ({ start: w.start, end: w.end })),
        [point.x, point.y],
        EDGE_SNAP_TOLERANCE
      );
      setHoverEdge(edge ? { start: edge.start, end: edge.end, point: edge.point } : null);
    }
  };

  const handleStageMouseUp = () => {
    if (mode === "room" && draft) {
      const minX = Math.min(draft.x0, draft.x1);
      const minY = Math.min(draft.y0, draft.y1);
      const maxX = Math.max(draft.x0, draft.x1);
      const maxY = Math.max(draft.y0, draft.y1);
      setDraft(null);
      if (maxX - minX >= MIN_ROOM_SIZE && maxY - minY >= MIN_ROOM_SIZE) {
        onAddRoom?.([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]);
      }
      return;
    }
    if (mode === "wall" && draft) {
      const start: [number, number] = [draft.x0, draft.y0];
      const end: [number, number] = [draft.x1, draft.y1];
      setDraft(null);
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) >= 1) {
        onAddWall?.(start, end);
      }
    }
  };

  const cursor = panEnabled ? "grab" : mode === "select" ? "default" : mode === "door" || mode === "window" ? "pointer" : "crosshair";
  const draftLength = draft ? Math.hypot(draft.x1 - draft.x0, draft.y1 - draft.y0) : 0;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 580, overflow: "hidden" }}>
      <Stage
        ref={stageRef}
        width={width * zoom}
        height={height * zoom}
        scaleX={zoom}
        scaleY={zoom}
        draggable={panEnabled}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{ cursor }}
      >
        <Layer>
          {/* Plot Dimension Header */}
          <Text
            x={20}
            y={12}
            text={`Plot: ${plan.plot.width} × ${plan.plot.length} ${plan.units}`}
            fontSize={13}
            fill="#817D94"
            fontStyle="bold"
          />

          {/* Plot Boundary */}
          <Rect
            x={offsetX}
            y={offsetY}
            width={plan.plot.width * scale}
            height={plan.plot.length * scale}
            stroke="#302A65"
            strokeWidth={4}
            fill="#FFFDF7"
          />

          {/* Ghost outline of floor below */}
          {roomsBelow.map((room) => {
            const { minX, minY, maxX, maxY } = roomBounds(room);
            return (
              <Rect
                key={`below-${room.id}`}
                x={offsetX + minX * scale}
                y={offsetY + minY * scale}
                width={(maxX - minX) * scale}
                height={(maxY - minY) * scale}
                stroke="#B9B4CC"
                strokeWidth={1}
                dash={[6, 5]}
                listening={false}
              />
            );
          })}

          {/* Rooms */}
          {rooms.map((room) => {
            const isSelected = selection?.type === "room" && selection.id === room.id;
            const { minX, minY, maxX, maxY } = isSelected && resizeDraft ? resizeDraft : roomBounds(room);
            const isHovered = hoverId === room.id && mode === "select";
            const rWidth = maxX - minX;
            const rHeight = maxY - minY;
            const area = rWidth * rHeight;
            const style = ROOM_STYLES[room.type] ?? { fill: "#F0EDFA", stroke: "#5146A5", label: room.name };

            return (
              <Group key={room.id}>
                <Rect
                  x={offsetX + minX * scale}
                  y={offsetY + minY * scale}
                  width={rWidth * scale}
                  height={rHeight * scale}
                  fill={isHovered ? "#5146A530" : style.fill}
                  stroke={isSelected ? "#E0631E" : style.stroke}
                  strokeWidth={isSelected ? 3.5 : 2}
                  draggable={mode === "select" && !panEnabled}
                  onMouseEnter={() => mode === "select" && setHoverId(room.id)}
                  onMouseLeave={() => setHoverId((h) => (h === room.id ? null : h))}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (mode === "select") onSelect?.({ type: "room", id: room.id });
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    onSelect?.({ type: "room", id: room.id });
                  }}
                  onDragMove={(e) => {
                    const node = e.target as Konva.Rect;
                    const curX = (node.x() - offsetX) / scale;
                    const curY = (node.y() - offsetY) / scale;
                    // Check for alignment with other rooms
                    const guides: { axis: "h" | "v"; pos: number }[] = [];
                    for (const other of rooms) {
                      if (other.id === room.id) continue;
                      const ob = roomBounds(other);
                      if (Math.abs(ob.minX - curX) < 0.4) guides.push({ axis: "v", pos: ob.minX });
                      if (Math.abs(ob.maxX - (curX + rWidth)) < 0.4) guides.push({ axis: "v", pos: ob.maxX });
                      if (Math.abs(ob.minY - curY) < 0.4) guides.push({ axis: "h", pos: ob.minY });
                      if (Math.abs(ob.maxY - (curY + rHeight)) < 0.4) guides.push({ axis: "h", pos: ob.maxY });
                    }
                    setActiveGuides(guides);
                  }}
                  onDragEnd={(e) => {
                    const node = e.target as Konva.Rect;
                    const rawDx = (node.x() - (offsetX + minX * scale)) / scale;
                    const rawDy = (node.y() - (offsetY + minY * scale)) / scale;
                    node.position({ x: offsetX + minX * scale, y: offsetY + minY * scale });
                    setActiveGuides([]);
                    if (rawDx !== 0 || rawDy !== 0) {
                      // Clamp within plot boundaries
                      const clampedDx = Math.max(-minX, Math.min(plan.plot.width - maxX, rawDx));
                      const clampedDy = Math.max(-minY, Math.min(plan.plot.length - maxY, rawDy));
                      onMoveRoom?.(room.id, clampedDx, clampedDy);
                    }
                  }}
                />

                {/* Room Name */}
                <Text
                  x={offsetX + minX * scale + 4}
                  y={offsetY + minY * scale + Math.max(6, (rHeight * scale) / 2 - 16)}
                  text={room.name}
                  fontSize={12}
                  fontStyle="bold"
                  fill="#201C4B"
                  width={Math.max(40, rWidth * scale - 8)}
                  align="center"
                  listening={false}
                />

                {/* Dimensions & Area */}
                <Text
                  x={offsetX + minX * scale + 4}
                  y={offsetY + minY * scale + Math.max(22, (rHeight * scale) / 2 + 2)}
                  text={`${rWidth.toFixed(1)} × ${rHeight.toFixed(1)} ${plan.units} (${area.toFixed(0)} sq ${plan.units === "m" ? "m" : "ft"})`}
                  fontSize={9.5}
                  fill={isSelected ? "#E0631E" : "#5B5579"}
                  width={Math.max(40, rWidth * scale - 8)}
                  align="center"
                  listening={false}
                />
              </Group>
            );
          })}

          {/* 2D Furniture items on this level */}
          {((level?.furniture || []) as FurnitureItem[]).map((item) => {
            const isSelected = selection?.type === "furniture" && selection.id === item.id;
            const w = item.dimensions.width * (item.scale?.[0] ?? 1) * scale;
            const d = item.dimensions.depth * (item.scale?.[1] ?? 1) * scale;
            const px = offsetX + item.position[0] * scale;
            const py = offsetY + item.position[1] * scale;
            const rotDeg = ((item.rotation || 0) * 180) / Math.PI;

            return (
              <Group
                key={item.id}
                x={px}
                y={py}
                rotation={rotDeg}
                draggable={mode === "select" && !panEnabled}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (mode === "select") {
                    onSelect?.({ type: "furniture", id: item.id });
                    onSelectFurniture?.(item.id);
                  }
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  const newX = (node.x() - offsetX) / scale;
                  const newY = (node.y() - offsetY) / scale;
                  node.position({ x: px, y: py });
                  onMoveFurniture?.(item.id, newX, newY);
                }}
              >
                <Rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  fill={item.material?.color ? `${item.material.color}c0` : "#5146A540"}
                  stroke={isSelected ? "#FFD700" : "#5146A5"}
                  strokeWidth={isSelected ? 2.5 : 1}
                  cornerRadius={2}
                />
                <Text
                  x={-w / 2 + 2}
                  y={-5}
                  text={item.name}
                  fontSize={Math.max(7, Math.min(10, w / 4.5))}
                  fill="#1E1E24"
                  width={w - 4}
                  align="center"
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Standalone and Boundary Walls */}
          {walls.map((wall: Wall) => {
            const isSelected = selection?.type === "wall" && selection.id === wall.id;
            const isHovered = hoverId === wall.id && mode === "select";
            const curStart = wallDraft && wallDraft.id === wall.id ? wallDraft.start : wall.start;
            const curEnd = wallDraft && wallDraft.id === wall.id ? wallDraft.end : wall.end;
            const wallLength = Math.hypot(curEnd[0] - curStart[0], curEnd[1] - curStart[1]);

            return (
              <Group key={wall.id}>
                <Line
                  points={[
                    offsetX + curStart[0] * scale,
                    offsetY + curStart[1] * scale,
                    offsetX + curEnd[0] * scale,
                    offsetY + curEnd[1] * scale,
                  ]}
                  stroke={isSelected ? "#E0631E" : isHovered ? "#5146A5" : "#302A65"}
                  strokeWidth={isSelected ? 5 : Math.max(3.5, wall.thickness * scale * 0.45)}
                  hitStrokeWidth={18}
                  listening={mode === "select"}
                  onMouseEnter={() => setHoverId(wall.id)}
                  onMouseLeave={() => setHoverId((h) => (h === wall.id ? null : h))}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect?.({ type: "wall", id: wall.id });
                  }}
                />

                {/* Wall Length Dimension Tag */}
                {(isSelected || isHovered) && (
                  <Text
                    x={offsetX + ((curStart[0] + curEnd[0]) / 2) * scale + 6}
                    y={offsetY + ((curStart[1] + curEnd[1]) / 2) * scale - 14}
                    text={`${wallLength.toFixed(1)} ${plan.units}`}
                    fontSize={10}
                    fontStyle="bold"
                    fill={isSelected ? "#E0631E" : "#302A65"}
                    listening={false}
                  />
                )}

                {/* Draggable Wall Endpoint Handles */}
                {isSelected && mode === "select" && !panEnabled && (
                  <>
                    {/* Start Handle */}
                    <Circle
                      x={offsetX + curStart[0] * scale}
                      y={offsetY + curStart[1] * scale}
                      radius={6}
                      fill="#FFFFFF"
                      stroke="#E0631E"
                      strokeWidth={2.5}
                      draggable
                      onDragMove={(e) => {
                        const stage = e.target.getStage();
                        if (!stage) return;
                        const pt = toUnits(stage, true);
                        if (!pt) return;
                        let nx = pt.x;
                        let ny = pt.y;
                        for (const w of walls) {
                          if (w.id === wall.id) continue;
                          if (Math.hypot(w.start[0] - nx, w.start[1] - ny) < 0.6) { nx = w.start[0]; ny = w.start[1]; break; }
                          if (Math.hypot(w.end[0] - nx, w.end[1] - ny) < 0.6) { nx = w.end[0]; ny = w.end[1]; break; }
                        }
                        setWallDraft({ id: wall.id, start: [nx, ny], end: curEnd });
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        node.position({ x: offsetX + curStart[0] * scale, y: offsetY + curStart[1] * scale });
                        if (wallDraft && wallDraft.id === wall.id) {
                          onUpdateWall?.(wall.id, wallDraft.start, wallDraft.end);
                        }
                        setWallDraft(null);
                      }}
                    />

                    {/* End Handle */}
                    <Circle
                      x={offsetX + curEnd[0] * scale}
                      y={offsetY + curEnd[1] * scale}
                      radius={6}
                      fill="#FFFFFF"
                      stroke="#E0631E"
                      strokeWidth={2.5}
                      draggable
                      onDragMove={(e) => {
                        const stage = e.target.getStage();
                        if (!stage) return;
                        const pt = toUnits(stage, true);
                        if (!pt) return;
                        let nx = pt.x;
                        let ny = pt.y;
                        for (const w of walls) {
                          if (w.id === wall.id) continue;
                          if (Math.hypot(w.start[0] - nx, w.start[1] - ny) < 0.6) { nx = w.start[0]; ny = w.start[1]; break; }
                          if (Math.hypot(w.end[0] - nx, w.end[1] - ny) < 0.6) { nx = w.end[0]; ny = w.end[1]; break; }
                        }
                        setWallDraft({ id: wall.id, start: curStart, end: [nx, ny] });
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        node.position({ x: offsetX + curEnd[0] * scale, y: offsetY + curEnd[1] * scale });
                        if (wallDraft && wallDraft.id === wall.id) {
                          onUpdateWall?.(wall.id, wallDraft.start, wallDraft.end);
                        }
                        setWallDraft(null);
                      }}
                    />
                  </>
                )}
              </Group>
            );
          })}

          {/* Openings (Doors & Windows) */}
          {openings.map((opening: Opening) => {
            const wall = walls.find((w) => w.id === opening.wallId);
            if (!wall) return null;
            const dx = wall.end[0] - wall.start[0];
            const dy = wall.end[1] - wall.start[1];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const curOffset = openingDraft && openingDraft.id === opening.id ? openingDraft.offset : opening.offset;
            const cx = wall.start[0] + ux * curOffset;
            const cy = wall.start[1] + uy * curOffset;
            const half = (opening.width / 2) * scale;
            const px = offsetX + cx * scale;
            const py = offsetY + cy * scale;
            const isDoor = opening.kind === "door";
            const isSelected = selection?.type === "opening" && selection.id === opening.id;

            return (
              <Group
                key={opening.id}
                draggable={isSelected && mode === "select" && !panEnabled}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (mode === "select") onSelect?.({ type: "opening", id: opening.id });
                }}
                onDragMove={(e) => {
                  const stage = e.target.getStage();
                  if (!stage) return;
                  const pt = toUnits(stage);
                  if (!pt) return;
                  const proj = (pt.x - wall.start[0]) * ux + (pt.y - wall.start[1]) * uy;
                  const snapped = snapToGrid(proj, gridSize);
                  const clamped = Math.max(opening.width / 2, Math.min(len - opening.width / 2, snapped));
                  setOpeningDraft({ id: opening.id, offset: clamped });
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  node.position({ x: 0, y: 0 });
                  if (openingDraft && openingDraft.id === opening.id) {
                    onMoveOpening?.(opening.id, openingDraft.offset);
                  }
                  setOpeningDraft(null);
                }}
              >
                <Line
                  points={[px - ux * half, py - uy * half, px + ux * half, py + uy * half]}
                  stroke={isSelected ? "#E0631E" : isDoor ? "#FFFDF7" : "#8bbae0"}
                  strokeWidth={isDoor ? 7 : 5.5}
                  hitStrokeWidth={16}
                  listening={mode === "select"}
                />
                {isDoor && (
                  <Arc
                    x={px - ux * half}
                    y={py - uy * half}
                    innerRadius={0}
                    outerRadius={half * 2}
                    angle={90}
                    rotation={(Math.atan2(uy, ux) * 180) / Math.PI}
                    stroke={isSelected ? "#E0631E" : "#B1874F"}
                    strokeWidth={1.5}
                    listening={false}
                  />
                )}
                {/* Opening Tag when selected */}
                {isSelected && (
                  <Text
                    x={px - 20}
                    y={py - 16}
                    text={`${isDoor ? "Door" : "Window"} ${opening.width.toFixed(1)}${plan.units}`}
                    fontSize={10}
                    fontStyle="bold"
                    fill="#E0631E"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Hover placement ghost line */}
          {(mode === "door" || mode === "window") && hoverEdge && (
            <Line
              points={[
                offsetX + hoverEdge.start[0] * scale,
                offsetY + hoverEdge.start[1] * scale,
                offsetX + hoverEdge.end[0] * scale,
                offsetY + hoverEdge.end[1] * scale,
              ]}
              stroke="#E0631E"
              strokeWidth={3}
              dash={[4, 4]}
              listening={false}
            />
          )}

          {/* Draft Drawing: Room */}
          {draft && mode === "room" && (
            <Group>
              <Rect
                x={offsetX + Math.min(draft.x0, draft.x1) * scale}
                y={offsetY + Math.min(draft.y0, draft.y1) * scale}
                width={Math.abs(draft.x1 - draft.x0) * scale}
                height={Math.abs(draft.y1 - draft.y0) * scale}
                fill="#5146A520"
                stroke="#5146A5"
                dash={[6, 4]}
                strokeWidth={2}
                listening={false}
              />
              <Text
                x={offsetX + Math.min(draft.x0, draft.x1) * scale + 6}
                y={offsetY + Math.min(draft.y0, draft.y1) * scale + 6}
                text={`${Math.abs(draft.x1 - draft.x0).toFixed(1)} × ${Math.abs(draft.y1 - draft.y0).toFixed(1)} ${plan.units}`}
                fontSize={11}
                fontStyle="bold"
                fill="#5146A5"
                listening={false}
              />
            </Group>
          )}

          {/* Draft Drawing: Wall */}
          {draft && mode === "wall" && (
            <Group>
              <Line
                points={[
                  offsetX + draft.x0 * scale,
                  offsetY + draft.y0 * scale,
                  offsetX + draft.x1 * scale,
                  offsetY + draft.y1 * scale,
                ]}
                stroke="#302A65"
                strokeWidth={4.5}
                dash={[6, 4]}
                listening={false}
              />
              <Text
                x={offsetX + ((draft.x0 + draft.x1) / 2) * scale + 6}
                y={offsetY + ((draft.y0 + draft.y1) / 2) * scale - 14}
                text={`${draftLength.toFixed(1)} ${plan.units}`}
                fontSize={11}
                fontStyle="bold"
                fill="#302A65"
                listening={false}
              />
            </Group>
          )}

          {/* Measure Line */}
          {measureLine && (
            <Group>
              <Line
                points={[
                  offsetX + measureLine.x0 * scale,
                  offsetY + measureLine.y0 * scale,
                  offsetX + measureLine.x1 * scale,
                  offsetY + measureLine.y1 * scale,
                ]}
                stroke="#E0631E"
                strokeWidth={2}
                dash={[5, 3]}
                listening={false}
              />
              <Text
                x={offsetX + ((measureLine.x0 + measureLine.x1) / 2) * scale + 6}
                y={offsetY + ((measureLine.y0 + measureLine.y1) / 2) * scale - 14}
                text={`${Math.hypot(measureLine.x1 - measureLine.x0, measureLine.y1 - measureLine.y0).toFixed(1)} ${plan.units}`}
                fontSize={12}
                fontStyle="bold"
                fill="#E0631E"
                listening={false}
              />
            </Group>
          )}

          {/* Alignment Guides */}
          {activeGuides.map((guide, idx) => (
            <Line
              key={`guide-${idx}`}
              points={
                guide.axis === "v"
                  ? [offsetX + guide.pos * scale, offsetY, offsetX + guide.pos * scale, offsetY + plan.plot.length * scale]
                  : [offsetX, offsetY + guide.pos * scale, offsetX + plan.plot.width * scale, offsetY + guide.pos * scale]
              }
              stroke="#E0631E"
              strokeWidth={1.5}
              dash={[4, 4]}
              listening={false}
            />
          ))}

          {/* Room Resize Handles */}
          {selection?.type === "room" && mode === "select" && !panEnabled && (() => {
            const room = rooms.find((r) => r.id === selection.id);
            if (!room) return null;
            const bounds = resizeDraft ?? roomBounds(room);
            const corners: { key: HandleCorner; x: number; y: number }[] = [
              { key: "nw", x: bounds.minX, y: bounds.minY },
              { key: "ne", x: bounds.maxX, y: bounds.minY },
              { key: "se", x: bounds.maxX, y: bounds.maxY },
              { key: "sw", x: bounds.minX, y: bounds.maxY },
            ];
            return (
              <>
                {corners.map((c) => (
                  <Rect
                    key={c.key}
                    x={offsetX + c.x * scale - 5}
                    y={offsetY + c.y * scale - 5}
                    width={10}
                    height={10}
                    fill="#FFFFFF"
                    stroke="#E0631E"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                      const node = e.target;
                      const px = (node.x() + 5 - offsetX) / scale;
                      const py = (node.y() + 5 - offsetY) / scale;
                      const base = roomBounds(room);
                      const next = { ...base };
                      if (c.key === "nw") {
                        next.minX = Math.min(px, base.maxX - MIN_ROOM_SIZE);
                        next.minY = Math.min(py, base.maxY - MIN_ROOM_SIZE);
                      } else if (c.key === "ne") {
                        next.maxX = Math.max(px, base.minX + MIN_ROOM_SIZE);
                        next.minY = Math.min(py, base.maxY - MIN_ROOM_SIZE);
                      } else if (c.key === "se") {
                        next.maxX = Math.max(px, base.minX + MIN_ROOM_SIZE);
                        next.maxY = Math.max(py, base.minY + MIN_ROOM_SIZE);
                      } else {
                        next.minX = Math.min(px, base.maxX - MIN_ROOM_SIZE);
                        next.maxY = Math.max(py, base.minY + MIN_ROOM_SIZE);
                      }
                      next.minX = Math.max(0, next.minX);
                      next.minY = Math.max(0, next.minY);
                      next.maxX = Math.min(plan.plot.width, next.maxX);
                      next.maxY = Math.min(plan.plot.length, next.maxY);
                      setResizeDraft(next);
                    }}
                    onDragEnd={(e) => {
                      const node = e.target;
                      node.position({ x: offsetX + c.x * scale - 5, y: offsetY + c.y * scale - 5 });
                      if (resizeDraft) {
                        const b = resizeDraft;
                        onResizeRoom?.(room.id, [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]]);
                      }
                      setResizeDraft(null);
                    }}
                  />
                ))}
              </>
            );
          })()}

          {/* Plot Dimension Bottom Tag */}
          <Line
            points={[
              offsetX,
              offsetY + plan.plot.length * scale + 18,
              offsetX + plan.plot.width * scale,
              offsetY + plan.plot.length * scale + 18,
            ]}
            stroke="#9D95C4"
            strokeWidth={1}
          />
          <Text
            x={offsetX}
            y={offsetY + plan.plot.length * scale + 22}
            text={`Width: ${plan.plot.width} ${plan.units}`}
            fontSize={11}
            fill="#817D94"
            width={plan.plot.width * scale}
            align="center"
          />

          {/* Grid lines */}
          {showGrid &&
            Array.from({ length: Math.floor(plan.plot.width / gridSize) + 1 }, (_, i) => i * gridSize).map((gx) => (
              <Line
                key={`gx-${gx}`}
                points={[offsetX + gx * scale, offsetY, offsetX + gx * scale, offsetY + plan.plot.length * scale]}
                stroke="#5146A5"
                strokeWidth={0.4}
                opacity={0.08}
                listening={false}
              />
            ))}
          {showGrid &&
            Array.from({ length: Math.floor(plan.plot.length / gridSize) + 1 }, (_, i) => i * gridSize).map((gy) => (
              <Line
                key={`gy-${gy}`}
                points={[offsetX, offsetY + gy * scale, offsetX + plan.plot.width * scale, offsetY + gy * scale]}
                stroke="#5146A5"
                strokeWidth={0.4}
                opacity={0.08}
                listening={false}
              />
            ))}
        </Layer>
      </Stage>
    </div>
  );
});

export type { RoomType, Mode as FloorPlanMode };
export { OPENING_WIDTH };
