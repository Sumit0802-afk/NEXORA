"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Camera, Grid3x3, Maximize2, Orbit, RectangleHorizontal, Scissors, SquareDashed, Tag } from "lucide-react";
import { HouseScene, type HouseSceneHandle, type SceneView } from "@/components/viewer/HouseScene";
import { usePlanContext } from "../plan-context";
import { floorShortName } from "@/lib/floors";

const VIEW_OPTIONS: { value: SceneView; label: string }[] = [
  { value: "perspective", label: "Perspective" },
  { value: "isometric", label: "Isometric" },
  { value: "top", label: "Top view" },
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
];

export default function Preview3DPage({ params }: { params: { projectId: string } }) {
  const { plan, loadError, isDemo } = usePlanContext();
  const [view, setView] = useState<SceneView>("perspective");
  const [showGrid, setShowGrid] = useState(true);
  const [cutaway, setCutaway] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [topLevel, setTopLevel] = useState<number | undefined>(undefined); // undefined = every floor
  const sceneRef = useRef<HouseSceneHandle | null>(null);
  const [status, setStatus] = useState("");

  const rooms = plan?.levels.flatMap((lv) => lv.rooms) ?? [];
  const levelCount = plan?.levels.length ?? 1;
  const selected = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const selectedSize = selected
    ? (() => {
        const xs = selected.polygon.map((p) => p[0]);
        const ys = selected.polygon.map((p) => p[1]);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...ys) - Math.min(...ys);
        return { w, d, area: w * d };
      })()
    : null;

  const handleScreenshot = () => {
    const uri = sceneRef.current?.captureScreenshot();
    if (!uri) return;
    const link = document.createElement("a");
    link.download = `${isDemo ? "demo" : params.projectId}-3d-view.png`;
    link.href = uri;
    link.click();
    setStatus("Exported 3D screenshot as PNG");
  };

  const icon = { verticalAlign: "middle", marginRight: 6 } as const;

  return <main className="app-shell">
    <header className="topbar">
      <Link href={`/studio/${params.projectId}`} className="brand">
        <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/>
      </Link>
      <div className="top-actions">
        <span className="muted" style={{ fontSize: 12 }}>{status}</span>
        <Link className="button" href={`/studio/${params.projectId}`}><ArrowLeft size={15} style={icon}/> Back to 2D</Link>
      </div>
    </header>
    <section className="container">
      <div className="eyebrow">Spatial preview</div>
      <h1 style={{ fontSize: 42 }}>Explore your plan in 3D.</h1>
      <p className="muted">Built live from your 2D plan: walls, door and window openings, and floors by room type. Click a room to select it; use Cutaway to look inside.</p>
      {loadError ? (
        <div className="error-state" style={{ marginTop: 22 }}>
          <h3>Couldn&apos;t load this project</h3>
          <p>{loadError}</p>
          <Link className="button" href="/">Back to dashboard</Link>
        </div>
      ) : !plan ? (
        <div className="muted" style={{ padding: 40 }}>Loading project…</div>
      ) : (
        <>
          <div className="viewer-toolbar">
            <div className="viewer-toggle" role="group" aria-label="Camera view">
              {VIEW_OPTIONS.map((opt) => (
                <button key={opt.value} className={`viewer-toggle-btn${view === opt.value ? " active" : ""}`} onClick={() => setView(opt.value)}>
                  {opt.value === "top" ? <SquareDashed size={14} style={icon}/> : opt.value === "front" || opt.value === "side" ? <RectangleHorizontal size={14} style={icon}/> : <Orbit size={14} style={icon}/>}
                  {opt.label}
                </button>
              ))}
            </div>
            {levelCount > 1 && (
              <div className="viewer-toggle" role="group" aria-label="Floors shown">
                {[undefined, ...Array.from({ length: levelCount }, (_, i) => i)].map((lv) => (
                  <button
                    key={lv ?? "all"}
                    className={`viewer-toggle-btn${topLevel === lv ? " active" : ""}`}
                    onClick={() => { setTopLevel(lv); setSelectedRoomId(null); }}
                    title={lv === undefined ? "Show every floor" : `Show up to the ${floorShortName(lv).toLowerCase()} floor`}
                  >
                    {lv === undefined ? "All floors" : `Up to ${floorShortName(lv)}`}
                  </button>
                ))}
              </div>
            )}
            <button className={`viewer-toggle-btn standalone${cutaway ? " active" : ""}`} onClick={() => setCutaway((c) => !c)} aria-pressed={cutaway}>
              <Scissors size={14} style={icon}/> Cutaway
            </button>
            <button className={`viewer-toggle-btn standalone${showLabels ? " active" : ""}`} onClick={() => setShowLabels((l) => !l)} aria-pressed={showLabels}>
              <Tag size={14} style={icon}/> Labels
            </button>
            <button className="viewer-toggle-btn standalone" onClick={() => sceneRef.current?.fitToView()}>
              <Maximize2 size={14} style={icon}/> Fit to view
            </button>
            <button className={`viewer-toggle-btn standalone${showGrid ? " active" : ""}`} onClick={() => setShowGrid((g) => !g)} aria-pressed={showGrid}>
              <Grid3x3 size={14} style={icon}/> Grid
            </button>
            <button className="viewer-toggle-btn standalone" onClick={handleScreenshot}>
              <Camera size={14} style={icon}/> Screenshot
            </button>
          </div>
          <div className="viewer-shell">
            <div className="viewer-badge">
              <Orbit size={14} style={{ verticalAlign: "middle", marginRight: 7 }}/>
              {rooms.length === 0 ? "Empty plot · add rooms in the 2D editor to see them here" : "Drag to orbit, scroll to zoom, click a room to select"}
            </div>
            {selected && selectedSize && (
              <div className="viewer-selection" role="status">
                <strong>{selected.name}</strong>
                <span>{+selectedSize.w.toFixed(1)} × {+selectedSize.d.toFixed(1)} {plan.units} · {Math.round(selectedSize.area)} {plan.units === "ft" ? "sq ft" : "m²"}</span>
              </div>
            )}
            <HouseScene
              ref={sceneRef}
              plan={plan}
              view={view}
              showGrid={showGrid}
              cutaway={cutaway}
              showLabels={showLabels}
              topLevel={topLevel}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
            />
          </div>
        </>
      )}
    </section>
  </main>;
}
