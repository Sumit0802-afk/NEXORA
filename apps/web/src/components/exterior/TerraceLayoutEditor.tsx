"use client";

import React, { useMemo, useRef, useState } from "react";
import { Copy, Minus, MoveDiagonal, Plus, RotateCw, Trash2, Eraser } from "lucide-react";
import type { FloorPlan, FurnitureItem } from "@houseplan/design-schema";
import { roomRect, validateCirculation } from "@/lib/circulation";
import { TERRACE_FURNITURE_CATALOG } from "@/lib/terrace-catalog";
import {
  TERRACE_STYLES,
  applyTerraceStyle,
  clearTerraceFurniture,
  findTerraces,
  makeTerraceItem,
  terraceItems,
  type TerraceStyleId,
} from "@/lib/terrace-layout";
import { floorName } from "@/lib/floors";

interface Props {
  plan: FloorPlan;
  onUpdatePlan: (plan: FloorPlan) => void;
}

const footprint = (f: FurnitureItem): [number, number] => {
  const odd = Math.round((f.rotation ?? 0) / (Math.PI / 2)) % 2 !== 0;
  const w = f.dimensions.width * (f.scale?.[0] ?? 1);
  const d = f.dimensions.depth * (f.scale?.[2] ?? 1);
  return odd ? [d, w] : [w, d];
};

