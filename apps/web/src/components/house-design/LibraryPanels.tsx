"use client";

import { useRef, useState } from "react";
import { Boxes, Check, Columns2, Copy, Download, FolderOpen, History, ImageDown, Layers3, Loader2, Pencil, Save, Trash2, Upload } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { useHouseDesign } from "@/lib/house-design/context";
import { RENDER_SIZES, exportAllVariations, exportFileName, exportGlb, exportObjArchive, exportProjectFile, exportStl, exportVariation, parseProjectFile } from "@/lib/house-design/export";
import { planFingerprint } from "@/lib/house-design/geometry-engine";
import type { SceneObject } from "@/lib/house-design/objects";
import { diffDesigns } from "@/lib/house-design/variations";
import { triggerDownload } from "@/lib/export-2d";
import { MATERIALS, MATERIAL_CATEGORIES, type MaterialCategory } from "@/lib/house-design/materials";
import { MAX_VARIATIONS, type Finish, type HouseDesign } from "@/lib/house-design/schema";
import { PAINTABLE_PARTS, finishAt } from "@/lib/house-design/surfaces";
import { categoryLabel } from "@/lib/house-design/styles";
import type { HouseSceneHandle } from "@/components/viewer/HouseScene";
import { ColorInput, PanelHead, Swatch, Toggle } from "./controls";
import type { Edit } from "./Inspectors";

/** The selected object's surface, offered as a material target. */
export type SelectedSurface = { label: string; finish: Finish; apply: (finish: Finish, group?: string) => void };

