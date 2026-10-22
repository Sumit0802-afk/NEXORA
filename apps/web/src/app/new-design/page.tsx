"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Bath, BedDouble, Bell, BookOpen, Car, Check, ChevronDown, CookingPot, FileText,
  LayoutGrid, Layers, MoveHorizontal, MoveVertical, Pencil, Plus, RefreshCw, Ruler, Sofa, Sparkles, SquareDashed,
  Building2, Utensils, WashingMachine, X, type LucideIcon,
} from "lucide-react";
import { ApiError, createProject, generateLayouts, getAiStatus, saveDesign, type AiStatus, type LayoutCandidate, type LayoutResult } from "@/lib/api";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";
import { floorShortName, floorsLabel } from "@/lib/floors";

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

const ROOM_ICONS: Record<string, LucideIcon> = {
  bedroom: BedDouble, bathroom: Bath, kitchen: CookingPot, living_room: Sofa, dining_room: Utensils,
  staircase: Layers, parking: Car, study: BookOpen, utility: WashingMachine,
};

// Light keyword preview for the summary card; the API does the real reading (rules or AI).
const PREVIEW_KEYWORDS: [string, string][] = [
  ["bed ?rooms?|bhk|beds?\\b", "bedroom"], ["bath ?rooms?|wash ?rooms?|toilets?|baths?\\b", "bathroom"],
  ["kitchen", "kitchen"], ["living|hall\\b|lounge|drawing", "living_room"], ["dining", "dining_room"],
  ["stair", "staircase"], ["parking|garage|\\bcar\\b", "parking"], ["study|office", "study"],
  ["utility|laundry|store|pooja|puja", "utility"],
];
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, ek: 1, do: 2, teen: 3, char: 4 };
const COUNT = `(\\d+|${Object.keys(NUMBER_WORDS).join("|")})?\\s*-?\\s*`;

function previewRooms(chips: string[], description: string): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  const scan = (text: string, fromChip: boolean) => {
    const lower = text.toLowerCase();
    for (const [pattern, type] of PREVIEW_KEYWORDS) {
      const m = lower.match(new RegExp(`${COUNT}(?:${pattern})`));
      if (!m) continue;
      const n = m[1] ? Number(m[1]) || NUMBER_WORDS[m[1]] || 1 : 1;
      if (fromChip) counts.set(type, (counts.get(type) ?? 0) + n);
      else if (!counts.has(type)) counts.set(type, n);
    }
  };
  chips.forEach((c) => scan(c, true));
  scan(description, false);
  return Array.from(counts, ([type, count]) => ({ type, count }));
}

// Mirrors the API's floor phrases so the form can show what "Auto" will pick.
const FLOOR_HINTS: [RegExp, number][] = [
  [/g\s*\+\s*3|four[- ]stor|4[- ]stor|four floors?|4 floors?|char manzil/, 4],
  [/g\s*\+\s*2|three[- ]stor|3[- ]stor|triple[- ]floor|three floors?|3 floors?|teen manzil|triplex/, 3],
  [/g\s*\+\s*1|two[- ]stor|2[- ]stor|double[- ]stor|double[- ]floor|two floors?|2 floors?|duplex|do manzil|first floor|upper floor|upstairs/, 2],
];

function detectFloors(text: string): number {
  const lower = text.toLowerCase();
  return FLOOR_HINTS.find(([re]) => re.test(lower))?.[1] ?? 1;
}

const STEPS = [
  { title: "Project brief", hint: "Tell us about your home" },
  { title: "Generate layouts", hint: "Get AI layouts" },
  { title: "Edit in 2D", hint: "Customize your plan" },
  { title: "3D preview", hint: "Visualize your home" },
];

