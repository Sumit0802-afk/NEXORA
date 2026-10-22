"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Pencil, RefreshCw, Sparkles, SquareDashed } from "lucide-react";
import { ApiError, createProject, generateLayouts, saveDesign, type LayoutCandidate, type LayoutResult } from "@/lib/api";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";

const ROOM_LABELS: Record<string, [string, string]> = {
  living_room: ["Living room", "Living rooms"],
  dining_room: ["Dining", "Dining"],
  kitchen: ["Kitchen", "Kitchens"],
  bedroom: ["Bedroom", "Bedrooms"],
  bathroom: ["Bathroom", "Bathrooms"],
  staircase: ["Staircase", "Staircases"],
  parking: ["Parking", "Parking"],
  study: ["Study", "Studies"],
  utility: ["Utility", "Utility rooms"],
};

export default function NewDesignPage() {
  const router = useRouter();
  const [name, setName] = useState("Untitled design");
  const [prompt, setPrompt] = useState("Design a modern single-floor home for a 30 x 40 ft plot with 2 bedrooms, 2 bathrooms, a kitchen, living room, staircase and parking.");
  const [width, setWidth] = useState("30");
  const [length, setLength] = useState("40");
  const [unit, setUnit] = useState<"ft" | "m">("ft");
  const [rooms, setRooms] = useState("2 bedrooms, 2 bathrooms, kitchen, living room");
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [seed, setSeed] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);

  const plot = { plotWidth: Number(width), plotLength: Number(length) };

  async function runGeneration(nextSeed: number) {
    setGenerating(true);
    setNotice("");
    try {
      const res = await generateLayouts({ roomList: rooms, description: prompt, units: unit, seed: nextSeed, ...plot });
      setResult(res);
      setSeed(nextSeed);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not generate layouts. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function chooseCandidate(candidate: LayoutCandidate | null) {
    setOpening(candidate?.id ?? "empty");
    setNotice("");
    try {
      const project = await createProject({ name: name.trim() || "Untitled design", units: unit, ...plot });
      if (candidate) {
        await saveDesign(project.id, { ...candidate.design, projectId: project.id });
      }
      router.push(`/studio/${project.id}`);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not create the project. Please try again.");
      setOpening(null);
    }
  }

  const unitLabel = unit === "ft" ? "sq ft" : "m²";

  return <main className="app-shell brief-page">
    <header className="topbar">
      <Link href="/" className="brand"><Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/></Link>
      <Link href="/" className="button"><ArrowLeft size={15}/> Dashboard</Link>
    </header>

    {!result ? (
      <section className="brief-shell">
        <div className="eyebrow">NEW PROJECT / DESIGN BRIEF</div>
        <h1 className="brief-title">Tell us about your home.</h1>
        <p className="brief-lede">Set your plot size and the rooms you need. NEXORA generates validated layout options you can open and edit in the 2D studio.</p>
        <form className="brief-form" onSubmit={(e) => { e.preventDefault(); runGeneration(0); }}>
          <label className="brief-field brief-span">Project name<input className="field" value={name} onChange={e => setName(e.target.value)} required/></label>
          <div className="brief-plot brief-span">
            <label className="brief-field">Plot width<input className="field" type="number" min="1" step="0.5" value={width} onChange={e => setWidth(e.target.value)} required/></label>
            <label className="brief-field">Plot length<input className="field" type="number" min="1" step="0.5" value={length} onChange={e => setLength(e.target.value)} required/></label>
            <label className="brief-field">Unit<select className="field" value={unit} onChange={e => setUnit(e.target.value as "ft" | "m")}><option value="ft">Feet</option><option value="m">Meters</option></select></label>
          </div>
          <label className="brief-field brief-span">Rooms you need<input className="field" value={rooms} onChange={e => setRooms(e.target.value)} placeholder="e.g. 3 bedrooms, 2 bathrooms, kitchen, living, parking" required/></label>
          <label className="brief-field brief-span"><span>Describe your home <span className="brief-optional">(optional)</span></span><textarea className="field" rows={4} value={prompt} onChange={e => setPrompt(e.target.value)}/></label>
          <div className="brief-actions brief-span">
            <button className="button primary" type="submit" disabled={generating || opening !== null}>
              <Sparkles size={16}/> {generating ? "Generating layouts…" : "Generate layouts"}
            </button>
            <button className="button" type="button" disabled={generating || opening !== null} onClick={() => chooseCandidate(null)}>
              <SquareDashed size={15}/> {opening === "empty" ? "Creating…" : "Start with an empty plot"}
            </button>
          </div>
          {notice && <p className="brief-notice brief-span" role="alert"><AlertTriangle size={15}/> {notice}</p>}
        </form>
      </section>
    ) : (
      <section className="results-shell">
        <div className="results-head">
          <div>
            <div className="eyebrow">LAYOUT OPTIONS</div>
            <h1 className="brief-title">{result.candidates.length ? `${result.candidates.length} layouts for your ${width} × ${length} ${unit} plot` : "No layout fits yet"}</h1>
            <div className="req-chips">
              {Object.entries(result.requirements.counts).map(([type, count]) => (
                <span key={type} className="req-chip">{count} {ROOM_LABELS[type]?.[count > 1 ? 1 : 0] ?? type}</span>
              ))}
            </div>
            {result.requirements.notes.map((n) => <p key={n} className="req-note">{n}</p>)}
          </div>
          <div className="results-actions">
            <button className="button" onClick={() => setResult(null)} disabled={opening !== null}><Pencil size={14}/> Edit brief</button>
            <button className="button" onClick={() => runGeneration(seed + 1)} disabled={generating || opening !== null || !result.candidates.length}>
              <RefreshCw size={14} className={generating ? "spin" : undefined}/> {generating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </div>

        {notice && <p className="brief-notice" role="alert"><AlertTriangle size={15}/> {notice}</p>}
        {result.message && (
          <div className="results-empty">
            <AlertTriangle size={20}/>
            <p>{result.message}</p>
            <div className="brief-actions">
              <button className="button primary" onClick={() => setResult(null)}><Pencil size={14}/> Edit brief</button>
              <button className="button" onClick={() => chooseCandidate(null)} disabled={opening !== null}><SquareDashed size={15}/> Start with an empty plot</button>
            </div>
          </div>
        )}

        <div className="cand-grid">
          {result.candidates.map((cand, index) => (
            <article key={cand.id} className={`cand-card${index === 0 ? " best" : ""}`}>
              <div className="cand-thumb"><PlanThumbnail plan={cand.design} title={`${cand.label} floor plan`}/></div>
              <div className="cand-body">
                <div className="cand-title-row">
                  <h3>{cand.label}</h3>
                  <span className="cand-score" title="Layout score out of 100">{cand.score}<small>/100</small></span>
                </div>
                {index === 0 && <span className="cand-badge">Best match</span>}
                <p className="cand-summary">{cand.summary}</p>
                <ul className="cand-highlights">
                  {cand.highlights.slice(0, 3).map((h) => <li key={h}><Check size={13}/> {h}</li>)}
                </ul>
                {cand.warnings.length > 0 && (
                  <ul className="cand-warnings">
                    {cand.warnings.map((wn) => <li key={wn}><AlertTriangle size={12}/> {wn}</li>)}
                  </ul>
                )}
                <div className="cand-foot">
                  <span className="cand-stats">{cand.stats.roomCount} rooms · {cand.stats.builtUpArea.toLocaleString()} {unitLabel} built-up</span>
                  <button className="button primary" onClick={() => chooseCandidate(cand)} disabled={opening !== null}>
                    {opening === cand.id ? "Opening…" : <>Use this layout <ArrowRight size={14}/></>}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="results-disclaimer">{result.disclaimer} Have a qualified professional verify structure, setbacks and local building rules before construction.</p>
      </section>
    )}
  </main>;
}
