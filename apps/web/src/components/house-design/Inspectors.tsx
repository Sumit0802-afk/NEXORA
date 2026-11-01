"use client";

import { useMemo } from "react";
import { DoorOpen, Eye, Undo2 } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { RAILING_STYLES } from "@/lib/terrace-catalog";
import type { RailingStyle } from "@/lib/terrace-catalog";
import { floorName } from "@/lib/floors";
import { applyFacadeStyle } from "@/lib/house-design/styles";
import { roomFinish } from "@/lib/house-design/surfaces";
import { ARCH_CATEGORIES, ELEVATIONS, ELEVATION_LABEL, type CeilingStyle, type DoorDesign, type Elevation, type Finish, type HouseDesign } from "@/lib/house-design/schema";
import {
  Choices,
  ColorInput,
  FLOOR_MATERIALS,
  FinishPicker,
  GROUND_MATERIALS,
  Group,
  PanelHead,
  ROOF_MATERIALS,
  Slider,
  TRIM_MATERIALS,
  Toggle,
  WALL_MATERIALS,
} from "./controls";

export type Edit = (path: string, value: unknown, group?: string) => void;
type Props = { design: HouseDesign; edit: Edit };

export function WallsPanel({ design, edit }: Props) {
  const ext = design.exterior;
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Walls and textures">The main wall finish, and a second material for a feature area of the street facade.</PanelHead>
      <FinishPicker label="Wall finish" value={ext.wall} categories={WALL_MATERIALS} onChange={(f, g) => edit("exterior.wall", f, g)} />
      <Group title="Accent cladding">
        <Choices
          label="Where it goes"
          value={ext.accentPlacement}
          columns={3}
          onChange={(v) => edit("exterior.accentPlacement", v)}
          options={[
            { id: "none", label: "None" }, { id: "entry", label: "Entry" }, { id: "left", label: "Left bay" }, { id: "right", label: "Right bay" },
            { id: "lower", label: "Ground floor" }, { id: "upper", label: "Upper floor" }, { id: "front", label: "Whole front" },
          ]}
        />
        {(ext.accentPlacement === "entry" || ext.accentPlacement === "left" || ext.accentPlacement === "right") && (
          <Slider label="Coverage" value={ext.accentCoverage * 100} min={10} max={80} step={1} unit="%" onChange={(v) => edit("exterior.accentCoverage", v / 100, "accentCoverage")} />
        )}
        <FinishPicker label="Accent material" value={ext.accent} categories={WALL_MATERIALS} compact onChange={(f, g) => edit("exterior.accent", f, g)} />
      </Group>
      <FinishPicker label="Plinth and steps" value={ext.base} categories={WALL_MATERIALS} compact onChange={(f, g) => edit("exterior.base", f, g)} />
    </div>
  );
}

export function FacadePanel({ design, edit, onReplace }: Props & { onReplace: (next: HouseDesign) => void }) {
  const details = design.exterior.details;
  const set = (key: keyof HouseDesign["exterior"]["details"]) => (value: boolean) => edit(`exterior.details.${key}`, value);
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Facade style">A style sets the built form: roof, windows, door and detailing. Your colours and materials stay.</PanelHead>
      <div className="hd-style-list" role="radiogroup" aria-label="Facade style">
        {ARCH_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={design.category === c.id} className={design.category === c.id ? "on" : ""} onClick={() => onReplace(applyFacadeStyle(design, c.id))}>
            <b>{c.label}</b>
            <small>{c.blurb}</small>
          </button>
        ))}
      </div>
      <Group title="Architectural details">
        <Toggle label="Plinth band" checked={details.plinth} onChange={set("plinth")} />
        <Toggle label="Cornice" checked={details.cornice} onChange={set("cornice")} />
        <Toggle label="String course" checked={details.stringCourse} onChange={set("stringCourse")} hint="A band at each floor line" />
        <Toggle label="Corner quoins" checked={details.quoins} onChange={set("quoins")} />
        <Toggle label="Corner pilasters" checked={details.pilasters} onChange={set("pilasters")} />
        <Toggle label="Vertical fins" checked={details.fins} onChange={set("fins")} hint="Over the accent area" />
        <Toggle label="Eave corbels" checked={details.corbels} onChange={set("corbels")} />
      </Group>
      <Choices
        label="Entrance"
        value={details.portico}
        columns={4}
        onChange={(v) => edit("exterior.details.portico", v)}
        options={[{ id: "none", label: "Plain" }, { id: "canopy", label: "Canopy" }, { id: "columns", label: "Columns" }, { id: "arch", label: "Arch" }]}
      />
      <FinishPicker label="Trim and columns" value={design.exterior.trim} categories={TRIM_MATERIALS} compact onChange={(f, g) => edit("exterior.trim", f, g)} />
    </div>
  );
}

