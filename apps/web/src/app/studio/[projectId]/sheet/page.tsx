"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Printer,
  FileText,
  Layers,
  Building,
  Scissors,
  Table,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  ChevronRight,
  Settings,
  AlertCircle,
} from "lucide-react";
import { usePlanContext } from "../plan-context";
import { floorName, floorsLabel } from "@/lib/floors";
import {
  generateElevationsSvg,
  generateSectionsSvg,
  generateSchedulesSvg,
  exportMultiPageDrawingBookPdf,
  DEFAULT_SHEET_META,
  PAPER_FORMATS,
  type DrawingSheetMeta,
} from "@/lib/architectural-drawings";
import { generateSingleFloorSvg, exportFloorPlanAsPdfFile } from "@/lib/export-2d";
import { triggerDownload } from "@/lib/export-2d";

export default function ProfessionalDrawingSheetPage({ params }: { params: { projectId: string } }) {
  const { plan, loadError, projectName, isDemo } = usePlanContext();

  const [activeSheet, setActiveSheet] = useState<"plans" | "elevations" | "sections" | "schedules">("plans");
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0);
  const [paperFormat, setPaperFormat] = useState<"a3" | "a4" | "letter">("a3");
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [statusMsg, setStatusMsg] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Title block metadata
  const [sheetMeta, setSheetMeta] = useState<DrawingSheetMeta>({
    ...DEFAULT_SHEET_META,
    projectName: projectName || "RESIDENTIAL HOUSE DESIGN",
  });
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  useEffect(() => {
    if (projectName) {
      setSheetMeta((prev) => ({ ...prev, projectName }));
    }
  }, [projectName]);

  // Current active SVG string
  const currentSheetSvg = useMemo(() => {
    if (!plan) return "";
    switch (activeSheet) {
      case "plans":
        return generateSingleFloorSvg(plan, selectedFloorIndex, {
          includeLabels: true,
          includeDimensions: true,
          includeTitleBlock: true,
          includeNorthArrow: true,
          projectName: sheetMeta.projectName,
        });
      case "elevations":
        return generateElevationsSvg(plan, sheetMeta);
      case "sections":
        return generateSectionsSvg(plan, sheetMeta);
      case "schedules":
        return generateSchedulesSvg(plan, sheetMeta);
      default:
        return "";
    }
  }, [plan, activeSheet, selectedFloorIndex, sheetMeta]);

  if (loadError) {
    return (
      <main className="app-shell">
        <div className="error-state" style={{ margin: 40 }}>
          <h3>Couldn&apos;t load project drawings</h3>
          <p>{loadError}</p>
          <Link className="button" href="/">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="app-shell">
        <div className="muted" style={{ padding: 40 }}>Loading architectural sheets…</div>
      </main>
    );
  }

  // Export handlers
  const handleExportCurrentSvg = () => {
    const blob = new Blob([currentSheetSvg], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(blob, `nexora-${params.projectId}-${activeSheet}-sheet.svg`);
    setStatusMsg("Downloaded vector SVG sheet");
  };

  const handleExportCurrentPng = async () => {
    setIsExporting(true);
    setStatusMsg("Rasterizing 3000px high-res sheet...");
    try {
      const img = new window.Image();
      const svgBlob = new Blob([currentSheetSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const width = 3000;
        const height = Math.round((width * img.height) / (img.width || 1));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const link = document.createElement("a");
        link.download = `nexora-${params.projectId}-${activeSheet}-sheet.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setStatusMsg("Downloaded 3000px high-res PNG sheet");
        setIsExporting(false);
      };
      img.src = url;
    } catch (err) {
      setStatusMsg("Failed to export PNG");
      setIsExporting(false);
    }
  };

  const handleExportMultiPageBook = async () => {
    setIsExporting(true);
    setStatusMsg("Compiling complete multi-page architectural drawing set PDF...");
    try {
      await exportMultiPageDrawingBookPdf(
        plan,
        sheetMeta,
        paperFormat as "a3" | "a4",
        `nexora-${params.projectId}-complete-drawing-book.pdf`
      );
      setStatusMsg("Exported complete multi-page architectural drawing book (PDF)");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "PDF Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="app-shell sheet-studio-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--c-F4F3F8, #F4F3F8)" }}>
      {/* Top Bar */}
      <header className="topbar no-print" style={{ background: "var(--c-1D1A3F, #1D1A3F)", color: "var(--c-FFFFFF, #FFFFFF)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--c-36325E, #36325E)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href={`/studio/${params.projectId}`} className="brand" style={{ display: "flex", alignItems: "center" }}>
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text" style={{ filter: "brightness(0) invert(1)", height: 24, width: "auto" }} />
          </Link>
          <span style={{ color: "var(--c-7A759E, #7A759E)" }}>|</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-E0DCF5, #E0DCF5)" }}>
            Architectural Drawing Sheets & Schedules
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusMsg && <span style={{ fontSize: 12, color: "var(--c-FFF4D6, #FFF4D6)", background: "rgba(255, 244, 214, 0.15)", padding: "4px 10px", borderRadius: 6 }}>{statusMsg}</span>}
          <Link className="button" href={`/studio/${params.projectId}`} style={{ background: "rgba(255,255,255,0.1)", color: "var(--c-FFFFFF, #FFFFFF)", border: "none" }}>
            <ArrowLeft size={14} style={{ marginRight: 5 }} /> Back to 2D
          </Link>
          <button className="button" onClick={handleExportCurrentSvg} style={{ background: "rgba(255,255,255,0.1)", color: "var(--c-FFFFFF, #FFFFFF)", border: "none" }}>
            <Download size={14} style={{ marginRight: 5 }} /> SVG
          </button>
          <button className="button" onClick={handleExportCurrentPng} style={{ background: "rgba(255,255,255,0.1)", color: "var(--c-FFFFFF, #FFFFFF)", border: "none" }}>
            <Download size={14} style={{ marginRight: 5 }} /> PNG (300 DPI)
          </button>
          <button className="button primary" onClick={handleExportMultiPageBook} disabled={isExporting} style={{ background: "var(--c-5146A5, #5146A5)", color: "var(--c-FFF4D6, #FFF4D6)", fontWeight: 700 }}>
            <Printer size={14} style={{ marginRight: 5 }} /> {isExporting ? "Compiling..." : "Export Multi-Page PDF"}
          </button>
        </div>
      </header>

      {/* Studio Sub-Header: Sheet Selector Navigation */}
      <div className="no-print" style={{ background: "var(--c-FFFFFF, #FFFFFF)", borderBottom: "1px solid var(--c-E2E0EC, #E2E0EC)", padding: "8px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setActiveSheet("plans")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: activeSheet === "plans" ? "#5146A5" : "transparent",
              color: activeSheet === "plans" ? "#FFFFFF" : "#4A4568",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Layers size={15} /> Floor Plans ({plan.levels.length})
          </button>

          <button
            onClick={() => setActiveSheet("elevations")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: activeSheet === "elevations" ? "#5146A5" : "transparent",
              color: activeSheet === "elevations" ? "#FFFFFF" : "#4A4568",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Building size={15} /> 4-Facade Elevations
          </button>

          <button
            onClick={() => setActiveSheet("sections")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: activeSheet === "sections" ? "#5146A5" : "transparent",
              color: activeSheet === "sections" ? "#FFFFFF" : "#4A4568",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Scissors size={15} /> Building Cross-Sections
          </button>

          <button
            onClick={() => setActiveSheet("schedules")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: activeSheet === "schedules" ? "#5146A5" : "transparent",
              color: activeSheet === "schedules" ? "#FFFFFF" : "#4A4568",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Table size={15} /> Doors, Windows & Finishes
          </button>
        </div>

        {/* Level Selector (when on Floor Plans) & Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {activeSheet === "plans" && plan.levels.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Floor:</span>
              {plan.levels.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFloorIndex(i)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: selectedFloorIndex === i ? "#1D1A3F" : "#EAE7F2",
                    color: selectedFloorIndex === i ? "#FFFFFF" : "#333",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {floorName(i)}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--c-F0EEF8, #F0EEF8)", padding: "2px 6px", borderRadius: 8 }}>
            <button onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))} title="Zoom Out" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, width: 36, textAlign: "center" }}>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.1))} title="Zoom In" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
              <ZoomIn size={14} />
            </button>
            <button onClick={() => setZoomLevel(1.0)} title="Reset Scale" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
              <RotateCcw size={13} />
            </button>
          </div>

          <button
            onClick={() => setShowMetaSettings(!showMetaSettings)}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: showMetaSettings ? "#EDEAF8" : "transparent",
              color: "var(--c-5146A5, #5146A5)",
              border: "1px solid var(--c-D6D2E8, #D6D2E8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Settings size={13} /> Title Block
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Drawing Canvas Area */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
              boxShadow: "0 12px 36px rgba(0,0,0,0.12)",
              background: "var(--c-FFFFFF, #FFFFFF)",
              borderRadius: 4,
              maxWidth: "100%",
              maxHeight: "100%",
              width: 1100,
              aspectRatio: "1.414 / 1", // A3 / A4 standard landscape aspect ratio
            }}
            dangerouslySetInnerHTML={{ __html: currentSheetSvg }}
          />
        </div>

        {/* Title Block Settings Drawer */}
        {showMetaSettings && (
          <aside className="no-print" style={{ width: 320, background: "var(--c-FFFFFF, #FFFFFF)", borderLeft: "1px solid var(--c-E2E0EC, #E2E0EC)", padding: 20, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-1D1A3F, #1D1A3F)" }}>Title Block Properties</h3>
              <button onClick={() => setShowMetaSettings(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
              <div>
                <label style={{ fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Project Title</label>
                <input
                  type="text"
                  value={sheetMeta.projectName}
                  onChange={(e) => setSheetMeta({ ...sheetMeta, projectName: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #CCC" }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Client / Owner Name</label>
                <input
                  type="text"
                  value={sheetMeta.clientName}
                  onChange={(e) => setSheetMeta({ ...sheetMeta, clientName: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #CCC" }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Drawing Scale</label>
                <input
                  type="text"
                  value={sheetMeta.scale}
                  onChange={(e) => setSheetMeta({ ...sheetMeta, scale: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #CCC" }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Project Number</label>
                <input
                  type="text"
                  value={sheetMeta.projectNumber}
                  onChange={(e) => setSheetMeta({ ...sheetMeta, projectNumber: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #CCC" }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Paper Standard</label>
                <select
                  value={paperFormat}
                  onChange={(e) => setPaperFormat(e.target.value as any)}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #CCC" }}
                >
                  <option value="a3">ISO A3 (420 × 297 mm)</option>
                  <option value="a4">ISO A4 (297 × 210 mm)</option>
                  <option value="letter">US Letter (11 × 8.5 in)</option>
                </select>
              </div>

              <div style={{ marginTop: 10, padding: 12, background: "var(--c-F5F3FF, #F5F3FF)", borderRadius: 8, border: "1px solid var(--c-DDD6FE, #DDD6FE)" }}>
                <span style={{ fontSize: 11, color: "var(--c-5B21B6, #5B21B6)", fontWeight: 600 }}>Standard Compliance:</span>
                <p style={{ fontSize: 11, color: "var(--c-6D28D9, #6D28D9)", marginTop: 4, lineHeight: 1.4 }}>
                  Drawings are rendered in 1:1 architectural vector coordinate space with full dimensional chains, title block margins, and level datums.
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
