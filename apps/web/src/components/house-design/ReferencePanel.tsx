"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ImageUp, LayoutGrid, Loader2, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { getAiStatus, readHouseImage } from "@/lib/api";
import { loadPhoto } from "@/lib/photo-upload";
import { useHouseDesign } from "@/lib/house-design/context";
import { STAGE_LABEL, generateFromReference, referenceFromUpload, type GenerationStage } from "@/lib/house-design/pipeline";
import type { DeepReading } from "@/lib/house-design/interpret";
import type { DesignSection, ReferenceImage } from "@/lib/house-design/schema";
import { PanelHead, Toggle } from "./controls";

const STAGES: GenerationStage[] = ["preparing", "reading", "refining", "composing"];

function confidenceLabel(confidence: number) {
  if (confidence >= 0.7) return { text: "Clear", tone: "high" };
  if (confidence >= 0.5) return { text: "Likely", tone: "mid" };
  return { text: "Check", tone: "low" };
}

export function ReferencePanel({
  levels,
  onOpenGallery,
  onGo,
  onToast,
  chosen,
  onChoose,
}: {
  levels: number;
  onOpenGallery: () => void;
  onGo: (section: DesignSection) => void;
  onToast: (message: string) => void;
  /** Picked but not generated yet. Held by the page so it survives switching panels. */
  chosen: ReferenceImage | null;
  onChoose: (reference: ReferenceImage | null) => void;
}) {
  const house = useHouseDesign();
  const { reference: applied, reading } = house.document;
  const shown = chosen ?? applied;
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<GenerationStage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deepAvailable, setDeepAvailable] = useState(false);
  const [deep, setDeep] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((status) => { if (!cancelled) setDeepAvailable(status.enabled); })
      .catch(() => { if (!cancelled) setDeepAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const loaded = await loadPhoto(file);
    if (!loaded.ok) {
      setError(loaded.reason);
      return;
    }
    try {
      onChoose(await referenceFromUpload(loaded.url, file.name));
    } catch {
      setError("That image could not be read. It may be damaged.");
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  };

  const generate = async () => {
    if (!shown) return;
    setError(null);
    try {
      const deepRead = deep
        ? async (image: string): Promise<DeepReading | null> => {
            try {
              return await readHouseImage(image);
            } catch {
              onToast("The detailed reading was unavailable, so we used the on-device reading.");
              return null;
            }
          }
        : undefined;
      const result = await generateFromReference(shown, { levels, deepRead, onStage: setStage });
      house.applyGenerated(result.design, result.reading, shown);
      onChoose(null);
      onToast("Design generated. Your floor plan is unchanged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The design could not be generated. Try another image.");
    } finally {
      setStage(null);
    }
  };

  const remove = () => {
    onChoose(null);
    house.setReference(null);
    setError(null);
  };

  const busy = stage !== null;
  const stages = STAGES.filter((s) => s !== "refining" || deep);

  return (
    <div className="hd-panel">
      <PanelHead eyebrow="Reference" title="Choose Your House Design">
        Upload a photo or pick a design. The roof, facade, windows and materials are rebuilt on your floor plan, and your rooms and measurements stay exactly as drawn.
      </PanelHead>

      {shown ? (
        <figure className="hd-reference">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.src} alt={`Reference: ${shown.name}`} />
          <figcaption>
            <span title={shown.name}>{shown.name}</span>
            <div>
              <button type="button" onClick={() => input.current?.click()} disabled={busy}><RefreshCw size={13} /> Replace</button>
              <button type="button" onClick={remove} disabled={busy}><Trash2 size={13} /> Remove</button>
            </div>
          </figcaption>
        </figure>
      ) : (
        <label
          className={`hd-drop${dragging ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void onFile(e.dataTransfer.files[0]); }}
        >
          <ImageUp size={26} />
          <b>Upload a house photo</b>
          <span>Drop it here or click to browse. JPEG, PNG or WebP up to 8 MB.</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {shown && <input ref={input} className="hd-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />}

      <button type="button" className="hd-button" onClick={onOpenGallery} disabled={busy}><LayoutGrid size={15} /> Browse the design gallery</button>

      {error && <p className="hd-error" role="alert"><AlertTriangle size={14} /> {error}</p>}

      {shown && deepAvailable && shown.kind === "upload" && (
        <Toggle label="Detailed reading" checked={deep} onChange={setDeep} hint="Sends a small copy of this photo to the NEXORA server for finer roof and window recognition. Without this, the photo stays on your device." />
      )}

      {shown && !busy && (chosen || !reading) && (
        <button type="button" className="hd-button primary" onClick={generate}><Wand2 size={15} /> Generate design</button>
      )}
      {shown && !busy && !chosen && reading && (
        <button type="button" className="hd-button" onClick={generate}><Wand2 size={15} /> Generate again</button>
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

      {!busy && !chosen && reading && reading.attributes.length > 1 && (
        <section className="hd-reading">
          <h3>What we read from your photo</h3>
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
          <p className="hd-hint">One photo cannot show every side of a house, so this is a best match. Anything marked Check is worth a look; tap a row to correct it.</p>
        </section>
      )}
    </div>
  );
}
