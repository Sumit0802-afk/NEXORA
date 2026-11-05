"use client";

import type { FloorPlan } from "@houseplan/design-schema";
import { BOUNDARY_STYLES, boundaryLayout, boundaryOf, withBoundaryConfig, type BoundaryStyle } from "@/lib/boundary";
import { MATERIALS } from "@/lib/house-design/materials";
import type { ExteriorConfig } from "@/lib/terrace-catalog";

const WALL_FINISHES = MATERIALS.filter((m) => ["paint", "brick", "stone", "concrete", "wood"].includes(m.category));

/**
 * Boundary wall settings. They live on the plan, so the 2D editor, the 3D view and the design studio show the same
 * wall, and saving the project keeps them. Lengths are shown and entered in the plan's units.
 */
export function BoundaryPanel({ plan, onChange }: { plan: FloorPlan; onChange: (next: FloorPlan) => void }) {
  const s = boundaryOf(plan);
  const layout = boundaryLayout(plan);
  const unit = plan.units === "m" ? "m" : "ft";
  const ft = plan.units === "m" ? 0.3048 : 1;
  const set = (patch: Partial<ExteriorConfig>) => onChange(withBoundaryConfig(plan, patch));
  const num = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 };

  return (
    <div className="boundary-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={row}>
        <span>Boundary wall around the plot</span>
        <input type="checkbox" checked={s.enabled} onChange={(e) => set({ hasBoundaryWall: e.target.checked })} aria-label="Show the boundary wall" />
      </label>
      {s.enabled && (
        <>
          <label style={row}>
            <span>Style</span>
            <select value={s.style} onChange={(e) => set({ boundaryStyle: e.target.value as BoundaryStyle })}>
              {BOUNDARY_STYLES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label style={row}>
            <span>Height ({unit})</span>
            <input type="number" min={num(2 * ft)} max={num(10 * ft)} step={num(0.25 * ft)} value={num(s.height)} onChange={(e) => set({ boundaryWallHeight: Math.min(10, Math.max(2, Number(e.target.value) / ft)) })} style={{ width: 80 }} />
          </label>
          <label style={row}>
            <span>Thickness ({unit})</span>
            <input type="number" min={num(0.33 * ft)} max={num(2 * ft)} step={num(0.05 * ft)} value={num(s.thickness)} onChange={(e) => set({ boundaryThickness: Math.min(2, Math.max(0.33, Number(e.target.value) / ft)) })} style={{ width: 80 }} />
          </label>
          <label style={row}>
            <span>Material</span>
            <select value={s.materialId} onChange={(e) => { const m = WALL_FINISHES.find((x) => x.id === e.target.value)!; set({ boundaryMaterial: m.id, boundaryColor: m.color }); }}>
              {WALL_FINISHES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label style={row}>
            <span>Colour</span>
            <input type="color" value={s.color.slice(0, 7).toLowerCase()} onChange={(e) => set({ boundaryColor: e.target.value.toUpperCase() })} />
          </label>
          <label style={row}>
            <span>Main gate</span>
            <input type="checkbox" checked={s.mainGate} onChange={(e) => set({ hasMainGate: e.target.checked })} />
          </label>
          {s.mainGate && (
            <>
              <label style={row}>
                <span>Gate width ({unit})</span>
                <input type="number" min={num(6 * ft)} max={num(24 * ft)} step={num(0.5 * ft)} value={num(s.gateWidth)} onChange={(e) => set({ gateWidth: Math.min(24, Math.max(6, Number(e.target.value) / ft)) })} style={{ width: 80 }} />
              </label>
              <label style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                <span>Gate position along the street side</span>
                <input type="range" min={0} max={plan.plot.width} step={0.5} value={s.gateCenter ?? layout.gates.find((g) => g.kind === "main")?.from ?? plan.plot.width / 2} onChange={(e) => set({ gateCenter: Number(e.target.value) / ft })} />
              </label>
              {s.gateCenter !== null && <button type="button" className="button" onClick={() => set({ gateCenter: null })}>Place the gate automatically</button>}
              <label style={row}>
                <span>Pedestrian gate</span>
                <input type="checkbox" checked={s.pedestrianGate} onChange={(e) => set({ hasPedestrianGate: e.target.checked })} />
              </label>
            </>
          )}
          {layout.notes.map((n) => <p key={n} style={{ margin: 0, fontSize: 12, color: "#7a5b00" }}>{n}</p>)}
          <p style={{ margin: 0, fontSize: 12, color: "#817D94" }}>The wall follows the plot line. Where the house stands on the plot line, the house wall takes its place.</p>
        </>
      )}
    </div>
  );
}
