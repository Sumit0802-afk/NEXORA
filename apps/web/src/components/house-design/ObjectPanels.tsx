"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Focus, RotateCcw, Trash2, X } from "lucide-react";
import type { FloorPlan, Room } from "@houseplan/design-schema";
import { OBJECT_GROUPS, objectFinish, orphanedOverrides, siblingsOf, withObjectFinish, withOverride, withoutOverride, type SceneObject } from "@/lib/house-design/objects";
import type { MaterialCategory } from "@/lib/house-design/materials";
import { ELEVATIONS, ELEVATION_LABEL, setAt, type DoorDesign, type Elevation, type Finish, type HouseDesign, type RoofType, type WindowGrid, type WindowShape, type WindowTrim } from "@/lib/house-design/schema";
import { MINOR_PARTS, objectPartLabel, roomFinish, surfaceFor } from "@/lib/house-design/surfaces";
import { RAILING_STYLES, type RailingStyle } from "@/lib/terrace-catalog";
import { Choices, FLOOR_MATERIALS, FinishPicker, PanelHead, ROOF_MATERIALS, Slider, TRIM_MATERIALS, WALL_MATERIALS } from "./controls";

const SHAPES: { id: WindowShape; label: string }[] = [{ id: "rectangular", label: "Rectangular" }, { id: "arched", label: "Arched" }, { id: "segmental", label: "Segmental" }, { id: "round", label: "Round" }, { id: "gothic", label: "Pointed" }];
const GRIDS: { id: WindowGrid; label: string }[] = [{ id: "none", label: "Clear" }, { id: "vertical", label: "Vertical" }, { id: "cross", label: "Cross" }, { id: "colonial", label: "Colonial" }];
const TRIMS: { id: WindowTrim; label: string }[] = [{ id: "none", label: "None" }, { id: "surround", label: "Surround" }, { id: "shutters", label: "Shutters" }, { id: "hood", label: "Hood" }];
const DOORS: { id: DoorDesign; label: string }[] = [{ id: "flush", label: "Flush" }, { id: "panelled", label: "Panelled" }, { id: "glazed", label: "Glazed" }, { id: "double", label: "Double" }, { id: "slatted", label: "Slatted" }, { id: "arched", label: "Arched" }];
const ROOFS: { id: RoofType; label: string }[] = [{ id: "flat", label: "Flat" }, { id: "cantilever", label: "Deep flat" }, { id: "gable", label: "Gable" }, { id: "hip", label: "Hip" }, { id: "shed", label: "Mono-pitch" }, { id: "mansard", label: "Mansard" }];
const RAILS = RAILING_STYLES.map((r) => ({ id: r.id, label: r.name }));

function categoriesFor(part: string): MaterialCategory[] {
  if (part === "roof") return ROOF_MATERIALS;
  if (part === "glass" || part === "doorGlass" || part === "railGlass") return ["glass"];
  if (part === "windowFrame" || part === "railing" || part === "hardware" || part === "fascia" || part === "soffit" || part === "trim") return TRIM_MATERIALS;
  if (part.startsWith("roomFloor:") || part === "drive") return FLOOR_MATERIALS;
  return WALL_MATERIALS;
}

type InspectorProps = {
  object: SceneObject;
  /** The part that was clicked, shown first. */
  part: string | null;
  design: HouseDesign;
  plan: FloorPlan;
  objects: SceneObject[];
  onChange: (next: HouseDesign, group?: string) => void;
  onClose: () => void;
  onFocus: () => void;
};

