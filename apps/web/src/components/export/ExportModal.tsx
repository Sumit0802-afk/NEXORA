"use client";

import { useState } from "react";
import {
  X,
  Download,
  FileImage,
  FileText,
  Boxes,
  Camera,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
} from "lucide-react";
import type { FloorPlan } from "@houseplan/design-schema";
import type * as THREE from "three";
import { floorName } from "@/lib/floors";
import {
  exportFloorPlanAsPngFile,
  exportFloorPlanAsPdfFile,
  exportFloorPlanAsSvgFile,
} from "@/lib/export-2d";
import {
  exportSceneAsGLB,
  exportSceneAsOBJ,
  capture3DScreenshot,
} from "@/lib/export-3d";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: FloorPlan;
  renderer?: THREE.WebGLRenderer | null;
  liveScene?: THREE.Object3D | null;
  activeLevelIndex?: number;
  initialTab?: "2d" | "3d";
}

export function ExportModal({
  isOpen,
  onClose,
  plan,
  renderer,
  liveScene,
  activeLevelIndex = 0,
  initialTab = "2d",
}: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<"2d" | "3d">(initialTab);
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");

  // 2D Options
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeGrid, setIncludeGrid] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<"landscape" | "portrait">("landscape");

  // 3D Options
  const [includeFurniture, setIncludeFurniture] = useState(true);
  const [includeRoof, setIncludeRoof] = useState(true);

  // Status
  const [isExporting, setIsExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const levelCount = plan.levels.length;
  const projectName = plan.projectId || "design";

  // 2D Export Handlers
  const handleExport2DPng = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Rendering high-resolution 3000px PNG...");
    try {
      const isAll = selectedFloor === "all";
      const floors = isAll ? plan.levels.map((_, i) => i) : [Number(selectedFloor)];

      for (const lv of floors) {
        await exportFloorPlanAsPngFile(
          plan,
          {
            levelIndex: lv,
            includeLabels,
            includeDimensions,
            includeGrid,
            projectName,
            units: plan.units,
          },
          `nexora-${projectName}-${isAll ? `floor-${lv + 1}` : "floorplan"}.png`
        );
      }
      setSuccessMsg(
        isAll
          ? `Downloaded ${floors.length} high-resolution floor plans as PNG`
          : `Downloaded ${floorName(Number(selectedFloor))} as PNG`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to export PNG");
    } finally {
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  const handleExport2DPdf = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Compiling architectural PDF sheets...");
    try {
      const isAll = selectedFloor === "all";
      await exportFloorPlanAsPdfFile(
        plan,
        {
          allFloors: isAll,
          levelIndex: isAll ? 0 : Number(selectedFloor),
          orientation: pdfOrientation,
          includeLabels,
          includeDimensions,
          includeGrid,
          projectName,
          units: plan.units,
        },
        `nexora-${projectName}-architectural-sheet.pdf`
      );
      setSuccessMsg(`Generated printable architectural PDF (${isAll ? "All Floors" : floorName(Number(selectedFloor))})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  const handleExport2DSvg = () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Generating scalable vector drawing (SVG)...");
    try {
      const isAll = selectedFloor === "all";
      const floors = isAll ? plan.levels.map((_, i) => i) : [Number(selectedFloor)];

      floors.forEach((lv) => {
        exportFloorPlanAsSvgFile(
          plan,
          {
            levelIndex: lv,
            includeLabels,
            includeDimensions,
            includeGrid,
            projectName,
            units: plan.units,
          },
          `nexora-${projectName}-floor-${lv + 1}.svg`
        );
      });
      setSuccessMsg(
        isAll
          ? `Downloaded ${floors.length} vector SVG drawings`
          : `Downloaded vector SVG for ${floorName(Number(selectedFloor))}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to export SVG");
    } finally {
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  // 3D Export Handlers
  const handleExportGLB = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Packing 3D mesh buffers, materials & textures into GLB...");
    try {
      const isAll = selectedFloor === "all";
      const targetInput = liveScene || plan;

      await exportSceneAsGLB(
        targetInput,
        {
          scope: isAll ? "all" : "single",
          levelIndex: isAll ? undefined : Number(selectedFloor),
          includeFurniture,
          includeRoof,
          projectName,
        },
        `nexora-${projectName}-model.glb`
      );
      setSuccessMsg("Downloaded binary 3D model (.GLB) with materials & geometry");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to export GLB model");
    } finally {
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  const handleExportOBJ = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Converting 3D scene to Wavefront OBJ polygon mesh...");
    try {
      const isAll = selectedFloor === "all";
      const targetInput = liveScene || plan;

      await exportSceneAsOBJ(
        targetInput,
        {
          scope: isAll ? "all" : "single",
          levelIndex: isAll ? undefined : Number(selectedFloor),
          includeFurniture,
          includeRoof,
          projectName,
        },
        `nexora-${projectName}-model.obj`
      );
      setSuccessMsg("Downloaded Wavefront 3D mesh (.OBJ)");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to export OBJ model");
    } finally {
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  const handleExport3DScreenshot = () => {
    setIsExporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (!renderer) {
        throw new Error("3D viewer is not currently active. Open the 3D viewer to take a live viewport screenshot.");
      }
      const data = capture3DScreenshot(renderer, `nexora-${projectName}-3d-view.png`);
      if (!data) throw new Error("Could not capture 3D viewport canvas");
      setSuccessMsg("Captured high-resolution 3D screenshot");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to capture screenshot");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Export Architectural Assets</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Download printable 2D drawings or editable 3D house models
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 pt-3 gap-6 bg-white dark:bg-zinc-900">
          <button
            onClick={() => setActiveTab("2d")}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === "2d"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <FileText size={16} />
            <span>2D Floor Plan</span>
          </button>
          <button
            onClick={() => setActiveTab("3d")}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === "3d"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Boxes size={16} />
            <span>3D House Model</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notifications */}
          {successMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-sm">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isExporting && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-sm animate-pulse">
              <RotateCcw size={18} className="shrink-0 animate-spin text-indigo-600" />
              <span className="font-medium">{progressMsg || "Preparing export..."}</span>
            </div>
          )}

          {/* Floor Scope Selector */}
          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Floor Scope
              </label>
              <span className="text-xs text-zinc-400">{levelCount} floor{levelCount > 1 ? "s" : ""} in building</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFloor("all")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition ${
                  selectedFloor === "all"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Complete Building
              </button>
              {plan.levels.map((lvl, idx) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSelectedFloor(idx)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition ${
                    selectedFloor === idx
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {floorName(idx)}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: 2D FLOOR PLAN */}
          {activeTab === "2d" && (
            <div className="space-y-5">
              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeLabels}
                    onChange={(e) => setIncludeLabels(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">Room Names & Dims</div>
                    <div className="text-zinc-500 text-[11px]">Show room titles and dimension tags</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeDimensions}
                    onChange={(e) => setIncludeDimensions(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">Exterior Dimension Chains</div>
                    <div className="text-zinc-500 text-[11px]">Total plot width and depth measurements</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeGrid}
                    onChange={(e) => setIncludeGrid(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">Architectural Grid Lines</div>
                    <div className="text-zinc-500 text-[11px]">Subtle background measurement grid</div>
                  </div>
                </label>

                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-center">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">PDF Page Layout</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPdfOrientation("landscape")}
                      className={`flex-1 py-1 px-2 text-xs rounded border text-center transition ${
                        pdfOrientation === "landscape"
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Landscape
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfOrientation("portrait")}
                      className={`flex-1 py-1 px-2 text-xs rounded border text-center transition ${
                        pdfOrientation === "portrait"
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Portrait
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Cards */}
              <div className="space-y-2.5 pt-2">
                {/* PNG Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                      <FileImage size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Export High-Res PNG
                        <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 px-1.5 py-0.5 rounded">3000px · 300 DPI</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Crisp raster image with architectural title block, ready for presentations and client approvals.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExport2DPng}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                  >
                    Download PNG
                  </button>
                </div>

                {/* PDF Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600">
                      <FileText size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Export Architectural PDF
                        <span className="text-[10px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 px-1.5 py-0.5 rounded">Print Ready</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Multi-page document with professional title blocks, drawing borders, scale bar, and project info.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExport2DPdf}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                </div>

                {/* SVG Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                      <Download size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Export Scalable SVG
                        <span className="text-[10px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 px-1.5 py-0.5 rounded">Pure Vector</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Infinite zoom vector format. Compatible with AutoCAD, Adobe Illustrator, Inkscape, and web tools.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExport2DSvg}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white shadow-sm transition disabled:opacity-50"
                  >
                    Download SVG
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 3D HOUSE MODEL */}
          {activeTab === "3d" && (
            <div className="space-y-5">
              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeFurniture}
                    onChange={(e) => setIncludeFurniture(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">Include 3D Furniture</div>
                    <div className="text-zinc-500 text-[11px]">Beds, sofas, kitchen cabinets, bathroom fixtures</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeRoof}
                    onChange={(e) => setIncludeRoof(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">Include Roof & Terrace</div>
                    <div className="text-zinc-500 text-[11px]">Rooftop slabs, pergolas, railings, and planters</div>
                  </div>
                </label>
              </div>

              {/* Informative notice on editable geometry */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Geometry Formats:</strong> GLB and OBJ export actual 3D polygon meshes with physical coordinates that you can import and edit in Blender, Unreal Engine, AutoCAD, or 3D printers. Screenshot is a 2D image only.
                </div>
              </div>

              {/* 3D Action Cards */}
              <div className="space-y-2.5">
                {/* GLB Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600">
                      <Boxes size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Export GLB (glTF Binary)
                        <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 px-1.5 py-0.5 rounded">Recommended</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Standard binary format with embedded materials, PBR textures, and hierarchies. Ideal for Three.js, Blender, AR, and Unity.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExportGLB}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                  >
                    Download GLB
                  </button>
                </div>

                {/* OBJ Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                      <Layers size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Export Wavefront OBJ
                        <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 px-1.5 py-0.5 rounded">CAD Mesh</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Universal polygonal 3D mesh supported by Rhino, SketchUp, Revit, 3ds Max, and Maya.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExportOBJ}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white shadow-sm transition disabled:opacity-50"
                  >
                    Download OBJ
                  </button>
                </div>

                {/* 3D Screenshot Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 dark:hover:border-indigo-900 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                      <Camera size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        3D View Screenshot (PNG)
                        <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 px-1.5 py-0.5 rounded">Visual Snapshot</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Captures current 3D camera perspective, lighting, and realistic shadows as a flat PNG image.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isExporting}
                    onClick={handleExport3DScreenshot}
                    className="shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm transition disabled:opacity-50"
                  >
                    Capture View
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-500">
          <div>
            Project: <strong className="text-zinc-700 dark:text-zinc-300">{projectName}</strong> ({plan.plot.width} × {plan.plot.length} {plan.units})
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
