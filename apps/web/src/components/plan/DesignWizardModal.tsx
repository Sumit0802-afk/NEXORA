"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Building,
  Check,
  ChevronRight,
  Compass,
  Copy,
  DoorOpen,
  Eye,
  Layers,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  Ruler,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { PlanThumbnail } from "./PlanThumbnail";
import {
  ARCHITECTURAL_DESIGNS,
  TERRACE_DESIGNS,
  generateArchitecturalPlan,
  type ArchitecturalDesignId,
  type TerraceDesignId,
} from "@/lib/architectural-layouts";
import { floorName } from "@/lib/floors";
import type { FloorPlan } from "@houseplan/design-schema";

export interface DesignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: FloorPlan | null;
  onApplyPlan: (newPlan: FloorPlan, open3d?: boolean) => void;
  onSaveAsNew?: (newPlan: FloorPlan, name: string) => void;
  onRestoreOriginal?: () => void;
  canRestoreOriginal?: boolean;
  direct3dUrl?: string;
}

export function DesignWizardModal({
  isOpen,
  onClose,
  currentPlan,
  onApplyPlan,
  onSaveAsNew,
  onRestoreOriginal,
  canRestoreOriginal = false,
  direct3dUrl,
}: DesignWizardModalProps) {
  // Current user configuration
  const plotWidth = currentPlan?.plot.width ?? 30;
  const plotLength = currentPlan?.plot.length ?? 45;
  const plotUnits = currentPlan?.units ?? "ft";
  const defaultFloors = currentPlan?.levels.length ?? 2;

  // Selected design states
  const [selectedDesignId, setSelectedDesignId] = useState<ArchitecturalDesignId>("modern_open");
  const [selectedTerraceId, setSelectedTerraceId] = useState<TerraceDesignId>("pergola");
  const [selectedFloors, setSelectedFloors] = useState<number>(Math.min(3, Math.max(1, defaultFloors)));
  const [previewFloorIndex, setPreviewFloorIndex] = useState<number>(0);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareDesignId, setCompareDesignId] = useState<ArchitecturalDesignId>("family_spacious");

  // Generate candidate plan for active selection
  const activeCandidate = useMemo(() => {
    return generateArchitecturalPlan({
      designId: selectedDesignId,
      terraceId: selectedTerraceId,
      plotWidth,
      plotLength,
      units: plotUnits,
      floors: selectedFloors,
    });
  }, [selectedDesignId, selectedTerraceId, plotWidth, plotLength, plotUnits, selectedFloors]);

  // Generate comparison candidate
  const comparisonCandidate = useMemo(() => {
    if (!compareMode) return null;
    return generateArchitecturalPlan({
      designId: compareDesignId,
      terraceId: selectedTerraceId,
      plotWidth,
      plotLength,
      units: plotUnits,
      floors: selectedFloors,
    });
  }, [compareMode, compareDesignId, selectedTerraceId, plotWidth, plotLength, plotUnits, selectedFloors]);

  if (!isOpen) return null;

  const currentDesignSpec = ARCHITECTURAL_DESIGNS[selectedDesignId];
  const activeLevelCount = activeCandidate.plan.levels.length;
  const safePreviewFloor = Math.min(previewFloorIndex, activeLevelCount - 1);

  return (
    <div className="design-wizard-overlay" role="dialog" aria-modal="true">
      <div className="design-wizard-modal">
        {/* ── Wizard Header ── */}
        <header className="design-wizard-header">
          <div className="design-wizard-title-group">
            <div className="design-wizard-badge">
              <Sparkles size={13} style={{ color: "var(--c-7B68EE, #7B68EE)" }} />
              <span>Architectural Design Studio</span>
            </div>
            <h2>Choose Your Architectural House Layout</h2>
            <p>
              Select from 8 distinct structural house archetypes and custom rooftop terrace designs for your{" "}
              <strong>
                {plotWidth} × {plotLength} {plotUnits}
              </strong>{" "}
              plot. Each option features real structural geometry, wall layouts, and vertical staircase stacking.
            </p>
          </div>

          <div className="design-wizard-header-actions">
            {canRestoreOriginal && onRestoreOriginal && (
              <button
                type="button"
                className="button outline"
                onClick={onRestoreOriginal}
                title="Restore the initial plan"
              >
                <RotateCcw size={13} style={{ marginRight: 5 }} />
                Restore Original
              </button>
            )}

            {direct3dUrl && (
              <Link
                href={direct3dUrl}
                className="button outline"
                onClick={onClose}
                title="Open 3D view with current plan unchanged"
              >
                <Box size={13} style={{ marginRight: 5 }} />
                Keep Current in 3D
              </Link>
            )}

            <button
              type="button"
              className={`button outline${compareMode ? " active" : ""}`}
              onClick={() => setCompareMode((c) => !c)}
              title="Compare two designs side-by-side"
            >
              <LayoutGrid size={13} style={{ marginRight: 5 }} />
              {compareMode ? "Single View" : "Compare Layouts"}
            </button>

            <button
              type="button"
              className="design-wizard-close-btn"
              onClick={onClose}
              title="Close and keep current plan"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── Storey & Plot Specs Bar ── */}
        <div className="design-wizard-specs-bar">
          <div className="design-wizard-specs-left">
            <span className="design-wizard-spec-pill">
              <Ruler size={13} style={{ color: "var(--c-5146A5, #5146A5)" }} />
              <span>Plot: {plotWidth} × {plotLength} {plotUnits} ({plotWidth * plotLength} sq {plotUnits})</span>
            </span>

            {/* Storey Selector */}
            <div className="design-wizard-floors-toggle">
              <span className="design-wizard-floors-label">
                <Layers size={13} style={{ color: "var(--c-5146A5, #5146A5)" }} />
                <span>Storeys:</span>
              </span>
              {[1, 2, 3].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`design-wizard-floor-chip${selectedFloors === f ? " active" : ""}`}
                  onClick={() => {
                    setSelectedFloors(f);
                    setPreviewFloorIndex(0);
                  }}
                >
                  {f === 1 ? "1 Floor (G)" : f === 2 ? "2 Floors (G+1)" : "3 Floors (G+2)"}
                </button>
              ))}
            </div>
          </div>

          <div className="design-wizard-specs-right">
            <span className="design-wizard-valid-badge">
              <ShieldCheck size={14} style={{ color: "var(--c-10B981, #10B981)" }} />
              <span>100% Validated against plot boundary</span>
            </span>
          </div>
        </div>

        {/* ── Wizard Body ── */}
        <div className="design-wizard-body">
          {/* Left Column: 8 Architectural Archetype Cards */}
          <div className="design-wizard-designs-list">
            <div className="design-wizard-list-header">
              <span>8 Architectural Layouts</span>
              <small>Click to preview layout</small>
            </div>

            <div className="design-wizard-cards-grid">
              {(Object.keys(ARCHITECTURAL_DESIGNS) as ArchitecturalDesignId[]).map((id) => {
                const spec = ARCHITECTURAL_DESIGNS[id];
                const isSelected = selectedDesignId === id;
                const isCompared = compareMode && compareDesignId === id;

                return (
                  <div
                    key={id}
                    className={`design-wizard-card${isSelected ? " selected" : ""}${isCompared ? " compared" : ""}`}
                    onClick={() => {
                      if (compareMode && selectedDesignId !== id) {
                        setCompareDesignId(id);
                      } else {
                        setSelectedDesignId(id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="design-wizard-card-top">
                      <span className="design-wizard-footprint-tag">{spec.footprintType}</span>
                      <div className="design-wizard-card-ratings">
                        <span title="Circulation efficiency score">
                          ⚡ {spec.circulationScore}%
                        </span>
                        <span title="Natural lighting rating">
                          ☀️ {spec.lightRating}
                        </span>
                      </div>
                    </div>

                    <div className="design-wizard-card-title-row">
                      <h4>{spec.name}</h4>
                      {isSelected && (
                        <span className="design-wizard-card-check">
                          <Check size={13} />
                        </span>
                      )}
                    </div>

                    <p className="design-wizard-card-tagline">{spec.tagline}</p>

                    <ul className="design-wizard-card-features">
                      {spec.features.slice(0, 2).map((feat, idx) => (
                        <li key={idx}>• {feat}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive 2D Preview, Terrace Options & Actions */}
          <div className="design-wizard-preview-panel">
            {/* Design Headline & Key Metrics */}
            <div className="design-wizard-detail-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3>{currentDesignSpec.name}</h3>
                  <span className="design-wizard-tag-pill">{currentDesignSpec.footprintType}</span>
                </div>
                <p className="design-wizard-detail-desc">{currentDesignSpec.description}</p>
              </div>

              {/* Metrics Pill Matrix */}
              <div className="design-wizard-metrics-matrix">
                <div className="design-wizard-metric-item">
                  <span className="metric-label">Built-up Area</span>
                  <strong className="metric-value">{activeCandidate.metrics.builtUpArea} sq {plotUnits}</strong>
                </div>
                <div className="design-wizard-metric-item">
                  <span className="metric-label">Rooms</span>
                  <strong className="metric-value">{activeCandidate.metrics.roomCount} Spaces</strong>
                </div>
                <div className="design-wizard-metric-item">
                  <span className="metric-label">Bedrooms</span>
                  <strong className="metric-value">{activeCandidate.metrics.bedroomCount} Beds</strong>
                </div>
                <div className="design-wizard-metric-item">
                  <span className="metric-label">Bathrooms</span>
                  <strong className="metric-value">{activeCandidate.metrics.bathroomCount} Baths</strong>
                </div>
              </div>
            </div>

            {/* Floor Navigation Tabs */}
            <div className="design-wizard-floor-tabs">
              <span className="design-wizard-tabs-label">Floor View:</span>
              {Array.from({ length: activeLevelCount }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`design-wizard-tab-btn${safePreviewFloor === idx ? " active" : ""}`}
                  onClick={() => setPreviewFloorIndex(idx)}
                >
                  <span>{floorName(idx)}</span>
                  {idx === activeLevelCount - 1 && selectedFloors > 1 && (
                    <small style={{ opacity: 0.8 }}> + Terrace</small>
                  )}
                </button>
              ))}
            </div>

            {/* ── Interactive 2D Floor Plan Preview Canvas ── */}
            <div className={`design-wizard-canvas-stage${compareMode ? " compare-split" : ""}`}>
              {/* Primary Candidate Preview */}
              <div className="design-wizard-plan-wrapper">
                <div className="design-wizard-plan-badge">
                  <span>{currentDesignSpec.name} — {floorName(safePreviewFloor)}</span>
                </div>
                <PlanThumbnail
                  plan={activeCandidate.plan}
                  levelIndex={safePreviewFloor}
                  dimensions={true}
                  className="design-wizard-thumbnail-svg"
                />
              </div>

              {/* Comparison Candidate Preview (if Compare Mode active) */}
              {compareMode && comparisonCandidate && (
                <div className="design-wizard-plan-wrapper">
                  <div className="design-wizard-plan-badge comparison">
                    <span>
                      {ARCHITECTURAL_DESIGNS[compareDesignId].name} — {floorName(safePreviewFloor)}
                    </span>
                  </div>
                  <PlanThumbnail
                    plan={comparisonCandidate.plan}
                    levelIndex={safePreviewFloor}
                    dimensions={true}
                    className="design-wizard-thumbnail-svg"
                  />
                </div>
              )}
            </div>

            {/* ── Terrace & Rooftop Structural Layout Selector ── */}
            {selectedFloors > 1 && (
              <div className="design-wizard-terrace-section">
                <div className="design-wizard-terrace-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sun size={14} style={{ color: "var(--c-D97706, #D97706)" }} />
                    <strong>Rooftop Terrace Structural Design</strong>
                  </div>
                  <small>Modifies actual top-floor rooms, walls, parapets & geometry</small>
                </div>

                <div className="design-wizard-terrace-options">
                  {(Object.keys(TERRACE_DESIGNS) as TerraceDesignId[]).map((tId) => {
                    const tSpec = TERRACE_DESIGNS[tId];
                    const isTSelected = selectedTerraceId === tId;

                    return (
                      <button
                        key={tId}
                        type="button"
                        className={`design-wizard-terrace-btn${isTSelected ? " active" : ""}`}
                        onClick={() => {
                          setSelectedTerraceId(tId);
                          // Automatically view the top floor to show the terrace changes immediately!
                          setPreviewFloorIndex(activeLevelCount - 1);
                        }}
                      >
                        <div className="terrace-btn-title">
                          <span>{tSpec.name}</span>
                          {isTSelected && <Check size={12} />}
                        </div>
                        <small>{tSpec.tagline}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Action Buttons Footer ── */}
            <div className="design-wizard-actions-bar">
              <div className="design-wizard-actions-left">
                {onSaveAsNew && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      onSaveAsNew(
                        activeCandidate.plan,
                        `${currentDesignSpec.name} (${selectedFloors}F)`
                      );
                      onClose();
                    }}
                    title="Duplicate project and save this design as a new file"
                  >
                    <Copy size={13} style={{ marginRight: 5 }} />
                    Save as New Design
                  </button>
                )}
              </div>

              <div className="design-wizard-actions-right">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    onApplyPlan(activeCandidate.plan, false);
                    onClose();
                  }}
                  title="Apply this layout to the 2D floor plan editor"
                >
                  <DoorOpen size={13} style={{ marginRight: 5 }} />
                  Apply to 2D Editor
                </button>

                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    onApplyPlan(activeCandidate.plan, true);
                    onClose();
                  }}
                  title="Apply this layout and launch the 3D Studio model"
                >
                  <Box size={14} style={{ marginRight: 6 }} />
                  <span>Apply & Open in 3D</span>
                  <ArrowRight size={13} style={{ marginLeft: 6 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