export function RoofPanel({ design, edit }: Props) {
  const roof = design.exterior.roof;
  const sloped = roof.type === "gable" || roof.type === "hip" || roof.type === "shed" || roof.type === "mansard";
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Roof">The roof is rebuilt over your rooms, including lower wings, whichever type you choose.</PanelHead>
      <Choices
        label="Roof type"
        value={roof.type}
        columns={3}
        onChange={(v) => edit("exterior.roof.type", v)}
        options={[
          { id: "flat", label: "Flat" }, { id: "cantilever", label: "Cantilever" }, { id: "gable", label: "Gable" },
          { id: "hip", label: "Hip" }, { id: "shed", label: "Mono-pitch" }, { id: "mansard", label: "Mansard" },
        ]}
      />
      {sloped && <Slider label="Pitch" value={roof.pitch} min={10} max={50} step={1} unit="°" onChange={(v) => edit("exterior.roof.pitch", v, "pitch")} />}
      <Slider label="Overhang" value={roof.overhang} min={0} max={6} step={0.1} unit=" ft" onChange={(v) => edit("exterior.roof.overhang", v, "overhang")} />
      {roof.type === "flat" && <Toggle label="Parapet wall" checked={roof.parapet} onChange={(v) => edit("exterior.roof.parapet", v)} />}
      <FinishPicker label="Roof covering" value={roof.finish} categories={ROOF_MATERIALS} onChange={(f, g) => edit("exterior.roof.finish", f, g)} />
      <FinishPicker label="Fascia and eaves" value={roof.fascia} categories={TRIM_MATERIALS} compact onChange={(f, g) => edit("exterior.roof.fascia", f, g)} />
      <FinishPicker label="Soffit" value={roof.soffit} categories={TRIM_MATERIALS} compact onChange={(f, g) => edit("exterior.roof.soffit", f, g)} />
    </div>
  );
}

export function WindowsPanel({ design, edit }: Props) {
  const win = design.exterior.window;
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Windows">Shapes are formed inside each opening, so window sizes from your plan are kept.</PanelHead>
      <Choices
        label="Shape"
        value={win.shape}
        columns={3}
        onChange={(v) => edit("exterior.window.shape", v)}
        options={[{ id: "rectangular", label: "Square-head" }, { id: "segmental", label: "Segmental" }, { id: "arched", label: "Arched" }, { id: "gothic", label: "Pointed" }, { id: "round", label: "Round" }]}
      />
      <Choices
        label="Glazing bars"
        value={win.grid}
        columns={4}
        onChange={(v) => edit("exterior.window.grid", v)}
        options={[{ id: "none", label: "None" }, { id: "vertical", label: "Vertical" }, { id: "cross", label: "Cross" }, { id: "colonial", label: "Colonial" }]}
      />
      <Choices
        label="Surround"
        value={win.trim}
        columns={4}
        onChange={(v) => edit("exterior.window.trim", v)}
        options={[{ id: "none", label: "None" }, { id: "surround", label: "Frame" }, { id: "shutters", label: "Shutters" }, { id: "hood", label: "Hood" }]}
      />
      <FinishPicker label="Frame" value={win.frame} categories={["metal", "wood", "paint"]} onChange={(f, g) => edit("exterior.window.frame", f, g)} />
      <FinishPicker label="Glass" value={win.glass} categories={["glass"]} compact onChange={(f, g) => edit("exterior.window.glass", f, g)} />
      <Group title="Blank walls" hint="Windows added here appear on the 3D model only. Your 2D plan is not changed.">
        <Toggle label="Add windows to blank walls" checked={win.fillBlankWalls} onChange={(v) => edit("exterior.window.fillBlankWalls", v)} />
        {win.fillBlankWalls && (
          <Choices
            label="Added window size"
            value={win.proportion}
            columns={3}
            onChange={(v) => edit("exterior.window.proportion", v)}
            options={[{ id: "standard", label: "Standard" }, { id: "tall", label: "Tall" }, { id: "full", label: "Full height" }]}
          />
        )}
      </Group>
    </div>
  );
}