/** Everything that can be changed on one object. Only this object changes unless the user applies it to its side. */
export function ObjectInspector({ object, part, design, plan, objects, onChange, onClose, onFocus }: InspectorProps) {
  const rooms = useMemo(() => new Map<string, Room>(plan.levels.flatMap((l) => l.rooms).map((r) => [r.id, r])), [plan]);
  const hosts = useMemo(() => new Map(objects.map((o) => [o.id, o.host])), [objects]);
  const own = design.overrides[object.id];
  const siblings = siblingsOf(object, objects);
  const parts = object.parts.filter((p) => !MINOR_PARTS.has(p)).sort((p, q) => Number(q === part) - Number(p === part));

  const finishOf = (p: string): Finish => {
    const room = p.startsWith("roomFloor:") ? p.slice(10) : p.startsWith("ceiling:") ? p.slice(8) : null;
    if (room) return roomFinish(design, rooms.get(room), room, p.startsWith("ceiling:") ? "ceiling" : "floor");
    const { materialId, color } = surfaceFor(p, design, plan, "day", rooms);
    return objectFinish(design, object.id, p, hosts) ?? { materialId, color };
  };
  const setFinish = (p: string, finish: Finish, group?: string) => {
    const room = p.startsWith("roomFloor:") ? p.slice(10) : p.startsWith("ceiling:") ? p.slice(8) : null;
    if (room) onChange(setAt(design, `interior.rooms.${room}.${p.startsWith("ceiling:") ? "ceiling" : "floor"}`, finish), group);
    else onChange(withObjectFinish(design, [object.id], p, finish), group);
  };
  const patch = (key: "window" | "door" | "balcony" | "roof", value: Record<string, unknown>, group?: string) =>
    onChange(withOverride(design, object.id, (o) => ({ ...o, [key]: { ...o[key], ...value } })), group);
  const applyToSide = () => {
    const change = design.overrides[object.id];
    if (!change) return;
    onChange(siblings.reduce((d, s) => (s.id === object.id ? d : withOverride(d, s.id, () => ({ ...change }))), design));
  };

  const win = { ...design.exterior.window, ...own?.window };
  const rail = { style: design.exterior.balcony.style, depth: design.exterior.balcony.depth, height: design.exterior.balcony.height, ...own?.balcony };
  const roof = { ...design.exterior.roof, ...own?.roof };
  const door = own?.door?.design ?? (object.kind === "door" ? design.exterior.door.design : design.interior.door.design);
  const removable = object.kind === "tree" || object.kind === "balcony" || (object.kind === "window" && object.modelOnly);

  return (
    <div className="hd-selected">
      <div>
        <span>Selected object</span>
        <button type="button" onClick={onClose} aria-label="Clear selection"><X size={14} /></button>
      </div>
      <h3 className="hd-object-name">{object.label}</h3>
      <code className="hd-object-id" title="Object id">{object.id}</code>
      <div className="hd-object-actions">
        <button type="button" onClick={onFocus}><Focus size={13} /> Frame it</button>
        {own && <button type="button" onClick={() => onChange(withoutOverride(design, object.id))}><RotateCcw size={13} /> Reset</button>}
        {own && siblings.length > 1 && <button type="button" onClick={applyToSide}><Copy size={13} /> {object.elevation ? `All on ${ELEVATION_LABEL[object.elevation].toLowerCase()}` : "All like this"}</button>}
      </div>

      {object.kind === "window" && (
        <>
          <Choices label="Shape" value={win.shape} options={SHAPES} columns={3} onChange={(shape) => patch("window", { shape })} />
          <Choices label="Glazing bars" value={win.grid} options={GRIDS} columns={2} onChange={(grid) => patch("window", { grid })} />
          {object.elevation && <Choices label="Surround" value={win.trim} options={TRIMS} columns={2} onChange={(trim) => patch("window", { trim })} />}
          {!object.modelOnly && <p className="hd-hint">Its size and position come from the 2D plan.</p>}
        </>
      )}
      {(object.kind === "door" || object.kind === "interiorDoor") && <Choices label="Door design" value={door} options={DOORS} columns={2} onChange={(design_) => patch("door", { design: design_ })} />}
      {object.kind === "roof" && (
        <>
          <Choices label="Roof form" value={roof.type} options={ROOFS} columns={2} onChange={(type) => patch("roof", { type })} />
          {roof.type !== "flat" && roof.type !== "cantilever" && <Slider label="Pitch" value={roof.pitch} min={8} max={55} step={1} unit="°" onChange={(pitch) => patch("roof", { pitch }, `pitch:${object.id}`)} />}
          <Slider label="Overhang" value={roof.overhang} min={0} max={6} step={0.1} unit=" ft" onChange={(overhang) => patch("roof", { overhang }, `overhang:${object.id}`)} />
        </>
      )}
      {(object.kind === "balcony" || object.kind === "railing") && (
        <>
          <Choices<RailingStyle> label="Railing" value={rail.style} options={RAILS} columns={2} onChange={(style) => patch("balcony", { style })} />
          <Slider label="Railing height" value={rail.height} min={2.8} max={4.5} step={0.1} unit=" ft" onChange={(height) => patch("balcony", { height }, `railH:${object.id}`)} />
          {object.kind === "balcony" && <Slider label="Depth" value={rail.depth} min={1.5} max={6} step={0.1} unit=" ft" onChange={(depth) => patch("balcony", { depth }, `depth:${object.id}`)} />}
        </>
      )}

      {parts.map((p) => (
        <FinishPicker
          key={p}
          label={objectPartLabel(p, (id) => rooms.get(id)?.name)}
          value={finishOf(p)}
          categories={categoriesFor(p)}
          compact={p !== (part ?? parts[0])}
          onChange={(finish, group) => setFinish(p, finish, group ? `${group}:${object.id}` : undefined)}
        />
      ))}

      {removable && (
        <button type="button" className="hd-button small" onClick={() => onChange(withOverride(design, object.id, (o) => ({ ...o, hidden: true })))}>
          <Trash2 size={13} /> Remove from the model
        </button>
      )}
    </div>
  );
}

