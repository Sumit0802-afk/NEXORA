"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  BrickWall,
  Check,
  ChevronDown,
  CloudUpload,
  Columns2,
  DoorClosed,
  Download,
  Fence,
  Home,
  ImagePlus,
  Layers3,
  LayoutGrid,
  Loader2,
  Maximize2,
  Moon,
  Orbit,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Sofa,
  Sun,
  Sunset,
  Trees,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { HouseScene, type HouseSceneHandle, type SceneView } from "@/components/viewer/HouseScene";
import { StudioErrorBoundary } from "@/components/common/StudioErrorBoundary";
import { GalleryOverlay } from "@/components/house-design/GalleryOverlay";
import { BalconyPanel, DoorsPanel, EnvironmentPanel, FacadePanel, InteriorPanel, RoofPanel, WallsPanel, WindowsPanel } from "@/components/house-design/Inspectors";
import { ExportPanel, MaterialsPanel, VariationsPanel } from "@/components/house-design/LibraryPanels";
import { ReferencePanel } from "@/components/house-design/ReferencePanel";
import { FinishPicker, WALL_MATERIALS } from "@/components/house-design/controls";
import { useHouseDesign } from "@/lib/house-design/context";
import { generateFromReference, referenceFromGallery } from "@/lib/house-design/pipeline";
import { designOrDefault, setAt, type DesignSection, type HouseDesign, type LightingPreview, type ReferenceImage } from "@/lib/house-design/schema";
import { finishAt, roomFinish, targetForPart } from "@/lib/house-design/surfaces";
import { usePlanContext } from "../plan-context";
import "../../../house-design.css";

const NAV: { title: string; items: { id: DesignSection | "gallery"; label: string; icon: LucideIcon }[] }[] = [
  {
    title: "Design",
    items: [
      { id: "reference", label: "Reference image", icon: ImagePlus },
      { id: "gallery", label: "Design gallery", icon: LayoutGrid },
    ],
  },
  {
    title: "Exterior",
    items: [
      { id: "facade", label: "Facade style", icon: Blocks },
      { id: "walls", label: "Walls", icon: BrickWall },
      { id: "roof", label: "Roof", icon: Home },
      { id: "windows", label: "Windows", icon: Columns2 },
      { id: "doors", label: "Doors", icon: DoorClosed },
      { id: "balcony", label: "Balcony", icon: Fence },
    ],
  },
  {
    title: "Inside and out",
    items: [
      { id: "interior", label: "Interior", icon: Sofa },
      { id: "environment", label: "Environment", icon: Trees },
      { id: "materials", label: "Material library", icon: Palette },
    ],
  },
  {
    title: "Project",
    items: [
      { id: "variations", label: "Variations", icon: Layers3 },
      { id: "export", label: "Export", icon: Download },
    ],
  },
];