export default function NewDesignPage() {
  const router = useRouter();
  const [name, setName] = useState("Untitled design");
  const [prompt, setPrompt] = useState("Design a modern single-floor home for a 30 x 40 ft plot with 2 bedrooms, 2 bathrooms, a kitchen, living room, staircase and parking.");
  const [width, setWidth] = useState("30");
  const [length, setLength] = useState("40");
  const [unit, setUnit] = useState<"ft" | "m">("ft");
  const [roomChips, setRoomChips] = useState(["2 bedrooms", "2 bathrooms", "kitchen", "living room"]);
  const [roomDraft, setRoomDraft] = useState<string | null>(null);
  const rooms = roomChips.join(", ");
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [seed, setSeed] = useState(0);
  const [floors, setFloors] = useState(0); // 0 = auto from the brief
  const [cardFloor, setCardFloor] = useState<Record<string, number>>({});
  const [opening, setOpening] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    getAiStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  const plot = { plotWidth: Number(width), plotLength: Number(length) };

  async function runGeneration(nextSeed: number) {
    setGenerating(true);
    setNotice("");
    try {
      const res = await generateLayouts({ roomList: rooms, description: prompt, units: unit, seed: nextSeed, floors, ...plot });
      setCardFloor({});
      setResult(res);
      setSeed(nextSeed);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotice(err instanceof ApiError && err.status ? err.message : "Layout service unavailable — check that the NEXORA API is running and try again.");
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
  const plotArea = (Number(width) || 0) * (Number(length) || 0);
  const preview = previewRooms(roomChips, prompt);
  const busy = generating || opening !== null;
  const autoFloors = detectFloors(`${rooms} ${prompt}`);
  const plannedFloors = floors || autoFloors;
  const step = result ? 1 : 0;

  function addRoom() {
    const value = (roomDraft ?? "").trim();
    if (value) setRoomChips((chips) => [...chips, ...value.split(",").map((v) => v.trim()).filter(Boolean)]);
    setRoomDraft(null);
  }

  return <main className="nd-page">
    <aside className="nd-side">
      <Link href="/" className="nd-logo" aria-label="NEXORA home">
        <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/>
      </Link>
      <ol className="nd-steps">
        {STEPS.map((s, i) => {
          const state = i === step ? " active" : i < step ? " done" : "";
          return (
            <li key={s.title} className={`nd-step${state}`}>
              <span className="nd-step-num">{i < step ? <Check size={16}/> : String(i + 1).padStart(2, "0")}</span>
              <span className="nd-step-text"><strong>{s.title}</strong><small>{s.hint}</small></span>
            </li>
          );
        })}
      </ol>
      <div className="nd-side-art">
        <Image src="/images/brief-side.jpg" alt="" width={780} height={1102} sizes="260px" quality={90}/>
        <p>From an idea<br/>to your dream home.</p>
        <span className="nd-side-rule"/>
      </div>
    </aside>

    <div className="nd-main">
      <header className="nd-top">
        <div className="eyebrow">{result ? "NEW PROJECT / LAYOUT OPTIONS" : "NEW PROJECT / DESIGN BRIEF"}</div>
        <div className="nd-top-actions">
          <button type="button" className="nd-icon-btn" aria-label="Notifications"><Bell size={18}/></button>
          <Link href="/" className="nd-profile" aria-label="Back to dashboard"><span className="nd-avatar">S</span><ChevronDown size={16}/></Link>
        </div>
      </header>

    {!result ? (
      <section className="nd-brief">
        <h1 className="nd-title">Let&apos;s design <span>your home.</span></h1>
        <p className="nd-lede">Set your plot size and the rooms you need. NEXORA generates validated layout options you can open and edit in the 2D studio.</p>
        <div className="nd-grid">
          <form className="nd-card" onSubmit={(e) => { e.preventDefault(); runGeneration(0); }}>
            <label className="nd-field">
              <span className="nd-label"><FileText size={17}/> Project name</span>
              <input className="nd-input" value={name} onChange={e => setName(e.target.value)} required/>
            </label>
            <div className="nd-plot">
              <label className="nd-field">
                <span className="nd-label"><MoveHorizontal size={17}/> Plot width</span>
                <input className="nd-input" type="number" min="1" step="0.5" value={width} onChange={e => setWidth(e.target.value)} required/>
              </label>
              <label className="nd-field">
                <span className="nd-label"><MoveVertical size={17}/> Plot length</span>
                <input className="nd-input" type="number" min="1" step="0.5" value={length} onChange={e => setLength(e.target.value)} required/>
              </label>
              <label className="nd-field">
                <span className="nd-label"><Ruler size={17}/> Unit</span>
                <select className="nd-input" value={unit} onChange={e => setUnit(e.target.value as "ft" | "m")}><option value="ft">Feet</option><option value="m">Meters</option></select>
              </label>
            </div>
            <div className="nd-field">
              <div className="nd-label-row">
                <span className="nd-label"><Building2 size={17}/> Floors</span>
                <small>{floors ? "Bedrooms are spread across floors, most upstairs" : `Auto: ${autoFloors > 1 ? `${floorsLabel(autoFloors)} read from your description` : "single floor unless your description says G+1, duplex…"}`}</small>
              </div>
              <div className="nd-seg" role="radiogroup" aria-label="Number of floors">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={floors === n}
                    className={`nd-seg-btn${floors === n ? " active" : ""}`}
                    onClick={() => setFloors(n)}
                  >
                    {n === 0 ? "Auto" : n === 1 ? "Ground only" : floorsLabel(n)}
                  </button>
                ))}
              </div>
            </div>
            <div className="nd-field">
              <div className="nd-label-row">
                <span className="nd-label"><Sofa size={17}/> Rooms you need</span>
                <small>Add the main spaces for your home</small>
              </div>
              <div className="nd-chips">
                {roomChips.map((chip, i) => (
                  <span key={`${chip}-${i}`} className="nd-chip">
                    {chip}
                    <button type="button" aria-label={`Remove ${chip}`} onClick={() => setRoomChips((c) => c.filter((_, j) => j !== i))}><X size={14}/></button>
                  </span>
                ))}
                {roomDraft === null ? (
                  <button type="button" className="nd-chip-add" onClick={() => setRoomDraft("")}><Plus size={16}/> Add room</button>
                ) : (
                  <input
                    className="nd-chip-input"
                    autoFocus
                    value={roomDraft}
                    placeholder="e.g. study, parking"
                    aria-label="New room"
                    onChange={(e) => setRoomDraft(e.target.value)}
                    onBlur={addRoom}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addRoom(); }
                      if (e.key === "Escape") setRoomDraft(null);
                    }}
                  />
                )}
              </div>
            </div>
            <label className="nd-field">
              <span className="nd-label"><FileText size={17}/> Describe your home <span className="nd-optional">(optional)</span></span>
              <textarea className="nd-input nd-textarea" rows={3} maxLength={500} value={prompt} onChange={e => setPrompt(e.target.value)}/>
              <small className="nd-count">{prompt.length}/500</small>
            </label>

            <div className="nd-summary">
              <div className="nd-area">
                <LayoutGrid size={24}/>
                <div>
                  <span>Plot area</span>
                  <strong>{Math.round(plotArea).toLocaleString()} {unitLabel}</strong>
                  <small>({width || 0} {unit} × {length || 0} {unit}){plannedFloors > 1 ? ` · ${floorsLabel(plannedFloors)}, ${plannedFloors} floors` : ""}</small>
                </div>
                <svg className="nd-area-art" viewBox="0 0 90 60" aria-hidden="true">
                  <path d="M45 10 L84 30 L45 50 L6 30 Z" fill="#F1EEFC" stroke="#C9C0F0"/>
                  <path d="M45 18 L70 30 L45 42 L20 30 Z" fill="#DDD5F8" stroke="#A497E6"/>
                  <path d="M6 30 L6 35 L45 55 L84 35 L84 30" fill="none" stroke="#DCD5F5"/>
                </svg>
              </div>
              <ul className="nd-room-list">
                {preview.length === 0 && <li className="nd-room-empty">Add rooms to see them here</li>}
                {preview.map(({ type, count }) => {
                  const Icon = ROOM_ICONS[type] ?? Sofa;
                  const label = ROOM_LABELS[type]?.[count > 1 ? 1 : 0] ?? type;
                  return <li key={type}><Icon size={16}/> {type === "bedroom" || type === "bathroom" || count > 1 ? `${count} ${label.toLowerCase()}` : label}</li>;
                })}
              </ul>
            </div>

            <div className="nd-actions">
              <button className="nd-btn primary" type="submit" disabled={busy || roomChips.length === 0}>
                <Sparkles size={19}/> {generating ? (aiStatus?.enabled ? "Reading your brief with AI…" : "Generating layouts…") : <>Generate layouts <ArrowRight size={18}/></>}
              </button>
              <button className="nd-btn" type="button" disabled={busy} onClick={() => chooseCandidate(null)}>
                <SquareDashed size={18}/> {opening === "empty" ? "Creating…" : "Start with an empty plot"}
              </button>
            </div>
            {notice && <p className="nd-alert" role="alert"><AlertTriangle size={17}/> {notice}</p>}
            {!notice && aiStatus && (
              <p className="ai-note">
                <Sparkles size={12}/> {aiStatus.enabled
                  ? `AI is on (${aiStatus.provider === "gemini" ? "Gemini" : "Claude"}): it reads your description in English or Hinglish and explains each option.`
                  : "AI is off: rooms are read with built-in rules."}
              </p>
            )}
          </form>

          <aside className="nd-visual" aria-label="Example 3D layout">
            <Image src="/images/brief-iso.jpg" alt="Example isometric 3D view of a generated home layout" fill sizes="(max-width: 1100px) 100vw, 40vw" quality={90} priority/>
            <div className="nd-plot-card">
              <span className="nd-plot-icon"><Ruler size={20}/></span>
              <div>
                <span>Plot size</span>
                <strong>{width || 0} {unit} × {length || 0} {unit}</strong>
                <small>{Math.round(plotArea).toLocaleString()} {unitLabel}{plannedFloors > 1 ? ` · ${floorsLabel(plannedFloors)}` : ""}</small>
              </div>
            </div>
          </aside>
        </div>
      </section>
    ) : (
      <section className="results-shell">
        <div className="results-head">
          <div>
            <h1 className="brief-title">{result.candidates.length ? `${result.candidates.length} layouts for your ${width} × ${length} ${unit} plot${(result.requirements.floors ?? 1) > 1 ? ` · ${floorsLabel(result.requirements.floors ?? 1)}` : ""}` : "No layout fits yet"}</h1>
            <div className="req-chips">
              {Object.entries(result.requirements.counts).map(([type, count]) => (
                <span key={type} className="req-chip">{count} {ROOM_LABELS[type]?.[count > 1 ? 1 : 0] ?? type}</span>
              ))}
            </div>
            {(result.floors?.length ?? 0) > 1 && (
              <div className="req-floors">
                {result.floors!.map((f, i) => (
                  <span key={f.name}><strong>{floorShortName(i)}:</strong> {Object.entries(f.counts).filter(([t]) => t !== "staircase").map(([t, n]) => `${n} ${(ROOM_LABELS[t]?.[n > 1 ? 1 : 0] ?? t).toLowerCase()}`).join(", ") || "stairs only"}</span>
                ))}
              </div>
            )}
            {result.requirements.notes.map((n) => <p key={n} className="req-note">{n}</p>)}
            {result.ai?.used && !result.ai.error && <p className="ai-note"><Sparkles size={12}/> Brief read and options explained by AI ({result.ai.model})</p>}
            {result.ai?.used && result.ai.error && <p className="ai-note warn"><Sparkles size={12}/> Brief read by AI ({result.ai.model}); option explanations skipped: {result.ai.error}</p>}
            {!result.ai?.used && result.ai?.error && <p className="ai-note warn"><AlertTriangle size={12}/> AI unavailable, used the built-in rules instead: {result.ai.error}</p>}
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
              <div className="cand-thumb">
                {cand.design.levels.length > 1 && (
                  <div className="cand-floors" role="tablist" aria-label="Floor">
                    {cand.design.levels.map((lv, i) => (
                      <button
                        key={lv.id}
                        type="button"
                        role="tab"
                        aria-selected={(cardFloor[cand.id] ?? 0) === i}
                        className={(cardFloor[cand.id] ?? 0) === i ? "active" : ""}
                        onClick={() => setCardFloor((m) => ({ ...m, [cand.id]: i }))}
                      >
                        {floorShortName(i)}
                      </button>
                    ))}
                  </div>
                )}
                <PlanThumbnail plan={cand.design} levelIndex={cardFloor[cand.id] ?? 0} title={`${cand.label} floor plan`}/>
              </div>
              <div className="cand-body">
                <div className="cand-title-row">
                  <h3>{cand.label}</h3>
                  <span className="cand-score" title="Layout score out of 100">{cand.score}<small>/100</small></span>
                </div>
                {index === 0 && <span className="cand-badge">Best match</span>}
                <p className="cand-summary">{cand.summary}</p>
                {cand.explanation && (
                  <div className="cand-ai">
                    <p><Sparkles size={12}/> {cand.explanation.headline}</p>
                    {cand.explanation.pros.map((p) => <span key={p} className="pro">+ {p}</span>)}
                    {cand.explanation.cons.map((c) => <span key={c} className="con">− {c}</span>)}
                  </div>
                )}
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
    </div>
  </main>;
}