const DOOR_OPTIONS: { id: DoorDesign; label: string }[] = [
  { id: "flush", label: "Flush" }, { id: "panelled", label: "Panelled" }, { id: "glazed", label: "Glazed" },
  { id: "double", label: "Double" }, { id: "slatted", label: "Slatted" }, { id: "arched", label: "Arched" },
];

export function DoorsPanel({ design, edit }: Props) {
  const door = design.exterior.door;
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Front door">Applies to every exterior door in your plan.</PanelHead>
      <Choices label="Design" value={door.design} columns={3} options={DOOR_OPTIONS} onChange={(v) => edit("exterior.door.design", v)} />
      <FinishPicker label="Door finish" value={door.finish} categories={["wood", "paint", "metal"]} onChange={(f, g) => edit("exterior.door.finish", f, g)} />
      <ColorInput label="Handle colour" value={door.hardware} onChange={(c) => edit("exterior.door.hardware", c, "hardware")} />
    </div>
  );
}

export function BalconyPanel({ design, edit, levels }: Props & { levels: number }) {
  const b = design.exterior.balcony;
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Exterior" title="Balcony and railing">The railing also runs around balconies and open terraces drawn in your plan.</PanelHead>
      <Choices<RailingStyle>
        label="Railing style"
        value={b.style}
        columns={2}
        onChange={(v) => edit("exterior.balcony.style", v)}
        options={RAILING_STYLES.map((r) => ({ id: r.id, label: { glass: "Glass", metal_slats: "Metal bars", jali: "Jali screen", baluster: "Balusters", solid_parapet: "Solid parapet" }[r.id], hint: r.description }))}
      />
      <Slider label="Railing height" value={b.height} min={2.8} max={4.5} step={0.1} unit=" ft" onChange={(v) => edit("exterior.balcony.height", v, "railHeight")} />
      <FinishPicker label="Railing" value={b.rail} categories={["metal", "paint", "wood", "stone"]} onChange={(f, g) => edit("exterior.balcony.rail", f, g)} />
      <Group title="Added balconies" hint={levels > 1 ? "Hangs off upper windows on the sides you choose. No room changes size." : "Needs an upper floor; your plan has one floor."}>
        <Toggle label="Add balconies" checked={b.projected} onChange={(v) => edit("exterior.balcony.projected", v)} />
        {b.projected && ELEVATIONS.map((side: Elevation) => (
          <Toggle key={side} label={ELEVATION_LABEL[side]} checked={b.elevations.includes(side)} onChange={(on) => edit("exterior.balcony.elevations", on ? [...b.elevations, side] : b.elevations.filter((e) => e !== side))} />
        ))}
        {b.projected && <Slider label="Depth" value={b.depth} min={1.5} max={6} step={0.1} unit=" ft" onChange={(v) => edit("exterior.balcony.depth", v, "balconyDepth")} />}
        <FinishPicker label="Slab edge" value={b.slab} categories={TRIM_MATERIALS} compact onChange={(f, g) => edit("exterior.balcony.slab", f, g)} />
      </Group>
    </div>
  );
}

const CEILING_OPTIONS: { id: CeilingStyle; label: string }[] = [
  { id: "flat", label: "Flat" }, { id: "tray", label: "Tray" }, { id: "cove", label: "Cove light" }, { id: "beams", label: "Beams" }, { id: "coffered", label: "Coffered" },
];