const VIEWS: { id: SceneView; label: string }[] = [
  { id: "street", label: "3D" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
];

const LIGHTS: { id: LightingPreview; label: string; icon: LucideIcon }[] = [
  { id: "day", label: "Day", icon: Sun },
  { id: "golden", label: "Golden hour", icon: Sunset },
  { id: "night", label: "Night", icon: Moon },
];

const SAVE_TEXT = { saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", error: "Not saved" };

export default function HouseDesignStudio({ params }: { params: { projectId: string } }) {
  const { plan, loadError: planError, isDemo, projectName } = usePlanContext();
  const house = useHouseDesign();
  const { design, document: doc } = house;

  const [section, setSection] = useState<DesignSection>("reference");
  const [gallery, setGallery] = useState(false);
  const [chosen, setChosen] = useState<ReferenceImage | null>(null);
  const [view, setView] = useState<SceneView>("street");
  const [lighting, setLighting] = useState<LightingPreview>("day");
  const [showRoof, setShowRoof] = useState(true);
  const [compare, setCompare] = useState(false);
  const [baseline, setBaseline] = useState("original");
  const [split, setSplit] = useState(50);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [target, setTarget] = useState("exterior.wall");
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sceneRef = useRef<HouseSceneHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const shown = design;
  const rooms = useMemo(() => plan?.levels.flatMap((l) => l.rooms) ?? [], [plan]);
  const working = designOrDefault(design);

  const edit = useCallback(
    (path: string, value: unknown, group?: string) => {
      house.update(setAt(designOrDefault(house.design), path, value), group);
    },
    [house]
  );

  const replace = useCallback((next: HouseDesign) => house.update(next), [house]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y") return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || e.shiftKey) house.redo();
      else house.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [house]);

  const openSection = (id: DesignSection | "gallery") => {
    if (id === "gallery") setGallery(true);
    else {
      setSection(id);
      setGallery(false);
    }
  };

  const onPick = useCallback((part: string | null) => {
    setSelectedPart(part);
    if (!part) return;
    const picked = targetForPart(part);
    if (!picked) return;
    setTarget(picked.path);
    setSection(picked.section);
    if (picked.roomId) setRoomId(picked.roomId);
  }, []);

  const applyGallery = async (id: string) => {
    const reference = referenceFromGallery(id);
    if (!reference || !plan) return;
    const result = await generateFromReference(reference, { levels: plan.levels.length });
    house.applyGenerated(result.design, result.reading, reference);
    setChosen(null);
    setGallery(false);
    showToast(`Applied ${reference.name}. Your floor plan is unchanged.`);
  };

  const reset = (to: "generated" | "original") => {
    house.update(to === "generated" ? doc.generated : null);
    setResetOpen(false);
    setSelectedPart(null);
    showToast(to === "generated" ? "Back to the generated design" : "Back to the original model");
  };

  const lookInside = (id: string) => {
    sceneRef.current?.viewInterior(id);
    showToast("Drag to look around the room. Choose a view below to step back outside.");
  };

  const beforeDesign = useMemo(() => {
    if (baseline === "original") return null;
    if (baseline === "generated") return doc.generated;
    return doc.variations.find((v) => v.id === baseline)?.design ?? null;
  }, [baseline, doc.generated, doc.variations]);

  const dragSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: PointerEvent) => setSplit(Math.min(96, Math.max(4, ((ev.clientX - box.left) / box.width) * 100)));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    move(e.nativeEvent);
  };

  const selectedTarget = selectedPart ? targetForPart(selectedPart) : null;
  const selectedRoom = selectedTarget?.roomId ? rooms.find((r) => r.id === selectedTarget.roomId) : undefined;
  const selectedFinish = selectedTarget
    ? selectedTarget.roomId
      ? roomFinish(working, selectedRoom, selectedTarget.roomId, selectedTarget.path.split(".").pop() as "wall" | "floor" | "ceiling")
      : finishAt(working, selectedTarget.path)
    : undefined;

  const levels = plan?.levels.length ?? 1;
  const appliedGallery = doc.reference?.galleryId;

  const panel = (() => {
    if (!plan) return null;
    switch (section) {
      case "reference":
        return <ReferencePanel levels={levels} onOpenGallery={() => setGallery(true)} onGo={openSection} onToast={showToast} chosen={chosen} onChoose={setChosen} />;
      case "walls":
        return <WallsPanel design={working} edit={edit} />;
      case "facade":
        return <FacadePanel design={working} edit={edit} onReplace={replace} />;
      case "roof":
        return <RoofPanel design={working} edit={edit} />;
      case "windows":
        return <WindowsPanel design={working} edit={edit} />;
      case "doors":
        return <DoorsPanel design={working} edit={edit} />;
      case "balcony":
        return <BalconyPanel design={working} edit={edit} levels={levels} />;
      case "interior":
        return <InteriorPanel design={working} plan={plan} edit={edit} roomId={roomId} onRoom={setRoomId} onLookInside={lookInside} />;
      case "environment":
        return <EnvironmentPanel design={working} edit={edit} />;
      case "materials":
        return <MaterialsPanel design={working} plan={plan} edit={edit} target={target} onTarget={setTarget} />;
      case "variations":
        return <VariationsPanel scene={sceneRef} onToast={showToast} />;
      case "export":
        return <ExportPanel scene={sceneRef} projectName={projectName} design={design} />;
    }
  })();

  const failure = planError ?? house.loadError;

  return (
    <div className="hd-shell">
      <header className="hd-top">
        <div className="hd-top-left">
          <Link href={`/studio/${params.projectId}/3d`} className="hd-back" title="Back to the 3D model" aria-label="Back to the 3D model"><ArrowLeft size={17} /></Link>
          <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text hd-wordmark" priority />
          <div className="hd-crumb">
            <strong>{projectName || (isDemo ? "Demo plan" : "Untitled design")}</strong>
            <span>House design</span>
          </div>
        </div>
        <div className="hd-top-tools" role="toolbar" aria-label="Design history">
          <button type="button" className="hd-tool" onClick={house.undo} disabled={!house.canUndo} title="Undo (Ctrl+Z)"><Undo2 size={15} /><span>Undo</span></button>
          <button type="button" className="hd-tool" onClick={house.redo} disabled={!house.canRedo} title="Redo (Ctrl+Y)"><Redo2 size={15} /><span>Redo</span></button>
          <div className="hd-menu-wrap">
            <button type="button" className="hd-tool" onClick={() => setResetOpen((o) => !o)} aria-expanded={resetOpen} disabled={!design}><RotateCcw size={15} /><span>Reset</span><ChevronDown size={12} /></button>
            {resetOpen && (
              <div className="hd-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => reset("generated")} disabled={!doc.generated}>Back to the generated design</button>
                <button type="button" role="menuitem" onClick={() => reset("original")}>Back to the original model</button>
              </div>
            )}
          </div>
        </div>
        <div className="hd-top-right">
          <span className={`hd-save ${house.saveState}`} title={house.saveError ?? undefined}>
            {house.saveState === "saved" ? <Check size={13} /> : house.saveState === "error" ? <AlertTriangle size={13} /> : house.saveState === "saving" ? <Loader2 size={13} className="hd-spin" /> : <CloudUpload size={13} />}
            {SAVE_TEXT[house.saveState]}
          </span>
          <button type="button" className="hd-button primary small" onClick={async () => { if (await house.saveNow()) showToast("House design saved"); }} disabled={house.saveState === "saving" || !house.ready}><Save size={14} /> Save</button>
          <Link className="hd-button small" href={`/studio/${params.projectId}`}>2D plan</Link>
          <Link className="hd-button small" href={`/studio/${params.projectId}/3d`}>3D model</Link>
        </div>
      </header>

      {house.saveState === "error" && house.saveError && (
        <div className="hd-banner" role="alert">
          <AlertTriangle size={14} /> {house.saveError}
          <button type="button" onClick={() => void house.saveNow()}>Try again</button>
        </div>
      )}

      {failure ? (
        <main className="hd-state">
          <AlertTriangle size={30} />
          <h2>This design could not be opened</h2>
          <p>{failure}</p>
          <Link className="hd-button primary" href="/">Back to projects</Link>
        </main>
      ) : !plan || !house.ready ? (
        <main className="hd-state">
          <Loader2 size={30} className="hd-spin" />
          <h2>Opening your house</h2>
          <p>Loading the floor plan and saved design.</p>
        </main>
      ) : rooms.length === 0 ? (
        <main className="hd-state">
          <Orbit size={30} />
          <h2>Draw your floor plan first</h2>
          <p>A house design is built on your rooms. Add at least one room in the 2D editor, then come back here.</p>
          <Link className="hd-button primary" href={`/studio/${params.projectId}`}><ArrowLeft size={14} /> Open the 2D editor</Link>
        </main>
      ) : (
        <main className="hd-main">
          <nav className="hd-nav" aria-label="Design sections">
            {NAV.map((group) => (
              <div key={group.title}>
                <span>{group.title}</span>
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={(id === "gallery" ? gallery : !gallery && section === id) ? "on" : ""} aria-current={section === id ? "page" : undefined} onClick={() => openSection(id)}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <section className="hd-stage" ref={stageRef} aria-label="3D model">
            {toast && <div className="hd-toast" role="status"><Check size={13} /> {toast}</div>}

            <StudioErrorBoundary fallbackTitle="The 3D view stopped">
              <div className="hd-canvas">
                <HouseScene
                  ref={sceneRef}
                  plan={plan}
                  view={view}
                  showGrid={false}
                  showRoof={showRoof}
                  showLabels={false}
                  showStructuralFrame={false}
                  houseDesign={shown}
                  lighting={lighting}
                  selectedPart={selectedPart}
                  onPickPart={shown ? onPick : undefined}
                  selectedRoomId={section === "interior" ? roomId : null}
                  onSelectRoom={shown ? undefined : (id) => { setRoomId(id); if (id) setSection("interior"); }}
                />
              </div>
              {compare && (
                <div className="hd-canvas hd-before" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-hidden="true">
                  <HouseScene plan={plan} followCamera={sceneRef} showGrid={false} showRoof={showRoof} showLabels={false} showStructuralFrame={false} houseDesign={beforeDesign} lighting={lighting} />
                </div>
              )}
            </StudioErrorBoundary>

            {compare && (
              <>
                <div className="hd-divider" style={{ left: `${split}%` }} onPointerDown={dragSplit} role="slider" aria-label="Comparison position" aria-valuenow={Math.round(split)} aria-valuemin={4} aria-valuemax={96} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "ArrowLeft") setSplit((v) => Math.max(4, v - 2)); if (e.key === "ArrowRight") setSplit((v) => Math.min(96, v + 2)); }}>
                  <i><ChevronDown size={13} /><ChevronDown size={13} /></i>
                </div>
                <span className="hd-tag left">Before</span>
                <span className="hd-tag right">After</span>
              </>
            )}

            {!shown && !gallery && (
              <div className="hd-callout">
                <b>This is your house as drawn</b>
                <span>Choose a reference to give it a design, or start changing anything on the right.</span>
              </div>
            )}

            <div className="hd-bar" role="toolbar" aria-label="View controls">
              <div className="hd-seg" role="group" aria-label="Camera view">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" className={view === v.id ? "on" : ""} aria-pressed={view === v.id} onClick={() => { if (view === v.id) sceneRef.current?.resetCamera(); else setView(v.id); }}>{v.label}</button>
                ))}
              </div>
              <div className="hd-seg" role="group" aria-label="Lighting preview">
                {LIGHTS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={lighting === id ? "on" : ""} aria-pressed={lighting === id} title={label} aria-label={label} disabled={!shown} onClick={() => setLighting(id)}><Icon size={15} /></button>
                ))}
              </div>
              <div className="hd-seg">
                <button type="button" className={compare ? "on" : ""} aria-pressed={compare} disabled={!shown} onClick={() => setCompare((c) => !c)} title="Before and after"><Columns2 size={15} /> <span>Compare</span></button>
                {compare && (
                  <select value={baseline} onChange={(e) => setBaseline(e.target.value)} aria-label="Compare with">
                    <option value="original">Original model</option>
                    {doc.generated && <option value="generated">Generated design</option>}
                    {doc.variations.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                )}
                <button type="button" className={!showRoof ? "on" : ""} aria-pressed={!showRoof} onClick={() => setShowRoof((r) => !r)} title={showRoof ? "Lift the roof off to see the rooms" : "Put the roof back"}><Home size={15} /> <span>{showRoof ? "Lift roof" : "Roof off"}</span></button>
              </div>
              <div className="hd-seg">
                <button type="button" onClick={() => sceneRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in"><ZoomIn size={15} /></button>
                <button type="button" onClick={() => sceneRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out"><ZoomOut size={15} /></button>
                <button type="button" onClick={() => sceneRef.current?.fitToView()} title="Fit to view" aria-label="Fit to view"><Maximize2 size={15} /></button>
              </div>
            </div>
            <p className="hd-orbit-hint">Drag to orbit · Right-drag to pan · Scroll to zoom · Click a surface to edit it</p>

            {gallery && <GalleryOverlay appliedId={appliedGallery} onApply={(id) => void applyGallery(id)} onClose={() => setGallery(false)} />}
          </section>

          <aside className="hd-inspector" aria-label="Customization inspector">
            {selectedTarget && selectedFinish && (
              <div className="hd-selected">
                <div>
                  <span>Selected in the model</span>
                  <button type="button" onClick={() => setSelectedPart(null)} aria-label="Clear selection"><X size={14} /></button>
                </div>
                <FinishPicker label={selectedRoom ? `${selectedRoom.name}: ${selectedTarget.label.toLowerCase()}` : selectedTarget.label} value={selectedFinish} categories={WALL_MATERIALS} compact onChange={(f, g) => edit(selectedTarget.path, f, g)} />
              </div>
            )}
            {panel}
          </aside>
        </main>
      )}
    </div>
  );
}
