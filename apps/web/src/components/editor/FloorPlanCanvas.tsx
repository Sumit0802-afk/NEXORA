"use client";

import { forwardRef, useEffect, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Line, Arc } from "react-konva";
import type { FloorPlan, Room, RoomType, Wall, Opening } from "@houseplan/design-schema";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { nearestEdge, snapToGrid } from "@/lib/geometry";

type RoomBounds = { minX: number; minY: number; maxX: number; maxY: number };
type Mode = "select" | "room" | "wall" | "measure" | "door" | "window";
export type Selection = { type: "room" | "wall" | "opening"; id: string } | null;
type HandleCorner = "nw" | "ne" | "se" | "sw";

function roomBounds(room: Room): RoomBounds {
  const xs = room.polygon.map((p) => p[0]);
  const ys = room.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const MIN_ROOM_SIZE = 3;
const EDGE_SNAP_TOLERANCE = 1.5;
const OPENING_WIDTH = 3;

export const FloorPlanCanvas = forwardRef<Konva.Stage, {
  plan: FloorPlan;
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
  onAddOpening?: (wall: { start: [number, number]; end: [number, number] }, offset: number, kind: "door" | "window") => void;
  onMeasure?: (distance: number | null) => void;
}>(function FloorPlanCanvas(
  {
    plan,
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
    onAddOpening,
    onMeasure,
  },
  stageRef
) {
  const scale = 10;
  const offsetX = 48;
  const offsetY = 42;
  const width = 760;
  const height = 560;
  const rooms = plan.levels[0]?.rooms ?? [];
  const walls = plan.levels[0]?.walls ?? [];
  const openings = plan.levels[0]?.openings ?? [];
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [measureLine, setMeasureLine] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{ start: [number, number]; end: [number, number]; point: [number, number] } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [resizeDraft, setResizeDraft] = useState<RoomBounds | null>(null);

  useEffect(() => {
    setDraft(null);
    setMeasureLine(null);
    setHoverEdge(null);
    setResizeDraft(null);
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
      const edge = nearestEdge(
        rooms.map((r) => r.polygon),
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
      const edge = nearestEdge(
        rooms.map((r) => r.polygon),
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
          <Text
            x={20}
            y={12}
            text={`${plan.plot.width} × ${plan.plot.length} ${plan.units}`}
            fontSize={13}
            fill="#817D94"
          />
          <Rect
            x={offsetX}
            y={offsetY}
            width={plan.plot.width * scale}
            height={plan.plot.length * scale}
            stroke="#302A65"
            strokeWidth={4}
            fill="#FFFDF7"
          />
          {rooms.map((room, index) => {
            const isSelected = selection?.type === "room" && selection.id === room.id;
            const { minX, minY, maxX, maxY } = isSelected && resizeDraft ? resizeDraft : roomBounds(room);
            const isHovered = hoverId === room.id && mode === "select";
            return (
              <Group key={room.id}>
                <Rect
                  x={offsetX + minX * scale}
                  y={offsetY + minY * scale}
                  width={(maxX - minX) * scale}
                  height={(maxY - minY) * scale}
                  fill={isHovered ? "#5146A52a" : index % 2 === 0 ? "#FFF4D6" : "#F0EDFA"}
                  stroke={isSelected ? "#E0631E" : "#5146A5"}
                  strokeWidth={isSelected ? 3 : 2}
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
                  onDragEnd={(e) => {
                    const node = e.target as Konva.Rect;
                    const dx = (node.x() - (offsetX + minX * scale)) / scale;
                    const dy = (node.y() - (offsetY + minY * scale)) / scale;
                    node.position({ x: offsetX + minX * scale, y: offsetY + minY * scale });
                    if (dx !== 0 || dy !== 0) onMoveRoom?.(room.id, dx, dy);
                  }}
                />
                <Text
                  x={offsetX + minX * scale + 5}
                  y={offsetY + minY * scale + 8}
                  text={room.name}
                  fontSize={11}
                  fill="#302A65"
                  width={Math.max(50, (maxX - minX) * scale - 10)}
                  align="center"
                  listening={false}
                />
                {isSelected && mode === "select" && (
                  <Text
                    x={offsetX + minX * scale + 5}
                    y={offsetY + maxY * scale - 16}
                    text={`${(maxX - minX).toFixed(1)} × ${(maxY - minY).toFixed(1)} ${plan.units}`}
                    fontSize={10}
                    fill="#E0631E"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {walls.map((wall: Wall) => {
            const isSelected = selection?.type === "wall" && selection.id === wall.id;
            const isHovered = hoverId === wall.id && mode === "select";
            return (
              <Line
                key={wall.id}
                points={[
                  offsetX + wall.start[0] * scale,
                  offsetY + wall.start[1] * scale,
                  offsetX + wall.end[0] * scale,
                  offsetY + wall.end[1] * scale,
                ]}
                stroke={isSelected ? "#E0631E" : isHovered ? "#5146A5" : "#302A65"}
                strokeWidth={Math.max(3, wall.thickness * scale * 0.4)}
                hitStrokeWidth={14}
                listening={mode === "select"}
                onMouseEnter={() => setHoverId(wall.id)}
                onMouseLeave={() => setHoverId((h) => (h === wall.id ? null : h))}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelect?.({ type: "wall", id: wall.id });
                }}
              />
            );
          })}

          {openings.map((opening: Opening) => {
            const wall = walls.find((w) => w.id === opening.wallId);
            if (!wall) return null;
            const dx = wall.end[0] - wall.start[0];
            const dy = wall.end[1] - wall.start[1];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const cx = wall.start[0] + ux * opening.offset;
            const cy = wall.start[1] + uy * opening.offset;
            const half = (opening.width / 2) * scale;
            const px = offsetX + cx * scale;
            const py = offsetY + cy * scale;
            const isDoor = opening.kind === "door";
            const isSelected = selection?.type === "opening" && selection.id === opening.id;
            return (
              <Group
                key={opening.id}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (mode === "select") onSelect?.({ type: "opening", id: opening.id });
                }}
              >
                <Line
                  points={[px - ux * half, py - uy * half, px + ux * half, py + uy * half]}
                  stroke={isSelected ? "#E0631E" : isDoor ? "#FFFDF7" : "#8bbae0"}
                  strokeWidth={isDoor ? 6 : 5}
                  hitStrokeWidth={14}
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
                    stroke={isSelected ? "#E0631E" : "#b1874f"}
                    strokeWidth={1}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

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

          {draft && mode === "room" && (
            <Group>
              <Rect
                x={offsetX + Math.min(draft.x0, draft.x1) * scale}
                y={offsetY + Math.min(draft.y0, draft.y1) * scale}
                width={Math.abs(draft.x1 - draft.x0) * scale}
                height={Math.abs(draft.y1 - draft.y0) * scale}
                fill="#5146A51a"
                stroke="#5146A5"
                dash={[6, 4]}
                strokeWidth={1.5}
                listening={false}
              />
              <Text
                x={offsetX + Math.min(draft.x0, draft.x1) * scale + 4}
                y={offsetY + Math.min(draft.y0, draft.y1) * scale + 4}
                text={`${Math.abs(draft.x1 - draft.x0).toFixed(1)} × ${Math.abs(draft.y1 - draft.y0).toFixed(1)} ${plan.units}`}
                fontSize={11}
                fill="#5146A5"
                listening={false}
              />
            </Group>
          )}

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
                strokeWidth={4}
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
            text={`${plan.plot.width} ${plan.units}`}
            fontSize={11}
            fill="#817D94"
            width={plan.plot.width * scale}
            align="center"
          />
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
