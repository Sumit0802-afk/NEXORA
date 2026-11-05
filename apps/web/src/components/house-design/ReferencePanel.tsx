"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ImageUp, LayoutGrid, Loader2, RefreshCw, ScanSearch, Trash2, Wand2, X } from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import { ApiError, getAiStatus, getHouseReadJob, startHouseReadJob } from "@/lib/api";
import { loadPhoto } from "@/lib/photo-upload";
import { getCatalogDesign, previewImage } from "@/lib/house-design/catalog";
import { useHouseDesign } from "@/lib/house-design/context";
import { DesignPreview } from "./GalleryOverlay";
import { galleryMaterials, galleryPalette } from "@/lib/house-design/gallery";
import { baseRecord, type MatchRow } from "@/lib/house-design/design-engine";
import { STAGE_LABEL, generateFromReferences, referenceFromUpload, type DeepReader, type GenerationStage, type GenerationView } from "@/lib/house-design/pipeline";
import { ELEVATIONS, ELEVATION_LABEL, type DesignSection, type Elevation, type ReferenceImage } from "@/lib/house-design/schema";
import { PanelHead, Toggle } from "./controls";

const STAGES: GenerationStage[] = ["preparing", "reading", "refining", "composing"];
const POLL_MS = 1200;
const POLL_LIMIT = 75;

function confidenceLabel(confidence: number | null) {
  if (confidence === null) return { text: "Not measured", tone: "none" };
  if (confidence >= 0.7) return { text: "Strong evidence", tone: "high" };
  if (confidence >= 0.5) return { text: "Some evidence", tone: "mid" };
  return { text: "Weak evidence", tone: "low" };
}

