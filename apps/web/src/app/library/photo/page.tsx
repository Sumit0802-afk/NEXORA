"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ImageUp, Trash2 } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { ApiError, createProjectFromPlan, generateLayouts, type LayoutCandidate } from "@/lib/api";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";
import { loadPhoto } from "@/lib/photo-upload";
import { STAIR_SIDE_LABEL, matchesStairSide, stairSides, type StairSide } from "@/lib/stair-position";
import { TERRACE_STYLES, applyTerraceStyle, findTerraces, type TerraceStyleId } from "@/lib/terrace-layout";
import { validateDesign } from "@/lib/validation";
import { floorName } from "@/lib/floors";

type Extra = "study" | "pooja" | "dining" | "parking";
const EXTRAS: { id: Extra; label: string; phrase: string }[] = [
  { id: "dining", label: "Dining room", phrase: "1 dining room" },
  { id: "study", label: "Study", phrase: "1 study" },
  { id: "pooja", label: "Pooja room", phrase: "1 pooja room" },
  { id: "parking", label: "Parking", phrase: "1 parking" },
];

const num = (v: string, fallback: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

export default function PhotoToPlanPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<{ url: string; width: number; height: number } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [seen, setSeen] = useState({ storeys: 2, roof: "flat", balcony: false });
  const [width, setWidth] = useState("30");
  const [length, setLength] = useState("50");
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [extras, setExtras] = useState<Extra[]>(["dining"]);
  const [floors, setFloors] = useState(2);
  const [stair, setStair] = useState<StairSide>("any");
  const [terraceStyle, setTerraceStyle] = useState<TerraceStyleId | "none">("modern_minimalist");
  const [candidates, setCandidates] = useState<LayoutCandidate[] | null>(null);
  const [picked, setPicked] = useState(0);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const onFile = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    const res = await loadPhoto(file);
    if (!res.ok) {
      setPhotoError(res.reason);
      return;
    }
    setPhoto({ url: res.url, width: res.width, height: res.height });
  };

  const updateSeen = (patch: Partial<typeof seen>) => {
    const next = { ...seen, ...patch };
    setSeen(next);
    if (patch.storeys) setFloors(patch.storeys);
  };

  const generate = async () => {
    const w = num(width, 0);
    const l = num(length, 0);
    if (w < 15 || l < 20 || w > 200 || l > 300) {
      setError("Enter a plot between 15 × 20 ft and 200 × 300 ft.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const roomList = [`${bedrooms} bedroom`, `${bathrooms} bathroom`, "1 living room", "1 kitchen", ...EXTRAS.filter((e) => extras.includes(e.id)).map((e) => e.phrase)].join(", ");
      const results: LayoutCandidate[] = [];
      const seenIds = new Set<string>();
      // Different seeds give different arrangements; keep those that match the chosen staircase position.
      for (const seed of [1, 7, 13, 29, 41, 53]) {
        const r = await generateLayouts({ roomList, description: "", plotWidth: w, plotLength: l, units: "ft", floors, seed });
        for (const c of r.candidates) {
          const key = JSON.stringify(c.design.levels[0].rooms.map((x) => x.polygon));
          if (seenIds.has(key) || !matchesStairSide(c.design, stair)) continue;
          seenIds.add(key);
          results.push(c);
        }
        if (results.length >= 6) break;
        if (r.candidates.length === 0 && r.message && results.length === 0 && seed === 1) setMessage(r.message);
      }
      setCandidates(results);
      setPicked(0);
      setLevel(0);
      if (!results.length) setMessage((m) => m ?? (stair === "any" ? "These rooms do not fit that plot. Try a larger plot or fewer rooms." : "No layout puts the staircase there for this plot. Try “No preference” or another side."));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not prepare layouts.");
    } finally {
      setBusy(false);
    }
  };

  const current: FloorPlan | null = useMemo(() => {
    const c = candidates?.[picked];
    if (!c) return null;
    if (terraceStyle === "none") return c.design;
    const area = findTerraces(c.design)[0];
    return area ? applyTerraceStyle(c.design, area, terraceStyle).plan : c.design;
  }, [candidates, picked, terraceStyle]);

  const issues = useMemo(() => (current ? validateDesign(current).filter((i) => i.severity === "error") : []), [current]);
  const hasTerrace = current ? findTerraces(current).length > 0 : false;

  const create = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createProjectFromPlan("Layout from photo", current);
      router.push(`/studio/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project.");
      setBusy(false);
    }
  };

  const toggleExtra = (id: Extra) => setExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="lib-page">
      <div className="lib-top">
        <Link href="/library" className="lib-back"><ArrowLeft size={16} /> Design library</Link>
      </div>
      <div className="lib-hero">
        <h1>Start from a photo</h1>
        <p>Add a photo of a house you like and tell us what you can see. We then propose floor plans for your plot with the same staircase, floors and terrace you describe. Your photo stays on your device — it is only shown here as a reference. Layouts are estimates for you to review and correct, not a reconstruction of the house in the photo.</p>
      </div>

      <div className="ph-grid">
        <section className="ph-card">
          <h2>1 · Reference photo</h2>
          {photo ? (
            <div className="ph-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Your reference photo" />
              <button type="button" className="button secondary" onClick={() => setPhoto(null)}><Trash2 size={14} /> Remove photo</button>
            </div>
          ) : (
            <label className="ph-drop">
              <ImageUp size={26} />
              <span>Choose a JPEG, PNG or WebP photo (up to 8 MB)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          {photoError && <p className="ph-error" role="alert">{photoError}</p>}
          <h3>What can you see?</h3>
          <div className="ph-row">
            <label>Floors visible
              <select className="lib-select" value={seen.storeys} onChange={(e) => updateSeen({ storeys: Number(e.target.value) })}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>Roof
              <select className="lib-select" value={seen.roof} onChange={(e) => updateSeen({ roof: e.target.value })}>
                <option value="flat">Flat / terrace</option>
                <option value="sloped">Sloped</option>
              </select>
            </label>
            <label className="ph-check"><input type="checkbox" checked={seen.balcony} onChange={(e) => updateSeen({ balcony: e.target.checked })} /> Balcony visible</label>
          </div>
          <p className="lib-disclaimer">These notes guide the number of floors and the terrace. Nothing is read from the photo automatically.</p>
        </section>

        <section className="ph-card">
          <h2>2 · Your plot and rooms</h2>
          <div className="ph-row">
            <label>Plot width (ft)<input className="auth-input" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} /></label>
            <label>Plot length (ft)<input className="auth-input" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} /></label>
          </div>
          <div className="ph-row">
            <label>Bedrooms<select className="lib-select" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label>Bathrooms<select className="lib-select" value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label>Floors<select className="lib-select" value={floors} onChange={(e) => setFloors(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <div className="lib-filter-group">
            {EXTRAS.map((e) => (
              <button key={e.id} type="button" className={`lib-chip${extras.includes(e.id) ? " on" : ""}`} aria-pressed={extras.includes(e.id)} onClick={() => toggleExtra(e.id)}>{e.label}</button>
            ))}
          </div>
          <div className="ph-row">
            <label>Staircase position
              <select className="lib-select" value={stair} onChange={(e) => setStair(e.target.value as StairSide)}>
                {(Object.keys(STAIR_SIDE_LABEL) as StairSide[]).map((s) => <option key={s} value={s}>{STAIR_SIDE_LABEL[s]}</option>)}
              </select>
            </label>
            <label>Terrace style
              <select className="lib-select" value={terraceStyle} onChange={(e) => setTerraceStyle(e.target.value as TerraceStyleId | "none")} disabled={floors < 2}>
                <option value="none">Leave empty</option>
                {TERRACE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          {floors < 2 && <p className="lib-disclaimer">A terrace needs at least two floors.</p>}
          <button type="button" className="button lib-open" onClick={generate} disabled={busy}><Camera size={16} /> {busy ? "Preparing layouts…" : "Propose layouts"}</button>
          {error && <p className="ph-error" role="alert">{error}</p>}
        </section>
      </div>

      {message && <p className="ph-message" role="status">{message}</p>}

      {current && candidates && (
        <section className="ph-review">
          <div className="ph-banner" role="note"><strong>Estimated layout.</strong> Proposed from your notes and plot size — not a measured copy of the house in the photo, and not a structural design. Review it, choose another option, then fine-tune it in the editor.</div>
          <div className="ph-review-body">
            <div className="lib-preview">
              <div className="lib-levels">
                {current.levels.map((_, i) => <button key={i} type="button" className={i === level ? "active" : ""} onClick={() => setLevel(i)}>{floorName(i)}</button>)}
              </div>
              <PlanThumbnail plan={current} levelIndex={Math.min(level, current.levels.length - 1)} className="lib-big-plan" title="Proposed floor plan" dimensions />
            </div>
            <div className="lib-facts">
              <h3>Options</h3>
              <div className="lib-filter-group">
                {candidates.map((c, i) => (
                  <button key={c.id} type="button" className={`lib-chip${i === picked ? " on" : ""}`} aria-pressed={i === picked} onClick={() => { setPicked(i); setLevel(0); }}>Option {i + 1} · {c.label}</button>
                ))}
              </div>
              <dl>
                <dt>Staircase</dt><dd>{stairSides(current).map((s) => STAIR_SIDE_LABEL[s]).join(", ") || "—"}</dd>
                <dt>Floors</dt><dd>{current.levels.length}</dd>
                <dt>Terrace</dt><dd>{hasTerrace ? (terraceStyle === "none" ? "Open, empty" : TERRACE_STYLES.find((s) => s.id === terraceStyle)?.name) : "None on this layout"}</dd>
                <dt>Rooms</dt><dd>{current.levels.reduce((n, lv) => n + lv.rooms.length, 0)}</dd>
              </dl>
              {issues.length ? (
                <div className="lib-checks bad"><strong>Needs a look</strong>{issues.slice(0, 4).map((i) => <p key={i.id}>{i.message}</p>)}</div>
              ) : (
                <div className="lib-checks">Stairs line up between floors{hasTerrace ? " and the terrace can be reached" : ""}.</div>
              )}
              <button type="button" className="button lib-open" onClick={create} disabled={busy}>Create project and edit</button>
              <p className="lib-disclaimer">You can move walls and rooms, add terrace furniture, and see the result in 3D once the project opens.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
