"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { BoundaryPanel } from "./BoundaryPanel";

/** The boundary wall settings as a dialog, for the 2D editor and the 3D view. */
export function BoundaryModal({ plan, onChange, onClose }: { plan: FloorPlan; onChange: (next: FloorPlan) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Boundary wall" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 16, background: "rgba(24, 20, 52, 0.35)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(380px, 100%)", maxHeight: "90vh", overflowY: "auto", padding: 18, borderRadius: 14, background: "var(--surface, #fff)", color: "var(--ink, #302A65)", boxShadow: "0 20px 50px rgba(24, 20, 52, 0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Boundary wall and gates</strong>
          <button type="button" className="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <BoundaryPanel plan={plan} onChange={onChange} />
      </div>
    </div>
  );
}