/** Starts the server reading as a job and waits for it, so a slow provider never holds a request open. */
function serverReader(projectId: string, onUnavailable: () => void): DeepReader {
  return async (views) => {
    try {
      const { jobId } = await startHouseReadJob(projectId, views);
      for (let i = 0; i < POLL_LIMIT; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const job = await getHouseReadJob(projectId, jobId);
        if (job.status === "completed") return job.result;
        if (job.status === "failed") break;
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    onUnavailable();
    return null;
  };
}

function Slot({ elevation, image, disabled, onFile, onRemove }: { elevation: Elevation; image: ReferenceImage | null; disabled: boolean; onFile: (file: File | undefined) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const picker = <input ref={input} className="hd-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${ELEVATION_LABEL[elevation]} reference image`} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />;
  if (image) {
    return (
      <figure className="hd-reference">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={`${ELEVATION_LABEL[elevation]} reference: ${image.name}`} />
        <figcaption>
          <b>{ELEVATION_LABEL[elevation]}</b>
          <span title={image.name}>{image.name}</span>
          <div>
            <button type="button" onClick={() => input.current?.click()} disabled={disabled} title="Replace" aria-label={`Replace the ${ELEVATION_LABEL[elevation]} image`}><RefreshCw size={13} /></button>
            <button type="button" onClick={onRemove} disabled={disabled} title="Remove" aria-label={`Remove the ${ELEVATION_LABEL[elevation]} image`}><Trash2 size={13} /></button>
          </div>
        </figcaption>
        {picker}
      </figure>
    );
  }
  return (
    <label
      className={`hd-drop slot${over ? " over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
    >
      <ImageUp size={18} />
      <b>{ELEVATION_LABEL[elevation]}</b>
      <span>{elevation === "front" ? "Main view" : "Optional"}</span>
      {picker}
    </label>
  );
}

export function ReferencePanel({ plan, projectId, onOpenGallery, applying, onApplyDesign, onGo, onToast, onCheckMatch }: {
  applying: boolean;
  onApplyDesign: (id: string) => void;
  plan: FloorPlan;
  projectId: string;
  onOpenGallery: () => void;
  onGo: (section: DesignSection) => void;
  onToast: (message: string) => void;
  /** Renders the model from the front and reads it the same way as the reference. */
  onCheckMatch: () => Promise<MatchRow[] | null>;
}) {
  const house = useHouseDesign();
  const { references, images, reading, parameters, base } = house.document;
  const [error, setError] = useState<string | null>(null);
  const [deepAvailable, setDeepAvailable] = useState(false);
  const [deep, setDeep] = useState(false);
  const [match, setMatch] = useState<MatchRow[] | null>(null);
  const [matching, setMatching] = useState(false);
  const isDemo = projectId === "demo";
  const picked = getCatalogDesign(house.document.gallery.selectedId ?? undefined);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((status) => { if (!cancelled) setDeepAvailable(status.enabled && !isDemo); })
      .catch(() => { if (!cancelled) setDeepAvailable(false); });
    return () => { cancelled = true; };
  }, [isDemo]);

  const views: GenerationView[] = references.flatMap((r) => (images[r.imageId] ? [{ elevation: r.elevation, image: images[r.imageId] }] : []));
  const slotImage = (elevation: Elevation) => views.find((v) => v.elevation === elevation)?.image ?? null;
  const sources = references.map((r) => r.imageId).sort();
  const upToDate = Boolean(reading) && base?.sources?.join() === sources.join();
  const stage = house.job.stage as GenerationStage | null;
  const busy = stage !== null;
  const shownError = error ?? house.job.error;
  const hasUpload = views.some((v) => v.image.kind === "upload");

  const onFile = async (elevation: Elevation, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setMatch(null);
    const loaded = await loadPhoto(file);
    if (!loaded.ok) {
      setError(loaded.reason);
      return;
    }
    try {
      house.placeReference(elevation, await referenceFromUpload(loaded.url, file.name));
    } catch {
      setError("That image could not be read. It may be damaged.");
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  };

  const generate = async () => {
    if (!views.length) return;
    setError(null);
    setMatch(null);
    const deepRead = deep ? serverReader(projectId, () => onToast("The detailed reading was unavailable, so the on-device reading was used.")) : undefined;
    const done = await house.runGeneration((onStage) => generateFromReferences(views, { plan, deepRead, onStage: (s) => onStage(s) }), (design) => baseRecord(plan, design, sources));
    if (done) onToast("Design generated. Your floor plan is unchanged.");
  };

  const checkMatch = async () => {
    setMatching(true);
    setMatch(await onCheckMatch());
    setMatching(false);
  };

  const stages = STAGES.filter((s) => s !== "refining" || deep);

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Reference" title="Choose Your House Design">
        Add one photo, or a view of each side. The roof, facades, windows and materials are rebuilt on your floor plan, and your rooms and measurements stay exactly as drawn.
      </PanelHead>

      <div className="hd-slots">
        {ELEVATIONS.map((elevation) => (
          <Slot key={elevation} elevation={elevation} image={slotImage(elevation)} disabled={busy} onFile={(file) => void onFile(elevation, file)} onRemove={() => { house.removeReference(elevation); setMatch(null); setError(null); }} />
        ))}
      </div>
      <p className="hd-hint">JPEG, PNG or WebP up to 8 MB each. A rear or side view only changes that side of the house.</p>

      <button type="button" className="hd-button" onClick={onOpenGallery} disabled={busy}><LayoutGrid size={15} /> {picked ? "Replace from the gallery" : "Browse the design gallery"}</button>

      {picked && (
        <section className="hd-picked">
          <DesignPreview entry={picked} alt={`Selected design: ${picked.name}`} />
          <h3>{picked.name}</h3>
          <small>{picked.categoryName} · {picked.subcategory}</small>
          <p>{galleryMaterials(picked.design).join(" · ")}</p>
          <div className="hd-dots" aria-label="Colour palette">{galleryPalette(picked.design).map((c) => <i key={c} style={{ background: c }} title={c} />)}</div>
          <button type="button" className="hd-button primary" disabled={applying || busy} onClick={() => onApplyDesign(picked.id)}>
            {applying ? <Loader2 size={15} className="hd-spin" /> : <Check size={15} />} {applying ? "Applying design" : "Apply Design"}
          </button>
          <button type="button" className="hd-button" disabled={applying} onClick={() => house.updateGallery((g) => ({ ...g, selectedId: null }))}><Trash2 size={14} /> Remove selection</button>
        </section>
      )}

      {shownError && <p className="hd-error" role="alert"><AlertTriangle size={14} /> {shownError}</p>}

      {hasUpload && deepAvailable && (
        <Toggle label="Detailed reading" checked={deep} onChange={setDeep} hint="Sends small copies of these photos to the NEXORA server for finer roof and window recognition. Without this, the photos stay on your device." />
      )}

      {views.length > 0 && !busy && (
        <button type="button" className={`hd-button${upToDate ? "" : " primary"}`} onClick={generate}><Wand2 size={15} /> {upToDate ? "Generate again" : "Generate design"}</button>
      )}

      {busy && (
        <ol className="hd-stages" aria-live="polite">
          {stages.map((s) => {
            const at = stages.indexOf(stage!), i = stages.indexOf(s);
            return (
              <li key={s} className={i < at ? "done" : i === at ? "now" : ""}>
                {i < at ? <Check size={13} /> : i === at ? <Loader2 size={13} className="hd-spin" /> : <span />}
                {STAGE_LABEL[s]}
              </li>
            );
          })}
        </ol>
      )}

      {!busy && reading && reading.attributes.length > 1 && (
        <section className="hd-reading">
          <h3>What we read from your {views.length > 1 ? "photos" : "photo"}</h3>
          {reading.palette.length > 0 && (
            <div className="hd-palette" aria-label="Colours found in the photo">
              {reading.palette.map((c) => <i key={c.hex} style={{ background: c.hex, flexGrow: Math.max(c.share, 0.06) }} title={`${c.hex} · ${Math.round(c.share * 100)}%`} />)}
            </div>
          )}
          <ul>
            {reading.attributes.map((a) => {
              const level = confidenceLabel(a.confidence);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => onGo(a.section)} title="Adjust this">
                    {a.swatch && <i style={{ background: a.swatch }} />}
                    <span><small>{a.label}</small>{a.value}</span>
                    <em className={level.tone}>{level.text}</em>
                  </button>
                </li>
              );
            })}
          </ul>
          {reading.notes.map((note) => <p key={note} className="hd-note">{note}</p>)}
          <p className="hd-hint">Photos show what is visible, not the whole building, so this is a best match and not a reconstruction. Evidence labels say how much the photo supported each reading. Tap a row to correct it.</p>

          <button type="button" className="hd-button" onClick={() => void checkMatch()} disabled={matching || !house.design}>
            {matching ? <Loader2 size={15} className="hd-spin" /> : <ScanSearch size={15} />} Check the model against the reference
          </button>
          {match && (
            match.length ? (
              <table className="hd-match">
                <thead><tr><th>Read from</th><th>Reference</th><th>Model</th><th /></tr></thead>
                <tbody>
                  {match.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td><td>{row.reference}</td><td>{row.model}</td>
                      <td>{row.agrees ? <Check size={13} aria-label="Agrees" /> : <X size={13} aria-label="Differs" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="hd-note">There was nothing measured to compare. Gallery designs are built from their specification.</p>
          )}
        </section>
      )}

      {parameters && (
        <details className="hd-json">
          <summary><ChevronDown size={13} /> Design parameters (JSON)</summary>
          <pre>{JSON.stringify(parameters, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