export function InteriorPanel({ design, plan, edit, roomId, onRoom, onLookInside }: Props & { plan: FloorPlan; roomId: string | null; onRoom: (id: string | null) => void; onLookInside: (id: string) => void }) {
  const rooms = useMemo(
    () => plan.levels.flatMap((level, i) => level.rooms.filter((r) => r.type !== "balcony" && r.type !== "parking" && r.type !== "other").map((room) => ({ room, level: i }))),
    [plan]
  );
  const selected = rooms.find((r) => r.room.id === roomId) ?? null;
  const overrides = roomId ? design.interior.rooms[roomId] : undefined;
  const setRoom = (key: string, value: unknown, group?: string) => edit(`interior.rooms.${roomId}.${key}`, value, group);

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Interior" title="Rooms and finishes">Set finishes for the whole house, then fine-tune any room. Click a floor in the model to pick it.</PanelHead>
      <label className="hd-select">
        <span>Editing</span>
        <select value={roomId ?? ""} onChange={(e) => onRoom(e.target.value || null)}>
          <option value="">Whole house</option>
          {rooms.map(({ room, level }) => <option key={room.id} value={room.id}>{plan.levels.length > 1 ? `${floorName(level)}: ` : ""}{room.name}</option>)}
        </select>
      </label>

      {selected ? (
        <>
          <button type="button" className="hd-button" onClick={() => onLookInside(selected.room.id)}><Eye size={15} /> Look inside this room</button>
          <FinishPicker label="Walls" value={roomFinish(design, selected.room, selected.room.id, "wall")} categories={["paint", "wood", "tile", "marble", "stone", "brick", "concrete"]} onChange={(f, g) => setRoom("wall", f, g)} />
          <FinishPicker label="Floor" value={roomFinish(design, selected.room, selected.room.id, "floor")} categories={FLOOR_MATERIALS} onChange={(f, g) => setRoom("floor", f, g)} />
          <FinishPicker label="Ceiling" value={roomFinish(design, selected.room, selected.room.id, "ceiling")} categories={["paint", "wood", "concrete"]} compact onChange={(f, g) => setRoom("ceiling", f, g)} />
          <Choices label="Ceiling style" value={overrides?.ceilingStyle ?? design.interior.ceilingStyle} columns={3} options={CEILING_OPTIONS} onChange={(v) => setRoom("ceilingStyle", v)} />
          {overrides && Object.keys(overrides).length > 0 && (
            <button type="button" className="hd-button" onClick={() => {
              const { [selected.room.id]: _removed, ...rest } = design.interior.rooms;
              edit("interior.rooms", rest);
            }}><Undo2 size={15} /> Use whole-house finishes</button>
          )}
        </>
      ) : (
        <>
          <FinishPicker label="Walls" value={design.interior.wall} categories={["paint", "wood", "tile", "concrete", "brick"]} onChange={(f, g) => edit("interior.wall", f, g)} />
          <Toggle label="Same floor in every room" checked={design.interior.floor !== null} onChange={(on) => edit("interior.floor", on ? { materialId: "wood_floor_oak", color: "#C9A67C" } : null)} hint="Off keeps timber in living rooms and tile in bathrooms" />
          {design.interior.floor && <FinishPicker label="Floor" value={design.interior.floor} categories={FLOOR_MATERIALS} onChange={(f, g) => edit("interior.floor", f, g)} />}
          <FinishPicker label="Ceiling" value={design.interior.ceiling} categories={["paint", "wood", "concrete"]} compact onChange={(f, g) => edit("interior.ceiling", f, g)} />
          <Choices label="Ceiling style" value={design.interior.ceilingStyle} columns={3} options={CEILING_OPTIONS} onChange={(v) => edit("interior.ceilingStyle", v)} />
          <Group title="Interior doors">
            <Choices value={design.interior.door.design === "double" || design.interior.door.design === "arched" ? "panelled" : design.interior.door.design} columns={2} options={DOOR_OPTIONS.filter((d) => d.id !== "double" && d.id !== "arched")} onChange={(v) => edit("interior.door.design", v)} />
            <FinishPicker label="Door finish" value={design.interior.door.finish} categories={["wood", "paint"]} compact onChange={(f, g) => edit("interior.door.finish", f, g)} />
          </Group>
        </>
      )}
      <p className="hd-hint"><DoorOpen size={12} /> Ceilings show from inside: use Look inside, or the Walkthrough on the 3D page.</p>
    </div>
  );
}

