"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { GALLERY, galleryMaterials, galleryPalette, type GalleryDesign } from "@/lib/house-design/gallery";
import { ARCH_CATEGORIES, type ArchCategory } from "@/lib/house-design/schema";
import { categoryLabel } from "@/lib/house-design/styles";

function Preview({ entry }: { entry: GalleryDesign }) {
  const [failed, setFailed] = useState(false);
  const palette = galleryPalette(entry.design);
  if (failed) return <div className="hd-card-fallback" style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1] ?? palette[0]} 60%, ${palette[2] ?? palette[0]})` }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={entry.image} alt={`${entry.name}, ${categoryLabel(entry.category)} house`} loading="lazy" onError={() => setFailed(true)} />;
}

export function GalleryOverlay({ appliedId, onApply, onClose }: { appliedId?: string; onApply: (id: string) => void; onClose: () => void }) {
  const [filter, setFilter] = useState<ArchCategory | "all">("all");
  const shown = GALLERY.filter((g) => filter === "all" || g.category === filter);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="hd-gallery" role="dialog" aria-label="Design gallery">
      <header>
        <div>
          <span>Design gallery</span>
          <h2>Start from an architectural design</h2>
          <p>Applying a design restyles your house. Your rooms, walls and measurements do not change.</p>
        </div>
        <button type="button" className="hd-icon" onClick={onClose} aria-label="Close gallery"><X size={18} /></button>
      </header>
      <div className="hd-filters" role="tablist">
        <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All styles</button>
        {ARCH_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={filter === c.id} className={filter === c.id ? "on" : ""} title={c.blurb} onClick={() => setFilter(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="hd-gallery-grid">
        {shown.map((entry) => (
          <article key={entry.id} className="hd-card">
            <div className="hd-card-image">
              <Preview entry={entry} />
              <span>{categoryLabel(entry.category)}</span>
            </div>
            <div className="hd-card-body">
              <h3>{entry.name}</h3>
              <p>{entry.summary}</p>
              <div className="hd-dots" aria-label="Colour palette">
                {galleryPalette(entry.design).map((c) => <i key={c} style={{ background: c }} title={c} />)}
              </div>
              <small>{galleryMaterials(entry.design).join(" · ")}</small>
              <button type="button" className="hd-button primary" onClick={() => onApply(entry.id)}>
                {entry.id === appliedId && <Check size={14} />} {entry.id === appliedId ? "Applied, apply again" : "Apply Design"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