/** Editable terrace layout: pick a style, then add, drag, rotate, resize, duplicate, recolour or delete real furniture. */
export function TerraceLayoutEditor({ plan, onUpdatePlan }: Props) {
  const terraces = useMemo(() => findTerraces(plan), [plan]);
  const [which, setWhich] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(TERRACE_FURNITURE_CATALOG[0].type);
  const [note, setNote] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dragPos, setDragPos] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const area = terraces[Math.min(which, terraces.length - 1)];
  if (!area) {
    return (
      <section className="tdm-stack">
        <div className="tdm-section-head">
          <h3>Edit your terrace</h3>
          <p>This design has no terrace on an upper floor yet. Use a design with two or more floors, or draw a room named “Terrace” on the top floor in the 2D editor, then come back here.</p>
        </div>
      </section>
    );
  }

  const unit = plan.units === "m" ? "m" : "ft";
  const unitScale = plan.units === "m" ? 0.3048 : 1;
  const rect = roomRect(area.room);
  const W = rect.maxX - rect.minX;
  const H = rect.maxY - rect.minY;
  const level = plan.levels[area.levelIndex];
  const items = terraceItems(plan, area);
  const current = items.find((f) => f.id === selected) ?? null;
  const issues = validateCirculation(plan).filter((i) => i.id.includes(area.room.id) || i.id.startsWith("terrace-blocked") || i.id.startsWith("furniture-outside"));
  const pad = Math.max(W, H) * 0.04;

  const commit = (next: FurnitureItem[]) => {
    const levels = plan.levels.map((l, i) =>
      i !== area.levelIndex ? l : { ...l, furniture: [...((l.furniture ?? []) as FurnitureItem[]).filter((f) => !(f.roomId === area.room.id && f.category === "terrace")), ...next] },
    );
    onUpdatePlan({ ...plan, levels });
  };
  const patch = (id: string, change: Partial<FurnitureItem>) => commit(items.map((f) => (f.id === id ? { ...f, ...change } : f)));

  const clamp = (f: FurnitureItem, x: number, y: number): [number, number] => {
    const [fw, fd] = footprint(f);
    return [Math.min(Math.max(x, rect.minX + fw / 2), rect.maxX - fw / 2), Math.min(Math.max(y, rect.minY + fd / 2), rect.maxY - fd / 2)];
  };

  const toPlan = (clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };

  const applyStyle = (id: TerraceStyleId) => {
    const res = applyTerraceStyle(plan, area, id);
    setSelected(null);
    setNote(res.skipped.length ? `Left out because they do not fit this terrace: ${res.skipped.join(", ")}.` : null);
    onUpdatePlan(res.plan);
  };

  const add = () => {
    const spec = TERRACE_FURNITURE_CATALOG.find((c) => c.type === adding)!;
    const item = makeTerraceItem(spec.type, area.room.id, level.id, [rect.minX + W / 2, rect.minY + H / 2], 0, unitScale);
    const [x, y] = clamp(item, item.position[0], item.position[1]);
    item.position = [x, y, 0];
    setSelected(item.id);
    setNote(null);
    commit([...items, item]);
  };

  const duplicate = () => {
    if (!current) return;
    const copy: FurnitureItem = { ...current, id: `${current.id}-c${Date.now().toString(36)}`, position: [...current.position] as [number, number, number] };
    const [x, y] = clamp(copy, current.position[0] + 1.5 * unitScale, current.position[1] + 1.5 * unitScale);
    copy.position = [x, y, 0];
    setSelected(copy.id);
    commit([...items, copy]);
  };

  const remove = () => {
    if (!current) return;
    setSelected(null);
    commit(items.filter((f) => f.id !== current.id));
  };

  const rotate = () => {
    if (!current) return;
    const rotation = ((current.rotation ?? 0) + Math.PI / 2) % (Math.PI * 2);
    const turned = { ...current, rotation };
    const [x, y] = clamp(turned, current.position[0], current.position[1]);
    patch(current.id, { rotation, position: [x, y, 0] });
  };

  const resize = (factor: number) => {
    if (!current) return;
    const s = Math.min(2.5, Math.max(0.4, (current.scale?.[0] ?? 1) * factor));
    const turned = { ...current, scale: [s, s, s] as [number, number, number] };
    const [x, y] = clamp(turned, current.position[0], current.position[1]);
    patch(current.id, { scale: [s, s, s], position: [x, y, 0] });
  };

  const nudge = (dx: number, dy: number) => {
    if (!current) return;
    const [x, y] = clamp(current, current.position[0] + dx * unitScale, current.position[1] + dy * unitScale);
    patch(current.id, { position: [x, y, 0] });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.25;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key] && current) {
      e.preventDefault();
      nudge(...map[e.key]);
    } else if ((e.key === "Delete" || e.key === "Backspace") && current) {
      e.preventDefault();
      remove();
    } else if (e.key.toLowerCase() === "r" && current) rotate();
  };

  return (
    <section className="tdm-stack">
      <div className="tdm-section-head">
        <h3>Edit your terrace</h3>
        <p>Pick a style to start from, then change anything. These are real pieces in your design — they appear in 3D, in the 2D plan and in exports. The photos under Inspiration are references only and are not editable.</p>
      </div>

      <div className="tle-styles">
        {TERRACE_STYLES.map((s) => (
          <button key={s.id} type="button" className="tle-style" onClick={() => applyStyle(s.id)}>
            <strong>{s.name}</strong>
            <small>{s.tagline}</small>
          </button>
        ))}
      </div>
      {note && <p className="tle-note" role="status">{note}</p>}

      <div className="tle-body">
        <div className="tle-canvas">
          {terraces.length > 1 && (
            <select aria-label="Terrace" value={which} onChange={(e) => { setWhich(Number(e.target.value)); setSelected(null); }}>
              {terraces.map((t, i) => (
                <option key={t.room.id} value={i}>{t.room.name} · {floorName(t.levelIndex)}</option>
              ))}
            </select>
          )}
          <svg
            ref={svgRef}
            className="tle-svg"
            viewBox={`${rect.minX - pad} ${rect.minY - pad} ${W + pad * 2} ${H + pad * 2}`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={(e) => {
              if (!drag) return;
              const f = items.find((i) => i.id === drag.id);
              if (!f) return;
              const [px, py] = toPlan(e.clientX, e.clientY);
              const [x, y] = clamp(f, px - drag.x, py - drag.y);
              setDragPos([x, y]);
            }}
            onPointerUp={() => {
              if (drag && dragPos) patch(drag.id, { position: [dragPos[0], dragPos[1], 0] });
              setDrag(null);
              setDragPos(null);
            }}
            onPointerLeave={() => { setDrag(null); setDragPos(null); }}
            role="application"
            aria-label="Terrace layout. Select a piece, drag it, or use the arrow keys to move it."
          >
            <rect x={rect.minX} y={rect.minY} width={W} height={H} className="tle-floor" />
            {items.map((f) => {
              const pos = drag?.id === f.id && dragPos ? dragPos : [f.position[0], f.position[1]];
              const [fw, fd] = footprint(f);
              const color = typeof (f.material as { color?: string } | undefined)?.color === "string" ? (f.material as { color: string }).color : "#9A8F6F";
              const path = f.type === "walking_path";
              return (
                <g
                  key={f.id}
                  className={`tle-item${f.id === selected ? " sel" : ""}`}
                  onPointerDown={(e) => {
                    if (path) return;
                    e.stopPropagation();
                    setSelected(f.id);
                    const [px, py] = toPlan(e.clientX, e.clientY);
                    setDrag({ id: f.id, x: px - f.position[0], y: py - f.position[1] });
                    setDragPos([f.position[0], f.position[1]]);
                    (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture?.(e.pointerId);
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelected(f.id); }}
                >
                  <rect x={pos[0] - fw / 2} y={pos[1] - fd / 2} width={fw} height={fd} rx={Math.min(fw, fd) * 0.12} fill={color} fillOpacity={path ? 0.35 : 0.85} />
                  {!path && f.type !== "pergola" && fw > W * 0.08 && (
                    <text x={pos[0]} y={pos[1]} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(Math.min(fw, fd) * 0.22, fw / (f.name.split(" ").slice(-1)[0].length * 0.62 + 1), W * 0.07)} fill="#fff" pointerEvents="none">
                      {f.name.split(" ").slice(-1)[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="tle-hint">Drag a piece to move it. With a piece selected: arrow keys nudge it (Shift = bigger steps), R rotates, Delete removes. Terrace size {W.toFixed(1)} × {H.toFixed(1)} {unit}.</p>
        </div>

        <aside className="tle-panel">
          <div className="tle-add">
            <select aria-label="Piece to add" value={adding} onChange={(e) => setAdding(e.target.value)}>
              {TERRACE_FURNITURE_CATALOG.map((c) => <option key={c.type} value={c.type}>{c.name}</option>)}
            </select>
            <button type="button" className="button" onClick={add}><Plus size={14} /> Add</button>
          </div>

          {current ? (
            <div className="tle-selected">
              <strong>{current.name}</strong>
              <div className="tle-tools">
                <button type="button" onClick={rotate} title="Rotate 90°"><RotateCw size={15} /> Rotate</button>
                <button type="button" onClick={() => resize(1 / 1.15)} title="Smaller"><Minus size={15} /> Smaller</button>
                <button type="button" onClick={() => resize(1.15)} title="Larger"><MoveDiagonal size={15} /> Larger</button>
                <button type="button" onClick={duplicate} title="Duplicate"><Copy size={15} /> Duplicate</button>
                <button type="button" onClick={remove} title="Delete"><Trash2 size={15} /> Delete</button>
              </div>
              <label className="tle-colour">
                Colour
                <input
                  type="color"
                  value={typeof (current.material as { color?: string } | undefined)?.color === "string" ? (current.material as { color: string }).color : "#9A8F6F"}
                  onChange={(e) => patch(current.id, { material: { ...(current.material ?? {}), color: e.target.value } })}
                />
              </label>
            </div>
          ) : (
            <p className="tle-empty">Select a piece on the plan to change it.</p>
          )}

          <button type="button" className="tle-clear" onClick={() => { setSelected(null); setNote(null); onUpdatePlan(clearTerraceFurniture(plan, area)); }}>
            <Eraser size={14} /> Clear terrace
          </button>

          <div className="tle-checks" aria-live="polite">
            {issues.length === 0 ? <p className="ok">No access or boundary problems found.</p> : issues.map((i) => <p key={i.id} className={i.severity}>{i.message}</p>)}
          </div>
          <p className="lib-disclaimer">Layouts are design suggestions. They are not a structural or load check — have a qualified engineer confirm terrace loads, parapet height and waterproofing.</p>
        </aside>
      </div>
    </section>
  );
}