/** Every object in the house, for picking what is hard to click, such as an inside wall. */
export function ObjectsPanel({ design, objects, selectedId, onSelect, onHover, onClear }: {
  design: HouseDesign;
  objects: SceneObject[];
  selectedId: string | null;
  onSelect: (object: SceneObject) => void;
  onHover: (id: string | null) => void;
  onClear: (ids: string[]) => void;
}) {
  const [side, setSide] = useState<Elevation | "all">("all");
  const orphans = orphanedOverrides(design, objects);
  const edits = Object.keys(design.overrides).length;
  const shown = objects.filter((o) => side === "all" || o.elevation === side);
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Model" title="Objects">Each wall, window, door, balcony and roof section is its own object. Click one here or in the model to change only that object.</PanelHead>
      <p className="hd-hint">{objects.length} objects, {edits} with individual edits.</p>
      <div className="hd-tabs wrap" role="tablist" aria-label="Side of the house">
        <button type="button" role="tab" aria-selected={side === "all"} className={side === "all" ? "on" : ""} onClick={() => setSide("all")}>All</button>
        {ELEVATIONS.map((e) => <button key={e} type="button" role="tab" aria-selected={side === e} className={side === e ? "on" : ""} onClick={() => setSide(e)}>{ELEVATION_LABEL[e]}</button>)}
      </div>
      {orphans.length > 0 && (
        <p className="hd-note">
          <AlertTriangle size={13} /> {orphans.length} {orphans.length === 1 ? "edit belongs" : "edits belong"} to something no longer in the floor plan.{" "}
          <button type="button" className="hd-link" onClick={() => onClear(orphans)}>Clear</button>
        </p>
      )}
      {shown.length === 0 && <p className="hd-empty">Nothing on this side yet.</p>}
      {OBJECT_GROUPS.map((group) => {
        const rows = shown.filter((o) => group.kinds.includes(o.kind));
        if (!rows.length) return null;
        return (
          <details key={group.title} className="hd-object-group" open={rows.length <= 12 || rows.some((o) => o.id === selectedId)}>
            <summary>{group.title} <small>{rows.length}</small></summary>
            <ul onMouseLeave={() => onHover(null)}>
              {rows.map((o) => (
                <li key={o.id}>
                  <button type="button" className={o.id === selectedId ? "on" : ""} onClick={() => onSelect(o)} onMouseEnter={() => onHover(o.id)} onFocus={() => onHover(o.id)}>
                    <span>{o.label}</span>
                    {design.overrides[o.id] && <i title="Has individual edits" />}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
