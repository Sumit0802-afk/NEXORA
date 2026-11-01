"use client";

import { useEffect, useMemo, useState } from "react";
import { MATERIALS, MATERIAL_CATEGORIES, getMaterial, type MaterialCategory } from "@/lib/house-design/materials";
import { materialSwatch } from "@/lib/house-design/textures";
import type { Finish } from "@/lib/house-design/schema";

export function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="hd-group">
      <h3>{title}</h3>
      {hint && <p className="hd-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function PanelHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="hd-panel-head">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (on: boolean) => void; hint?: string }) {
  return (
    <label className="hd-toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="hd-slider">
      <span>
        {label}
        <b>
          {Number.isInteger(step) ? Math.round(value) : value.toFixed(step < 0.1 ? 2 : 1)}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <label className="hd-color">
      <span>{label}</span>
      <input type="color" value={value.slice(0, 7).toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

export type Choice<T extends string> = { id: T; label: string; hint?: string };

export function Choices<T extends string>({ label, value, options, onChange, columns = 2 }: { label?: string; value: T; options: Choice<T>[]; onChange: (id: T) => void; columns?: number }) {
  return (
    <div className="hd-choices-wrap">
      {label && <span className="hd-label">{label}</span>}
      <div className="hd-choices" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={option.id === value} className={option.id === value ? "on" : ""} title={option.hint} onClick={() => onChange(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Client-only: swatches are drawn on a canvas, so the first paint on the server shows a flat colour. */
export function Swatch({ materialId, color, size = 56 }: { materialId: string; color?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => setUrl(materialSwatch(materialId, color)), [materialId, color]);
  const fallback = color ?? getMaterial(materialId).color;
  return <span className="hd-swatch" style={{ width: size, height: size, background: url ? `center / cover url(${url})` : fallback }} aria-hidden="true" />;
}

/** A material and tint for one surface. `categories` limits the choice to what makes sense for that surface. */
export function FinishPicker({ label, value, categories, onChange, compact }: { label: string; value: Finish; categories: MaterialCategory[]; onChange: (finish: Finish, group?: string) => void; compact?: boolean }) {
  const current = getMaterial(value.materialId);
  const [category, setCategory] = useState<MaterialCategory>(categories.includes(current.category) ? current.category : categories[0]);
  useEffect(() => {
    if (categories.includes(current.category)) setCategory(current.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.category]);
  const materials = useMemo(() => MATERIALS.filter((m) => m.category === category), [category]);
  const [open, setOpen] = useState(!compact);

  return (
    <div className={`hd-finish${open ? " open" : ""}`}>
      <button type="button" className="hd-finish-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Swatch materialId={value.materialId} color={value.color} size={36} />
        <span>
          <b>{label}</b>
          <small>{current.name}</small>
        </span>
      </button>
      {open && (
        <div className="hd-finish-body">
          {categories.length > 1 && (
            <div className="hd-tabs" role="tablist">
              {categories.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={id === category} className={id === category ? "on" : ""} onClick={() => setCategory(id)}>
                  {MATERIAL_CATEGORIES.find((c) => c.id === id)?.label}
                </button>
              ))}
            </div>
          )}
          <div className="hd-material-row">
            {materials.map((m) => (
              <button key={m.id} type="button" className={m.id === value.materialId ? "on" : ""} title={`${m.name}: ${m.info}`} aria-label={m.name} aria-pressed={m.id === value.materialId} onClick={() => onChange({ materialId: m.id, color: m.color })}>
                <Swatch materialId={m.id} size={44} />
                <small>{m.name}</small>
              </button>
            ))}
          </div>
          <ColorInput label="Colour" value={value.color} onChange={(color) => onChange({ ...value, color }, `color:${label}`)} />
        </div>
      )}
    </div>
  );
}

export const WALL_MATERIALS: MaterialCategory[] = ["paint", "brick", "stone", "concrete", "wood", "marble", "tile"];
export const TRIM_MATERIALS: MaterialCategory[] = ["paint", "metal", "wood", "stone", "marble"];
export const ROOF_MATERIALS: MaterialCategory[] = ["roofing", "metal", "concrete"];
export const FLOOR_MATERIALS: MaterialCategory[] = ["wood", "marble", "tile", "stone", "concrete"];
export const GROUND_MATERIALS: MaterialCategory[] = ["ground", "stone", "tile"];
