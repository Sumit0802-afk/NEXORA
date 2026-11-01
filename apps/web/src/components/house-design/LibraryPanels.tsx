"use client";

import { useState } from "react";
import { Boxes, Check, Copy, Download, FolderOpen, ImageDown, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { useHouseDesign } from "@/lib/house-design/context";
import { RENDER_SIZES, exportFileName, exportGlb, exportObjArchive, exportStl } from "@/lib/house-design/export";
import { triggerDownload } from "@/lib/export-2d";
import { MATERIALS, MATERIAL_CATEGORIES, type MaterialCategory } from "@/lib/house-design/materials";
import { MAX_VARIATIONS, type HouseDesign } from "@/lib/house-design/schema";
import { PAINTABLE_PARTS, finishAt } from "@/lib/house-design/surfaces";
import { categoryLabel } from "@/lib/house-design/styles";
import type { HouseSceneHandle } from "@/components/viewer/HouseScene";
import { ColorInput, PanelHead, Swatch, Toggle } from "./controls";
import type { Edit } from "./Inspectors";

export function MaterialsPanel({ design, plan, edit, target, onTarget }: { design: HouseDesign; plan: FloorPlan; edit: Edit; target: string; onTarget: (path: string) => void }) {
  const [category, setCategory] = useState<MaterialCategory | "all">("all");
  const rooms = plan.levels.flatMap((l) => l.rooms).filter((r) => r.type !== "parking" && r.type !== "other" && r.type !== "balcony");
  const current = finishAt(design, target);
  const list = MATERIALS.filter((m) => (category === "all" ? m.category !== "ground" : m.category === category));

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Library" title="Materials and colours">Choose a surface, then click any material to apply it to that part of the house.</PanelHead>
      <label className="hd-select">
        <span>Apply to</span>
        <select value={target} onChange={(e) => onTarget(e.target.value)}>
          <optgroup label="House">
            {PAINTABLE_PARTS.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
          </optgroup>
          <optgroup label="Room walls">
            {rooms.map((r) => <option key={`w-${r.id}`} value={`interior.rooms.${r.id}.wall`}>{r.name} walls</option>)}
          </optgroup>
          <optgroup label="Room floors">
            {rooms.map((r) => <option key={`f-${r.id}`} value={`interior.rooms.${r.id}.floor`}>{r.name} floor</option>)}
          </optgroup>
        </select>
      </label>
      {current && <ColorInput label="Colour" value={current.color} onChange={(color) => edit(target, { ...current, color }, `color:${target}`)} />}
      <div className="hd-tabs wrap" role="tablist">
        <button type="button" role="tab" aria-selected={category === "all"} className={category === "all" ? "on" : ""} onClick={() => setCategory("all")}>All</button>
        {MATERIAL_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? "on" : ""} onClick={() => setCategory(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="hd-library">
        {list.map((m) => {
          const on = current?.materialId === m.id;
          return (
            <button key={m.id} type="button" className={on ? "on" : ""} aria-pressed={on} title={m.info} onClick={() => edit(target, { materialId: m.id, color: m.color })}>
              <Swatch materialId={m.id} size={72} />
              {on && <Check size={13} />}
              <b>{m.name}</b>
              <small>{MATERIAL_CATEGORIES.find((c) => c.id === m.category)?.label}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function captureThumbnail(scene: HouseSceneHandle | null): Promise<string | null> {
  const blob = await scene?.renderImage(420, 236, "image/jpeg", 0.74);
  return blob ? blobToDataUrl(blob) : null;
}

export function VariationsPanel({ scene, onToast }: { scene: React.RefObject<HouseSceneHandle | null>; onToast: (message: string) => void }) {
  const house = useHouseDesign();
  const { variations, activeVariationId } = house.document;
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const full = variations.length >= MAX_VARIATIONS;
  const hasDesign = Boolean(house.design);

  const add = async () => {
    const label = name.trim() || `Design ${variations.length + 1}`;
    const id = house.addVariation(label, await captureThumbnail(scene.current));
    if (id) {
      setName("");
      onToast(`Saved "${label}"`);
    }
  };

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Project" title="Design variations">Keep several looks for this house and reopen any of them. Each one remembers all its settings.</PanelHead>
      {hasDesign ? (
        <div className="hd-inline">
          <input className="hd-input" value={name} maxLength={60} placeholder={`Design ${variations.length + 1}`} aria-label="Variation name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !full) void add(); }} />
          <button type="button" className="hd-button primary" onClick={add} disabled={full}><Save size={14} /> Save</button>
        </div>
      ) : (
        <p className="hd-empty">Generate or customize a design first, then save it here.</p>
      )}
      {full && <p className="hd-hint">You have reached {MAX_VARIATIONS} variations. Delete one to save another.</p>}
      {variations.length === 0 ? (
        <p className="hd-empty">No saved variations yet.</p>
      ) : (
        <ul className="hd-variations">
          {variations.map((v) => (
            <li key={v.id} className={v.id === activeVariationId ? "on" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.thumbnail ? <img src={v.thumbnail} alt="" /> : <div className="hd-thumb-empty" style={{ background: v.design.exterior.wall.color }} />}
              <div>
                {renaming === v.id ? (
                  <input
                    className="hd-input" autoFocus value={draft} maxLength={60} aria-label="New name"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => { if (draft.trim()) house.renameVariation(v.id, draft.trim()); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(null); }}
                  />
                ) : (
                  <b title={v.name}>{v.name}</b>
                )}
                <small>{categoryLabel(v.design.category)} · {new Date(v.updatedAt).toLocaleDateString()}</small>
                <div className="hd-row-actions">
                  <button type="button" onClick={() => { house.openVariation(v.id); onToast(`Opened "${v.name}"`); }} title="Open"><FolderOpen size={14} /> Open</button>
                  {v.id === activeVariationId && <button type="button" onClick={async () => { house.overwriteVariation(v.id, await captureThumbnail(scene.current)); onToast(`Updated "${v.name}"`); }} title="Save current changes here"><Save size={14} /></button>}
                  <button type="button" onClick={() => { setRenaming(v.id); setDraft(v.name); }} title="Rename" aria-label="Rename"><Pencil size={14} /></button>
                  <button type="button" onClick={() => house.duplicateVariation(v.id)} disabled={full} title="Duplicate" aria-label="Duplicate"><Copy size={14} /></button>
                  {confirmDelete === v.id ? (
                    <button type="button" className="danger" onClick={() => { house.deleteVariation(v.id); setConfirmDelete(null); }} onBlur={() => setConfirmDelete(null)} autoFocus>Delete?</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(v.id)} title="Delete" aria-label="Delete"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExportPanel({ scene, projectName, design }: { scene: React.RefObject<HouseSceneHandle | null>; projectName: string; design: HouseDesign | null }) {
  const [size, setSize] = useState(RENDER_SIZES[1].id);
  const [furniture, setFurniture] = useState(true);
  const [roof, setRoof] = useState(true);
  const [site, setSite] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (label: string, job: () => Promise<string> | string) => {
    setBusy(label);
    setMessage(null);
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      setMessage({ ok: true, text: await job() });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "That export failed. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const liveScene = () => {
    const live = scene.current?.getScene();
    if (!live) throw new Error("The 3D view is not ready yet.");
    return live;
  };
  const options = { includeFurniture: furniture, includeRoof: roof, includeSite: site, projectName };
  const baseName = exportFileName(projectName, "house");

  const render = () =>
    run("render", async () => {
      const chosen = RENDER_SIZES.find((s) => s.id === size)!;
      const blob = await scene.current?.renderImage(chosen.width, chosen.height);
      if (!blob) throw new Error("The render could not be created.");
      triggerDownload(blob, exportFileName(projectName, `render-${chosen.width}x${chosen.height}.png`));
      return `Saved a ${chosen.width} × ${chosen.height} PNG of the current view.`;
    });

  const icon = (label: string, Icon: typeof Download) => (busy === label ? <Loader2 size={15} className="hd-spin" /> : <Icon size={15} />);

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Project" title="Export">Renders use the current camera and lighting. Models keep the materials you chose.</PanelHead>
      <section className="hd-group">
        <h3>High-resolution render</h3>
        <label className="hd-select">
          <span>Size</span>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {RENDER_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="hd-button primary" onClick={render} disabled={Boolean(busy)}>{icon("render", ImageDown)} Export render (PNG)</button>
      </section>
      <section className="hd-group">
        <h3>3D model</h3>
        <Toggle label="Include furniture" checked={furniture} onChange={setFurniture} />
        <Toggle label="Include roof" checked={roof} onChange={setRoof} />
        <Toggle label="Include garden and street" checked={site} onChange={setSite} />
        <button type="button" className="hd-button" disabled={Boolean(busy) || !design} onClick={() => run("glb", async () => { await exportGlb(liveScene(), options, baseName, design!); return "Saved GLB with textures and your design settings."; })}>
          {icon("glb", Boxes)} GLB <small>textures and settings</small>
        </button>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => run("obj", () => { exportObjArchive(liveScene(), options, baseName); return "Saved a ZIP with the OBJ and its MTL colours."; })}>
          {icon("obj", Download)} OBJ + MTL <small>colours, zipped</small>
        </button>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => run("stl", () => { exportStl(liveScene(), options, baseName); return "Saved STL. It holds shape only, with no colour."; })}>
          {icon("stl", Download)} STL <small>shape for 3D printing</small>
        </button>
      </section>
      {message && <p className={message.ok ? "hd-note ok" : "hd-error"} role="status">{message.text}</p>}
    </div>
  );
}