export function MaterialsPanel({ design, plan, edit, target, onTarget, selected }: { design: HouseDesign; plan: FloorPlan; edit: Edit; target: string; onTarget: (path: string) => void; selected: SelectedSurface | null }) {
  const [category, setCategory] = useState<MaterialCategory | "all">("all");
  const rooms = plan.levels.flatMap((l) => l.rooms).filter((r) => r.type !== "parking" && r.type !== "other" && r.type !== "balcony");
  const onSelected = target === "selected" && selected !== null;
  const current = onSelected ? selected.finish : finishAt(design, target);
  const apply = (finish: Finish, group?: string) => (onSelected ? selected.apply(finish, group) : edit(target, finish, group));
  const list = MATERIALS.filter((m) => (category === "all" ? m.category !== "ground" : m.category === category));

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Library" title="Materials and colours">Choose a surface, then click any material to apply it to that part of the house.</PanelHead>
      <label className="hd-select">
        <span>Apply to</span>
        <select value={onSelected || target !== "selected" ? target : PAINTABLE_PARTS[0].path} onChange={(e) => onTarget(e.target.value)}>
          {selected && <optgroup label="Selected object"><option value="selected">{selected.label}</option></optgroup>}
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
      {current && <ColorInput label="Colour" value={current.color} onChange={(color) => apply({ ...current, color }, `color:${target}`)} />}
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
            <button key={m.id} type="button" className={on ? "on" : ""} aria-pressed={on} title={m.info} onClick={() => apply({ materialId: m.id, color: m.color })}>
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

function CompareSection({ onView }: { onView: (a: string, b: string) => void }) {
  const house = useHouseDesign();
  const { variations, generated } = house.document;
  const options = [
    { id: "current", label: "Current design", design: house.design },
    ...(generated ? [{ id: "generated", label: "Generated design", design: generated }] : []),
    ...variations.map((v) => ({ id: v.id, label: v.name, design: v.design })),
  ];
  const [a, setA] = useState(options[1]?.id ?? "current");
  const [b, setB] = useState("current");
  const left = options.find((o) => o.id === a) ?? options[0], right = options.find((o) => o.id === b) ?? options[0];
  const differences = diffDesigns(left.design, right.design);
  const picker = (label: string, value: string, onChange: (id: string) => void) => (
    <label className="hd-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
    </label>
  );
  return (
    <section className="hd-group">
      <h3>Compare</h3>
      {picker("Left", left.id, setA)}
      {picker("Right", right.id, setB)}
      <button type="button" className="hd-button" onClick={() => onView(left.id, right.id)} disabled={left.id === right.id}><Columns2 size={15} /> View side by side in 3D</button>
      {left.id === right.id ? null : differences.length === 0 ? (
        <p className="hd-empty">These two designs are the same.</p>
      ) : (
        <table className="hd-match">
          <thead><tr><th /><th>{left.label}</th><th>{right.label}</th></tr></thead>
          <tbody>{differences.map((d) => <tr key={d.id}><td>{d.label}</td><td>{d.a}</td><td>{d.b}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

export function VariationsPanel({ scene, planFingerprint, onToast, onCompare }: { scene: React.RefObject<HouseSceneHandle | null>; planFingerprint: string; onToast: (message: string) => void; onCompare: (a: string, b: string) => void }) {
  const house = useHouseDesign();
  const { variations, activeVariationId, revisions } = house.document;
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const full = variations.length >= MAX_VARIATIONS;
  const hasDesign = Boolean(house.design);

  const add = async () => {
    const label = name.trim() || `Design ${variations.length + 1}`;
    const id = house.addVariation(label, await captureThumbnail(scene.current), planFingerprint);
    if (id) {
      setName("");
      onToast(`Saved "${label}"`);
    }
  };

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Project" title="Design variations">Keep several looks on the same floor plan and switch between them. Each one remembers all its settings and individual edits.</PanelHead>
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
                {v.planFingerprint && v.planFingerprint !== planFingerprint && <small className="hd-warn">Saved on an earlier floor plan</small>}
                <div className="hd-row-actions">
                  <button type="button" onClick={() => { house.openVariation(v.id); onToast(`Switched to "${v.name}"`); }} title="Switch to this design"><FolderOpen size={14} /> Open</button>
                  {v.id === activeVariationId && <button type="button" onClick={async () => { house.overwriteVariation(v.id, await captureThumbnail(scene.current), planFingerprint); onToast(`Updated "${v.name}"`); }} title="Save current changes here" aria-label="Save current changes here"><Save size={14} /></button>}
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

      {(variations.length > 0 || house.document.generated) && hasDesign && <CompareSection onView={onCompare} />}

      <section className="hd-group">
        <h3>Previous designs</h3>
        {revisions.length === 0 ? (
          <p className="hd-empty">Earlier designs appear here when you generate a new one or switch variations.</p>
        ) : (
          <ul className="hd-revisions">
            {revisions.map((r) => (
              <li key={r.id}>
                <span><b>{r.label}</b><small>{new Date(r.at).toLocaleString()}</small></span>
                <button type="button" onClick={() => { house.restoreRevision(r.id); onToast("Earlier design restored"); }}><History size={13} /> Restore</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ExportPanel({ scene, projectName, design, plan, objects }: { scene: React.RefObject<HouseSceneHandle | null>; projectName: string; design: HouseDesign | null; plan: FloorPlan; objects: SceneObject[] }) {
  const house = useHouseDesign();
  const { variations } = house.document;
  const [size, setSize] = useState(RENDER_SIZES[1].id);
  const [furniture, setFurniture] = useState(true);
  const [roof, setRoof] = useState(true);
  const [site, setSite] = useState(true);
  const [source, setSource] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement | null>(null);

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

  const exportVariations = () =>
    run("variations", async () => {
      if (source === "all") {
        await exportAllVariations(plan, variations, options, projectName);
        return `Saved a ZIP with ${variations.length} GLB ${variations.length === 1 ? "model" : "models"}.`;
      }
      const variation = variations.find((v) => v.id === source);
      if (!variation) throw new Error("That variation no longer exists.");
      await exportVariation(plan, variation, options, projectName);
      return `Saved "${variation.name}" as GLB.`;
    });

  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    const parsed = parseProjectFile(await picked.text());
    if (!parsed) {
      setMessage({ ok: false, text: "That is not a NEXORA design file." });
      return;
    }
    house.restoreDocument(parsed.document);
    const sameLayout = parsed.planFingerprint === planFingerprint(plan);
    setMessage({ ok: true, text: sameLayout ? "Design restored. Your earlier design is under Variations, in Previous designs." : "Design restored onto this floor plan, which differs from the one it was saved on. Individual edits to walls or windows that no longer exist were not applied." });
  };

  const icon = (label: string, Icon: typeof Download) => (busy === label ? <Loader2 size={15} className="hd-spin" /> : <Icon size={15} />);

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Project" title="Export">Renders use the current camera and lighting. Models keep the materials you chose, and every object keeps its name.</PanelHead>
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
        <button type="button" className="hd-button" disabled={Boolean(busy) || !design} onClick={() => run("glb", async () => { await exportGlb(liveScene(), options, baseName, design!, objects); return "Saved GLB with textures, named objects and your design settings."; })}>
          {icon("glb", Boxes)} GLB <small>textures and settings</small>
        </button>
        <button type="button" className="hd-button" disabled={Boolean(busy) || !design} onClick={() => run("gltf", async () => { await exportGlb(liveScene(), options, baseName, design!, objects, "gltf"); return "Saved glTF with everything embedded in one file."; })}>
          {icon("gltf", Boxes)} glTF <small>text format, one file</small>
        </button>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => run("obj", () => { exportObjArchive(liveScene(), options, baseName); return "Saved a ZIP with the OBJ and its MTL colours."; })}>
          {icon("obj", Download)} OBJ + MTL <small>colours, zipped</small>
        </button>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => run("stl", () => { exportStl(liveScene(), options, baseName); return "Saved STL. It holds shape only, with no colour."; })}>
          {icon("stl", Download)} STL <small>shape for 3D printing</small>
        </button>
      </section>
      {variations.length > 0 && (
        <section className="hd-group">
          <h3>Saved variations</h3>
          <p className="hd-hint">Saved as GLB without opening them. These hold the house and garden; to include furniture, open the variation and use the buttons above.</p>
          <label className="hd-select">
            <span>Export</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All variations (ZIP)</option>
              {variations.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={exportVariations}>{icon("variations", Layers3)} Export variations</button>
        </section>
      )}
      <section className="hd-group">
        <h3>Project file</h3>
        <p className="hd-hint">One file with the references, reading, every edit and all variations. Your project also saves itself as you work.</p>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => run("project", () => { exportProjectFile(plan, house.document, projectName); return "Saved the design file."; })}>{icon("project", Download)} Save a design file</button>
        <button type="button" className="hd-button" disabled={Boolean(busy)} onClick={() => file.current?.click()}><Upload size={15} /> Restore from a design file</button>
        <input ref={file} className="hd-hidden" type="file" accept="application/json,.json" aria-label="Design file" onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} />
      </section>
      {message && <p className={message.ok ? "hd-note ok" : "hd-error"} role="status">{message.text}</p>}
      <p className="hd-hint">Designs are conceptual visualizations, not construction drawings or approvals. Have a licensed professional review any building work.</p>
    </div>
  );
}