export function EnvironmentPanel({ design, edit }: Props) {
  const env = design.environment;
  const finishEdit = (path: string) => (f: Finish, g?: string) => edit(path, f, g);
  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Environment" title="Garden and surroundings">Everything around the house, from planting to the street outside.</PanelHead>
      <Choices
        label="Surroundings"
        value={env.surroundings}
        columns={3}
        onChange={(v) => edit("environment.surroundings", v)}
        options={[{ id: "suburban", label: "Suburb" }, { id: "urban", label: "City block" }, { id: "woodland", label: "Woodland" }, { id: "waterfront", label: "Waterfront" }, { id: "studio", label: "Plain" }]}
      />
      <Group title="Garden and landscaping">
        <Toggle label="Planted garden" checked={env.lawn} onChange={(v) => edit("environment.lawn", v)} hint="Off paves the plot" />
        {env.lawn && <FinishPicker label="Garden ground" value={env.ground} categories={GROUND_MATERIALS} compact onChange={finishEdit("environment.ground")} />}
        <Slider label="Trees" value={env.trees} min={0} max={12} step={1} onChange={(v) => edit("environment.trees", v, "trees")} />
        <Slider label="Shrubs along the house" value={env.shrubs * 100} min={0} max={100} step={5} unit="%" onChange={(v) => edit("environment.shrubs", v / 100, "shrubs")} />
        <Toggle label="Hedges around the plot" checked={env.hedges} onChange={(v) => edit("environment.hedges", v)} />
        <Toggle label="Flowers" checked={env.flowers} onChange={(v) => edit("environment.flowers", v)} />
        <ColorInput label="Foliage" value={env.foliage} onChange={(c) => edit("environment.foliage", c, "foliage")} />
        {env.flowers && <ColorInput label="Flower colour" value={env.flowerColor} onChange={(c) => edit("environment.flowerColor", c, "flowerColor")} />}
      </Group>
      <Group title="Pathways">
        <Choices value={env.path.style} columns={3} onChange={(v) => edit("environment.path.style", v)} options={[{ id: "none", label: "None" }, { id: "straight", label: "Paved" }, { id: "stepping", label: "Stepping" }]} />
        {env.path.style !== "none" && (
          <>
            <Slider label="Path width" value={env.path.width} min={2.5} max={8} step={0.5} unit=" ft" onChange={(v) => edit("environment.path.width", v, "pathWidth")} />
            <FinishPicker label="Path material" value={env.path.finish} categories={GROUND_MATERIALS} compact onChange={finishEdit("environment.path.finish")} />
          </>
        )}
        <FinishPicker label="Driveway" value={env.driveway} categories={GROUND_MATERIALS} compact onChange={finishEdit("environment.driveway")} />
        <FinishPicker label="Boundary wall" value={env.boundary} categories={WALL_MATERIALS} compact onChange={finishEdit("environment.boundary")} />
      </Group>
      <Group title="Outdoor lighting" hint="See it in the Golden hour and Night previews.">
        <Choices
          value={env.lighting.style}
          columns={3}
          onChange={(v) => edit("environment.lighting.style", v)}
          options={[{ id: "none", label: "None" }, { id: "bollards", label: "Path" }, { id: "sconces", label: "Wall" }, { id: "uplights", label: "Uplights" }, { id: "all", label: "All" }]}
        />
        <ColorInput label="Light colour" value={env.lighting.color} onChange={(c) => edit("environment.lighting.color", c, "lightColor")} />
        <Slider label="Brightness" value={env.lighting.intensity * 100} min={20} max={200} step={5} unit="%" onChange={(v) => edit("environment.lighting.intensity", v / 100, "lightIntensity")} />
      </Group>
    </div>
  );
}
