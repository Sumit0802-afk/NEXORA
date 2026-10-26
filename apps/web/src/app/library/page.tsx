"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Camera, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import {
  ApiError,
  createProjectFromPlan,
  generateLayouts,
  getLibraryDesign,
  getLibraryFacets,
  listLibrary,
  setLibraryFavourite,
  type LibraryDetail,
  type LibraryEntry,
  type LibraryFacets,
  type LibraryQuery,
} from "@/lib/api";
import { MiniPlan } from "@/components/library/MiniPlan";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";
import { buildStylePlan, styleCatalog, terraceStyleName, type StyleEntry } from "@/lib/style-library";
import { validateDesign } from "@/lib/validation";
import { floorName } from "@/lib/floors";

type Tab = "layouts" | "styles";

const AREA_BANDS = [
  { id: "any", label: "Any plot size", min: 0, max: 0 },
  { id: "s", label: "Up to 1,000 sq ft", min: 0, max: 1000 },
  { id: "m", label: "1,000 – 1,800 sq ft", min: 1000, max: 1800 },
  { id: "l", label: "1,800 – 2,800 sq ft", min: 1800, max: 2800 },
  { id: "xl", label: "2,800 sq ft and above", min: 2800, max: 0 },
] as const;

const TAG_FILTERS = ["Villa", "Compact", "Family home", "Terrace", "Parking", "Study", "Garden"];
const LAYOUT_TAGS = ["Central passage", "Kitchen-dining wing", "Public | private split"];

const roomListFor = (counts: Record<string, number>) =>
  Object.entries(counts).filter(([k]) => k !== "staircase").map(([k, n]) => `${n} ${k.replace("_", " ")}`).join(", ");

