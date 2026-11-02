"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Heart, Loader2, Search, X } from "lucide-react";
import { BUILDING_TYPES, catalog, catalogCategories, previewImage, searchCatalog, type CatalogDesign } from "@/lib/house-design/catalog";
import { useHouseDesign } from "@/lib/house-design/context";
import { galleryMaterials, galleryPalette } from "@/lib/house-design/gallery";
import { MATERIAL_CATEGORIES } from "@/lib/house-design/materials";

const PAGE = 24;
const MAX_RECENT = 24;

type View = "all" | "favorites" | "recent";

function Card({ entry, selected, favorite, onSelect, onFavorite }: { entry: CatalogDesign; selected: boolean; favorite: boolean; onSelect: () => void; onFavorite: () => void }) {
  return (
    <article className={`hd-card${selected ? " selected" : ""}`}>
      <button type="button" className="hd-card-main" onClick={onSelect} aria-pressed={selected}>
        <div className="hd-card-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage(entry)} alt={`${entry.name}, ${entry.view.toLowerCase()}`} loading="lazy" decoding="async" />
          <span>{entry.categoryName}</span>
          {selected ? <em className="hd-card-picked"><Check size={13} /> Selected</em> : <em className="hd-card-hover">Select</em>}
        </div>
        <div className="hd-card-body">
          <h3>{entry.name}</h3>
          <p>{entry.summary}</p>
          <div className="hd-dots" aria-label="Colour palette">{galleryPalette(entry.design).map((c) => <i key={c} style={{ background: c }} title={c} />)}</div>
          <small>{entry.subcategory} · {entry.buildingType} · {entry.view}</small>
        </div>
      </button>
      <button type="button" className={`hd-card-heart${favorite ? " on" : ""}`} onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`}>
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

export function GalleryOverlay({ applying, onApply, onClose }: { applying: boolean; onApply: (id: string) => void; onClose: () => void }) {
  const house = useHouseDesign();
  const { selectedId, favorites, recent } = house.document.gallery;
  const entries = useMemo(() => catalog(), []);
  const categories = useMemo(() => catalogCategories(), []);
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const [buildingType, setBuildingType] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [view, setView] = useState<View>("all");
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const pool = view === "favorites" ? entries.filter((e) => favorites.includes(e.id)) : view === "recent" ? entries.filter((e) => recent.includes(e.id)) : entries;
    const found = searchCatalog(pool, { text, categoryId, subcategory, material, buildingType, sort });
    return view === "recent" ? found.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id)) : found;
  }, [entries, favorites, recent, view, text, categoryId, subcategory, material, buildingType, sort]);

  useEffect(() => setLimit(PAGE), [view, text, categoryId, subcategory, material, buildingType, sort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const select = (id: string) => house.updateGallery((g) => ({ ...g, selectedId: id, recent: [id, ...g.recent.filter((r) => r !== id)].slice(0, MAX_RECENT) }));
  const favorite = (id: string) => house.updateGallery((g) => ({ ...g, favorites: g.favorites.includes(id) ? g.favorites.filter((f) => f !== id) : [id, ...g.favorites] }));
  const selected = entries.find((e) => e.id === selectedId);
  const pickCategory = (id: string | null, sub: string | null = null) => { setCategoryId(id); setSubcategory(sub); };

  return (
    <div className="hd-gallery" role="dialog" aria-label="Design gallery">
      <header>
        <div>
          <span>Design gallery</span>
          <h2>Start from an architectural design</h2>
          <p>Select a design, then apply it. Your rooms, walls and measurements do not change, so the number of floors stays as drawn.</p>
        </div>
        <button type="button" className="hd-icon" onClick={onClose} aria-label="Close gallery"><X size={18} /></button>
      </header>
      <div className="hd-gallery-tools">
        <label className="hd-search"><Search size={14} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name or style" aria-label="Search designs" /></label>
        <select value={material ?? ""} onChange={(e) => setMaterial(e.target.value || null)} aria-label="Material">
          <option value="">All materials</option>
          {MATERIAL_CATEGORIES.filter((c) => entries.some((e) => e.material === c.label)).map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
        </select>
        <select value={buildingType ?? ""} onChange={(e) => setBuildingType(e.target.value || null)} aria-label="Building type">
          <option value="">All building types</option>
          {BUILDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "name")} aria-label="Sort">
          <option value="recent">Recently added</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>
      <div className="hd-gallery-body">
        <nav className="hd-gallery-nav" aria-label="Design categories">
          {(["all", "favorites", "recent"] as View[]).map((v) => (
            <button key={v} type="button" className={view === v && (v !== "all" || !categoryId) ? "on" : ""} onClick={() => { setView(v); pickCategory(null); }}>
              {v === "all" ? "All designs" : v === "favorites" ? "Favorites" : "Recently viewed"}
            </button>
          ))}
          <hr />
          {categories.map((c) => (
            <div key={c.id}>
              <button type="button" className={categoryId === c.id && !subcategory ? "on" : ""} aria-expanded={categoryId === c.id} onClick={() => { setView("all"); pickCategory(categoryId === c.id && !subcategory ? null : c.id); }}>
                {c.label} <ChevronDown size={12} />
              </button>
              {categoryId === c.id && (
                <div className="hd-gallery-subs">
                  {c.subcategories.map((s) => <button key={s} type="button" className={subcategory === s ? "on" : ""} onClick={() => pickCategory(c.id, s)}>{s}</button>)}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="hd-gallery-scroll">
          {results.length === 0 ? (
            <p className="hd-empty">{view === "favorites" ? "Tap the heart on a design to keep it here." : view === "recent" ? "Designs you select appear here." : "Nothing matches. Try another word or clear a filter."}</p>
          ) : (
            <div className="hd-gallery-grid">
              {results.slice(0, limit).map((entry) => (
                <Card key={entry.id} entry={entry} selected={entry.id === selectedId} favorite={favorites.includes(entry.id)} onSelect={() => select(entry.id)} onFavorite={() => favorite(entry.id)} />
              ))}
            </div>
          )}
          {limit < results.length && <button type="button" className="hd-button hd-more" onClick={() => setLimit((l) => l + PAGE)}>Show more designs</button>}
        </div>
      </div>
      {selected && (
        <footer className="hd-gallery-bar">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage(selected)} alt="" />
            <span><b>{selected.name}</b><small>{selected.categoryName} · {galleryMaterials(selected.design).slice(0, 2).join(" · ")}</small></span>
          </div>
          <button type="button" className="hd-button primary" disabled={applying} onClick={() => onApply(selected.id)}>
            {applying ? <Loader2 size={15} className="hd-spin" /> : <Check size={15} />} {applying ? "Applying design" : "Apply Design"}
          </button>
        </footer>
      )}
    </div>
  );
}