function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" className={`lib-chip${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
      {count !== undefined && <small>{count}</small>}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function LibraryInner() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("layouts");

  // ── filters ──
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [floors, setFloors] = useState<number[]>([]);
  const [beds, setBeds] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [band, setBand] = useState<(typeof AREA_BANDS)[number]["id"]>("any");
  const [sort, setSort] = useState<NonNullable<LibraryQuery["sort"]>>("score");
  const [onlyFav, setOnlyFav] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // ── layout library (server) ──
  const [facets, setFacets] = useState<LibraryFacets | null>(null);
  const [items, setItems] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<{ progress: number; target: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const query = useMemo<LibraryQuery>(() => {
    const b = AREA_BANDS.find((x) => x.id === band)!;
    return { q: debouncedQ, tags, floors, bedrooms: beds, minArea: b.min, maxArea: b.max, favourites: onlyFav, sort };
  }, [debouncedQ, tags, floors, beds, band, onlyFav, sort]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await listLibrary({ ...query, offset, limit: 24 });
        if (id !== requestId.current) return;
        if (!page.ready) {
          setBuilding({ progress: page.progress ?? 0, target: page.target ?? 0 });
          setItems([]);
          setTotal(0);
          return;
        }
        setBuilding(null);
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setFavs((prev) => {
          const next = new Set(offset === 0 && !onlyFav ? [] : prev);
          page.favourites.forEach((f) => next.add(f));
          return next;
        });
      } catch (err) {
        if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load the library.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [query, onlyFav],
  );

  useEffect(() => {
    if (tab === "layouts") void load(0);
  }, [tab, load]);

  // While the catalogue is still being prepared on the server, check again shortly.
  useEffect(() => {
    if (!building || tab !== "layouts") return;
    const t = setTimeout(() => void load(0), 2000);
    return () => clearTimeout(t);
  }, [building, tab, load]);

  useEffect(() => {
    getLibraryFacets().then(setFacets).catch(() => undefined);
  }, [building]);

  const flipFavourite = async (id: string) => {
    const on = !favs.has(id);
    setFavs((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    try {
      await setLibraryFavourite(id, on);
      if (!on && onlyFav) {
        setItems((prev) => prev.filter((e) => e.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch {
      setFavs((prev) => {
        const next = new Set(prev);
        if (on) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  // ── style designs (in-browser engine) ──
  const styles = useMemo(() => (tab === "styles" ? styleCatalog() : []), [tab]);
  const [styleKind, setStyleKind] = useState<string[]>([]);
  const styleFootprints = useMemo(() => [...new Set(styles.map((s) => s.footprint))], [styles]);
  const filteredStyles = useMemo(() => {
    const b = AREA_BANDS.find((x) => x.id === band)!;
    const needle = debouncedQ.toLowerCase();
    return styles.filter(
      (s) =>
        (!floors.length || floors.includes(s.floors)) &&
        (!styleKind.length || styleKind.includes(s.footprint)) &&
        s.plotArea >= b.min &&
        (!b.max || s.plotArea <= b.max) &&
        (!needle || `${s.style} ${s.tagline} ${s.footprint} ${s.id}`.toLowerCase().includes(needle)),
    );
  }, [styles, floors, styleKind, band, debouncedQ]);
  const [stylePage, setStylePage] = useState(1);
  useEffect(() => setStylePage(1), [floors, styleKind, band, debouncedQ, tab]);

  // ── detail ──
  const [open, setOpen] = useState<{ kind: "layout"; entry: LibraryEntry } | { kind: "style"; entry: StyleEntry } | null>(null);

  const clearFilters = () => {
    setQ("");
    setFloors([]);
    setBeds([]);
    setTags([]);
    setStyleKind([]);
    setBand("any");
    setOnlyFav(false);
  };
  const hasFilters = Boolean(q || floors.length || beds.length || tags.length || styleKind.length || band !== "any" || onlyFav);

  const shownTotal = tab === "layouts" ? total : filteredStyles.length;

  return (
    <main className="lib-page">
      <header className="lib-top">
        <Link href="/" className="lib-back"><ArrowLeft size={16} /> Workspace</Link>
        <div className="lib-top-actions">
          <Link href="/library/photo" className="button outline"><Camera size={15} /> Start from a photo</Link>
        </div>
      </header>

      <section className="lib-hero">
        <h1>House design library</h1>
        <p>
          Every design here is a real, editable plan with rooms, walls, doors, windows, stairs and terraces. Open one in the
          editor, check it in 3D, and change anything.
          {facets?.ready && facets.total !== undefined && (
            <> The layout library currently holds <strong>{facets.total.toLocaleString()}</strong> distinct generated layouts.</>
          )}
        </p>
        <div className="lib-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "layouts"} className={tab === "layouts" ? "active" : ""} onClick={() => setTab("layouts")}>
            Layouts{facets?.ready && facets.total !== undefined ? ` (${facets.total.toLocaleString()})` : ""}
          </button>
          <button role="tab" aria-selected={tab === "styles"} className={tab === "styles" ? "active" : ""} onClick={() => setTab("styles")}>
            Architectural styles
          </button>
        </div>
      </section>

      <div className="lib-bar">
        <label className="lib-search">
          <Search size={16} />
          <input type="search" placeholder={tab === "layouts" ? "Search by size, rooms, layout or ID…" : "Search styles…"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search designs" />
        </label>
        <button type="button" className="button outline lib-filter-toggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={15} /> Filters
        </button>
        <select className="lib-select" value={band} onChange={(e) => setBand(e.target.value as typeof band)} aria-label="Plot size">
          {AREA_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        {tab === "layouts" && (
          <select className="lib-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="score">Best fit first</option>
            <option value="area_asc">Plot size: small to large</option>
            <option value="area_desc">Plot size: large to small</option>
            <option value="bedrooms">Most bedrooms</option>
          </select>
        )}
        {tab === "layouts" && (
          <button type="button" className={`button outline lib-fav-toggle${onlyFav ? " on" : ""}`} aria-pressed={onlyFav} onClick={() => setOnlyFav((v) => !v)}>
            <Heart size={15} /> Favourites
          </button>
        )}
      </div>

      <div className={`lib-filters${filtersOpen ? " open" : ""}`}>
        <div className="lib-filter-group">
          <span>Floors</span>
          {[1, 2, 3].map((n) => (
            <Chip key={n} on={floors.includes(n)} onClick={() => setFloors((f) => toggle(f, n))} count={tab === "layouts" ? facets?.floors?.[String(n)] : undefined}>
              {n === 1 ? "Bungalow (1)" : n === 2 ? "Duplex (2)" : "Triplex (3)"}
            </Chip>
          ))}
        </div>
        {tab === "layouts" ? (
          <>
            <div className="lib-filter-group">
              <span>Bedrooms</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} on={beds.includes(n)} onClick={() => setBeds((b) => toggle(b, n))} count={facets?.bedrooms?.[String(n)]}>
                  {n === 5 ? "5+" : n} BHK
                </Chip>
              ))}
            </div>
            <div className="lib-filter-group">
              <span>Style</span>
              {TAG_FILTERS.map((t) => (
                <Chip key={t} on={tags.includes(t)} onClick={() => setTags((x) => toggle(x, t))} count={facets?.tags?.[t]}>{t}</Chip>
              ))}
            </div>
            <div className="lib-filter-group">
              <span>Layout</span>
              {LAYOUT_TAGS.map((t) => (
                <Chip key={t} on={tags.includes(t)} onClick={() => setTags((x) => toggle(x, t))} count={facets?.tags?.[t]}>{t}</Chip>
              ))}
            </div>
          </>
        ) : (
          <div className="lib-filter-group">
            <span>Home style</span>
            {styleFootprints.map((f) => (
              <Chip key={f} on={styleKind.includes(f)} onClick={() => setStyleKind((x) => toggle(x, f))}>{f}</Chip>
            ))}
          </div>
        )}
        {hasFilters && <button type="button" className="lib-clear" onClick={clearFilters}>Clear all filters</button>}
      </div>

      <p className="lib-count" aria-live="polite">
        {tab === "layouts" && building
          ? `Preparing the library… ${building.progress.toLocaleString()} of ${building.target.toLocaleString()} layouts ready`
          : `${shownTotal.toLocaleString()} design${shownTotal === 1 ? "" : "s"}${hasFilters ? " match your filters" : ""}`}
      </p>

      {error && <div className="auth-error lib-error" role="alert">{error}</div>}

      {tab === "layouts" ? (
        <>
          <div className="lib-grid">
            {items.map((e) => (
              <article key={e.id} className="lib-card">
                <button type="button" className="lib-card-main" onClick={() => setOpen({ kind: "layout", entry: e })} aria-label={`Open ${e.name}`}>
                  <div className="lib-thumb">
                    <MiniPlan rooms={e.preview[0].rooms} width={e.plot.width} length={e.plot.length} label={`${e.name} ground floor`} />
                    {e.floors > 1 && <span className="lib-badge">{e.floors} floors</span>}
                  </div>
                  <h3>{e.bedrooms} BHK {e.floors === 1 ? "Bungalow" : e.floors === 2 ? "Duplex" : "Triplex"}</h3>
                  <p className="lib-meta">{e.plot.width} × {e.plot.length} ft · {e.templateLabel}</p>
                  <p className="lib-meta">{e.builtUp.toLocaleString()} sq ft built-up · {e.bathrooms} bath</p>
                  <ul className="lib-tags">
                    {e.tags.filter((t) => TAG_FILTERS.includes(t)).slice(0, 3).map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </button>
                <button type="button" className={`lib-heart${favs.has(e.id) ? " on" : ""}`} onClick={() => void flipFavourite(e.id)} aria-pressed={favs.has(e.id)} aria-label={favs.has(e.id) ? "Remove from favourites" : "Add to favourites"}>
                  <Heart size={17} />
                </button>
              </article>
            ))}
          </div>
          {loading && <p className="lib-status">Loading…</p>}
          {!loading && !building && items.length === 0 && !error && (
            <div className="lib-empty">
              <Building2 size={28} />
              <p>{onlyFav ? "You have no favourites yet. Tap the heart on a design to keep it here." : "No designs match these filters."}</p>
              {hasFilters && <button className="button outline" onClick={clearFilters}>Clear filters</button>}
            </div>
          )}
          {!loading && items.length < total && (
            <div className="lib-more"><button className="button outline" onClick={() => void load(items.length)}>Show more designs</button></div>
          )}
        </>
      ) : (
        <>
          <div className="lib-grid">
            {filteredStyles.slice(0, stylePage * 24).map((s) => (
              <StyleCard key={s.id} entry={s} onOpen={() => setOpen({ kind: "style", entry: s })} />
            ))}
          </div>
          {filteredStyles.length === 0 && <div className="lib-empty"><Building2 size={28} /><p>No styles match these filters.</p></div>}
          {filteredStyles.length > stylePage * 24 && (
            <div className="lib-more"><button className="button outline" onClick={() => setStylePage((p) => p + 1)}>Show more designs</button></div>
          )}
        </>
      )}

      {open && (
        <DesignDialog
          target={open}
          favourite={open.kind === "layout" ? favs.has(open.entry.id) : false}
          onFavourite={open.kind === "layout" ? () => void flipFavourite(open.entry.id) : undefined}
          onClose={() => setOpen(null)}
          onOpened={(projectId) => router.push(`/studio/${projectId}`)}
        />
      )}
    </main>
  );
}

function StyleCard({ entry, onOpen }: { entry: StyleEntry; onOpen: () => void }) {
  const plan = useMemo(() => buildStylePlan(entry), [entry]);
  return (
    <article className="lib-card">
      <button type="button" className="lib-card-main" onClick={onOpen} aria-label={`Open ${entry.style}, ${entry.plot.width} by ${entry.plot.length} feet, ${entry.floors} floors`}>
        <div className="lib-thumb">
          <PlanThumbnail plan={plan} className="lib-style-plan" title={entry.style} />
          {entry.floors > 1 && <span className="lib-badge">{entry.floors} floors</span>}
        </div>
        <h3>{entry.style}</h3>
        <p className="lib-meta">{entry.plot.width} × {entry.plot.length} ft · {entry.footprint}</p>
        <p className="lib-meta">{entry.tagline}</p>
      </button>
    </article>
  );
}

/** Opens a design: plan per floor, facts, checks, plot fitting, and "open in the editor". */
function DesignDialog({
  target,
  favourite,
  onFavourite,
  onClose,
  onOpened,
}: {
  target: { kind: "layout"; entry: LibraryEntry } | { kind: "style"; entry: StyleEntry };
  favourite: boolean;
  onFavourite?: () => void;
  onClose: () => void;
  onOpened: (projectId: string) => void;
}) {
  const [detail, setDetail] = useState<LibraryDetail | null>(null);
  const [plan, setPlan] = useState<FloorPlan | null>(target.kind === "style" ? buildStylePlan(target.entry) : null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState<{ w: string; l: string } | null>(null);
  const [adapted, setAdapted] = useState(false);

  useEffect(() => {
    if (target.kind !== "layout") return;
    let cancelled = false;
    getLibraryDesign(target.entry.id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setPlan(d.design);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not open this design."));
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const entry = target.entry;
  const title = target.kind === "layout" ? target.entry.name : `${target.entry.style} · ${target.entry.plot.width}×${target.entry.plot.length} ft`;
  const issues = useMemo(() => (plan ? validateDesign(plan) : []), [plan]);
  const errors = issues.filter((i) => i.severity === "error");

  const openInEditor = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      onOpened(await createProjectFromPlan(title, plan));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project.");
      setBusy(false);
    }
  };

  const fitToPlot = async () => {
    if (target.kind !== "layout" || !custom) return;
    const w = parseFloat(custom.w);
    const l = parseFloat(custom.l);
    if (!(w >= 15 && w <= 200 && l >= 15 && l <= 200)) {
      setError("Enter a plot width and length between 15 and 200 ft.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = target.entry.recipe;
      const result = await generateLayouts({ roomList: roomListFor(r.counts), description: "", plotWidth: w, plotLength: l, units: "ft", floors: r.floors, seed: r.seed });
      const best = result.candidates.find((c) => c.template === target.entry.template) ?? result.candidates[0];
      if (!best) {
        setError(result.message ?? "These rooms do not fit that plot. Try a larger plot.");
      } else {
        setPlan(best.design);
        setLevel(0);
        setAdapted(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not adapt the design.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (detail) setPlan(detail.design);
    setAdapted(false);
  };

  return (
    <div className="lib-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lib-dialog">
        <header>
          <div>
            <p className="lib-id">{target.kind === "layout" ? target.entry.id : target.entry.id}</p>
            <h2>{title}</h2>
          </div>
          <div className="lib-dialog-actions">
            {onFavourite && (
              <button type="button" className={`lib-heart inline${favourite ? " on" : ""}`} onClick={onFavourite} aria-pressed={favourite} aria-label={favourite ? "Remove from favourites" : "Add to favourites"}>
                <Heart size={18} />
              </button>
            )}
            <button type="button" className="interior-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </header>

        <div className="lib-dialog-body">
          <div className="lib-preview">
            {plan ? (
              <>
                {plan.levels.length > 1 && (
                  <div className="lib-levels" role="tablist" aria-label="Floors">
                    {plan.levels.map((l, i) => (
                      <button key={l.id} role="tab" aria-selected={level === i} className={level === i ? "active" : ""} onClick={() => setLevel(i)}>
                        {floorName(i)}
                      </button>
                    ))}
                  </div>
                )}
                <PlanThumbnail plan={plan} levelIndex={level} dimensions title={`${title}, ${floorName(level)}`} className="lib-big-plan" />
              </>
            ) : (
              <p className="lib-status">{error ?? "Loading plan…"}</p>
            )}
          </div>

          <div className="lib-facts">
            {target.kind === "layout" ? (
              <>
                <dl>
                  <dt>Plot</dt><dd>{plan ? `${plan.plot.width} × ${plan.plot.length} ${plan.units}` : `${entry.plot.width} × ${entry.plot.length} ft`}{adapted && " (your plot)"}</dd>
                  <dt>Floors</dt><dd>{plan?.levels.length ?? target.entry.floors}</dd>
                  <dt>Bedrooms</dt><dd>{target.entry.bedrooms}</dd>
                  <dt>Bathrooms</dt><dd>{target.entry.bathrooms}</dd>
                  <dt>Built-up</dt><dd>{target.entry.builtUp.toLocaleString()} sq ft</dd>
                  <dt>Layout</dt><dd>{target.entry.templateLabel}</dd>
                  <dt>Terrace</dt><dd>{target.entry.hasTerrace ? "Yes, reached from the staircase" : "No"}</dd>
                </dl>
                <p className="lib-note">{target.entry.summary}</p>
                {(detail?.highlights ?? target.entry.highlights).length > 0 && (
                  <ul className="lib-points">{(detail?.highlights ?? target.entry.highlights).map((h) => <li key={h}>{h}</li>)}</ul>
                )}
              </>
            ) : (
              <>
                <dl>
                  <dt>Plot</dt><dd>{target.entry.plot.width} × {target.entry.plot.length} ft</dd>
                  <dt>Floors</dt><dd>{target.entry.floors}</dd>
                  <dt>Style</dt><dd>{target.entry.footprint}</dd>
                  <dt>Terrace</dt><dd>{target.entry.floors > 1 ? terraceStyleName(target.entry.terrace) : "None (single floor)"}</dd>
                  <dt>Best facing</dt><dd>{target.entry.orientation}</dd>
                </dl>
                <p className="lib-note">{target.entry.tagline}</p>
                <ul className="lib-points">{target.entry.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </>
            )}

            <div className={`lib-checks${errors.length ? " bad" : ""}`}>
              <strong>{plan ? (errors.length ? `${errors.length} issue${errors.length > 1 ? "s" : ""} to fix` : "Checked: no overlaps, stairs line up, terrace reachable") : "Checking…"}</strong>
              {errors.slice(0, 4).map((i) => <p key={i.id}>{i.message}</p>)}
            </div>

            {target.kind === "layout" && (
              <details className="lib-fit" open={custom !== null} onToggle={(e) => setCustom((e.currentTarget.open ? (custom ?? { w: String(entry.plot.width), l: String(entry.plot.length) }) : null))}>
                <summary>Fit this layout to my plot</summary>
                <div className="lib-fit-row">
                  <label>Width (ft)<input className="auth-input" inputMode="decimal" value={custom?.w ?? ""} onChange={(e) => setCustom((c) => ({ w: e.target.value, l: c?.l ?? "" }))} /></label>
                  <label>Length (ft)<input className="auth-input" inputMode="decimal" value={custom?.l ?? ""} onChange={(e) => setCustom((c) => ({ w: c?.w ?? "", l: e.target.value }))} /></label>
                  <button type="button" className="button outline" onClick={() => void fitToPlot()} disabled={busy}>Adapt</button>
                </div>
                {adapted && <button type="button" className="lib-clear" onClick={reset}>Back to the original plot size</button>}
              </details>
            )}

            {error && plan && <div className="auth-error" role="alert">{error}</div>}
            <p className="lib-disclaimer">Conceptual layout for planning and discussion. Not a construction drawing or a structural design.</p>
            <button type="button" className="button primary lib-open" onClick={() => void openInEditor()} disabled={!plan || busy}>
              {busy ? "Opening…" : "Open in the editor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryInner />
    </Suspense>
  );
}
