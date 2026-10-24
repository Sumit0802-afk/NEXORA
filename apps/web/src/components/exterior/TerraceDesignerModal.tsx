"use client";

import React, { useState } from "react";
import type { FloorPlan, Room } from "@houseplan/design-schema";
import {
  type TerraceConfig,
  type ExteriorConfig,
  type RailingStyle,
  type TerraceShadeStructure,
  type TerraceFlooring,
  type FacadeStyleId,
  DEFAULT_TERRACE_CONFIG,
  DEFAULT_EXTERIOR_CONFIG,
  RAILING_STYLES,
  SHADING_STRUCTURES,
  TERRACE_FLOOR_OPTIONS,
  FACADE_PRESETS,
  TERRACE_FURNITURE_CATALOG,
} from "@/lib/terrace-catalog";
import {
  TERRACE_DESIGNS_LIST,
  type TerraceDesignId,
  applyTerraceGrid,
} from "@/lib/architectural-layouts";

export interface TerraceVariation {
  id: string;
  name: string;
  timestamp: number;
  terraceConfig: TerraceConfig;
  exteriorConfig: ExteriorConfig;
  terraceLayoutId: TerraceDesignId;
}

interface TerraceDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: FloorPlan;
  onUpdatePlan: (updatedPlan: FloorPlan) => void;
  terraceConfig: TerraceConfig;
  onUpdateTerraceConfig: (config: TerraceConfig) => void;
  exteriorConfig: ExteriorConfig;
  onUpdateExteriorConfig: (config: ExteriorConfig) => void;
  onViewTerrace?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

type TabKey = "layouts" | "structure" | "exterior" | "furniture" | "variations";

export function TerraceDesignerModal({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
  terraceConfig,
  onUpdateTerraceConfig,
  exteriorConfig,
  onUpdateExteriorConfig,
  onViewTerrace,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: TerraceDesignerModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("layouts");
  const [variations, setVariations] = useState<TerraceVariation[]>(() => [
    {
      id: "var-default",
      name: "Default Modern Skyline",
      timestamp: Date.now(),
      terraceConfig: { ...DEFAULT_TERRACE_CONFIG },
      exteriorConfig: { ...DEFAULT_EXTERIOR_CONFIG },
      terraceLayoutId: "open",
    },
  ]);
  const [newVarName, setNewVarName] = useState("");
  const [selectedFurniture, setSelectedFurniture] = useState<string>("outdoor_sofa");

  if (!isOpen) return null;

  const topLevelIndex = plan.levels.length - 1;
  const topLevel = plan.levels[topLevelIndex];

  // Helper to re-generate the top floor's terrace layout geometry
  const handleApplyLayout = (layoutId: TerraceDesignId) => {
    onUpdateTerraceConfig({
      ...terraceConfig,
      layoutId,
      // Map appropriate default shading structure
      shadeStructure:
        layoutId === "pergola"
          ? "pergola"
          : layoutId === "covered"
          ? "covered_pavilion"
          : layoutId === "lounge"
          ? "sky_lounge"
          : layoutId === "solar"
          ? "solar_rack"
          : layoutId === "traditional_indian"
          ? "indian_chhatri"
          : terraceConfig.shadeStructure,
    });

    if (!topLevel) return;

    // Derive bounds from existing top level or lower floor
    const bounds = topLevel.rooms.reduce(
      (acc, r) => {
        for (const pt of r.polygon) {
          acc.minX = Math.min(acc.minX, pt[0]);
          acc.maxX = Math.max(acc.maxX, pt[0]);
          acc.minY = Math.min(acc.minY, pt[1]);
          acc.maxY = Math.max(acc.maxY, pt[1]);
        }
        return acc;
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const x0 = Number.isFinite(bounds.minX) ? bounds.minX : 0;
    const y0 = Number.isFinite(bounds.minY) ? bounds.minY : 0;
    const x1 = Number.isFinite(bounds.maxX) && bounds.maxX > x0 ? bounds.maxX : 20;
    const y1 = Number.isFinite(bounds.maxY) && bounds.maxY > y0 ? bounds.maxY : 20;

    // Keep non-terrace rooms (such as staircase room) intact
    const nonTerraceRooms = topLevel.rooms.filter(
      (r) => r.type === "staircase" || (!r.id.includes("roof") && !r.id.includes("terrace") && !r.id.includes("deck") && !r.id.includes("lawn") && !r.id.includes("pergola") && !r.id.includes("pavilion") && !r.id.includes("sky-lounge") && !r.id.includes("drying-yard") && !r.id.includes("solar-array") && !r.id.includes("chhatri"))
    );

    const newRooms: Room[] = [...nonTerraceRooms];
    applyTerraceGrid("terrace", layoutId, x0, y0, x1, y1, newRooms);

    const updatedLevels = [...plan.levels];
    updatedLevels[topLevelIndex] = {
      ...topLevel,
      rooms: newRooms,
    };

    onUpdatePlan({
      ...plan,
      levels: updatedLevels,
    });
  };

  const handleSaveVariation = () => {
    const name = newVarName.trim() || `Design Variation ${variations.length + 1}`;
    const newVar: TerraceVariation = {
      id: `var-${Date.now()}`,
      name,
      timestamp: Date.now(),
      terraceConfig: { ...terraceConfig },
      exteriorConfig: { ...exteriorConfig },
      terraceLayoutId: (terraceConfig.layoutId as TerraceDesignId) || "open",
    };
    setVariations((prev) => [newVar, ...prev]);
    setNewVarName("");
  };

  const handleRestoreVariation = (v: TerraceVariation) => {
    onUpdateTerraceConfig(v.terraceConfig);
    onUpdateExteriorConfig(v.exteriorConfig);
    handleApplyLayout(v.terraceLayoutId);
  };

  const handleResetToDefault = () => {
    onUpdateTerraceConfig(DEFAULT_TERRACE_CONFIG);
    onUpdateExteriorConfig(DEFAULT_EXTERIOR_CONFIG);
    handleApplyLayout("open");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white text-xl shadow-lg">
              🏛️
            </span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Terrace & Exterior Designer
                <span className="px-2 py-0.5 text-xs font-semibold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  3D Studio
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Architectural rooftop structures, railings, outdoor furniture & estate facade styling
              </p>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            {onViewTerrace && (
              <button
                type="button"
                onClick={onViewTerrace}
                className="px-3.5 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                title="Orient 3D camera onto the rooftop terrace"
              >
                🔭 <span>View Terrace</span>
              </button>
            )}

            {onUndo && (
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                title="Undo edit"
              >
                ↩️ Undo
              </button>
            )}

            {onRedo && (
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                title="Redo edit"
              >
                ↪️ Redo
              </button>
            )}

            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Reset terrace and facade to clean defaults"
            >
              ↺ Reset
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition-colors ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 gap-2">
          {(
            [
              { id: "layouts", label: "Terrace Layouts (9)", icon: "📐" },
              { id: "structure", label: "Rooftop Structure & Railings", icon: "🛡️" },
              { id: "exterior", label: "Exterior Facade & Estate", icon: "🏡" },
              { id: "furniture", label: "Outdoor Staging & Decor", icon: "🛋️" },
              { id: "variations", label: "Save & Compare Variations", icon: "📑" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-amber-400 text-amber-300 bg-amber-400/5 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: 9 TERRACE LAYOUTS */}
          {activeTab === "layouts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Selectable Terrace Layouts</h3>
                  <p className="text-xs text-slate-400">
                    Each layout creates a genuinely different architectural rooftop space and geometry in the 3D model.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Active: <strong className="text-amber-300">{terraceConfig.layoutId}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TERRACE_DESIGNS_LIST.map((design) => {
                  const isSelected = terraceConfig.layoutId === design.id;
                  return (
                    <div
                      key={design.id}
                      onClick={() => handleApplyLayout(design.id)}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-gradient-to-b from-indigo-950/60 to-slate-900 border-amber-400 shadow-lg shadow-indigo-950/50 ring-1 ring-amber-400"
                          : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {isSelected && <span className="text-amber-400">✓</span>}
                            {design.name}
                          </h4>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {design.tagline}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed mb-3">{design.description}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {design.features.map((feat, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-800"
                            >
                              • {feat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Architectural geometry</span>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                            isSelected
                              ? "bg-amber-400 text-slate-950"
                              : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          }`}
                        >
                          {isSelected ? "Applied to 3D" : "Apply Layout"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: STRUCTURE & RAILINGS */}
          {activeTab === "structure" && (
            <div className="space-y-6">
              {/* Railing Style */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>🛡️</span> Terrace Perimeter Railing & Parapet
                  </h3>
                  <span className="text-xs text-slate-400">Enforces structural safety & aesthetics</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {RAILING_STYLES.map((style) => {
                    const isSelected = terraceConfig.railingStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => onUpdateTerraceConfig({ ...terraceConfig, railingStyle: style.id })}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "bg-indigo-950/70 border-amber-400 shadow-md ring-1 ring-amber-400"
                            : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800"
                        }`}
                      >
                        <div>
                          <div
                            className="w-full h-8 rounded-md mb-2 flex items-center justify-center border border-white/10"
                            style={{ backgroundColor: style.color, opacity: style.opacity }}
                          >
                            <span className="text-[10px] font-bold text-slate-900 drop-shadow-sm">
                              {style.id.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white mb-1">{style.name}</div>
                          <p className="text-[11px] text-slate-400 leading-tight">{style.description}</p>
                        </div>
                        <div className="mt-2 text-right">
                          <span
                            className={`text-[10px] font-semibold ${
                              isSelected ? "text-amber-400" : "text-slate-500"
                            }`}
                          >
                            {isSelected ? "Active Railing" : "Select"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shading Structure */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>⛺</span> Overhead Shading & Shelter Structure
                  </h3>
                  <span className="text-xs text-slate-400">Canopies, pergolas, solar racks and gazebos</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SHADING_STRUCTURES.map((shade) => {
                    const isSelected = terraceConfig.shadeStructure === shade.id;
                    return (
                      <button
                        key={shade.id}
                        type="button"
                        onClick={() => onUpdateTerraceConfig({ ...terraceConfig, shadeStructure: shade.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-indigo-950/70 border-amber-400 shadow-md ring-1 ring-amber-400"
                            : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{shade.name}</span>
                          {isSelected && <span className="text-xs text-amber-400">✓</span>}
                        </div>
                        <div className="text-[10px] text-amber-300/80 mb-1 font-medium">{shade.tagline}</div>
                        <p className="text-[11px] text-slate-400">{shade.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Flooring & Mumty Enclosure Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
                {/* Flooring Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white block">
                    Terrace Flooring Material
                  </label>
                  <select
                    value={terraceConfig.flooring}
                    onChange={(e) =>
                      onUpdateTerraceConfig({
                        ...terraceConfig,
                        flooring: e.target.value as TerraceFlooring,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  >
                    {TERRACE_FLOOR_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    High-durability outdoor waterproof pavers, teak, or lush turf.
                  </p>
                </div>

                {/* Parapet Height */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white block">
                    Parapet Wall Height: <span className="text-amber-400">{terraceConfig.parapetHeight} ft</span>
                  </label>
                  <div className="flex gap-2">
                    {[3.0, 3.5, 4.0, 4.5].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onUpdateTerraceConfig({ ...terraceConfig, parapetHeight: h })}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                          terraceConfig.parapetHeight === h
                            ? "bg-amber-400 text-slate-950 border-amber-400 font-bold"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        {h} ft
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">Standard residential building code is 3.5 - 4.0 ft.</p>
                </div>

                {/* Staircase Mumty & Lighting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                    <div>
                      <span className="text-xs font-semibold text-white block">Staircase Mumty Headhouse</span>
                      <span className="text-[10px] text-slate-400">Weather-tight cabin & roof access door</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={terraceConfig.hasMumty}
                      onChange={(e) =>
                        onUpdateTerraceConfig({ ...terraceConfig, hasMumty: e.target.checked })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                    <div>
                      <span className="text-xs font-semibold text-white block">Outdoor Lighting</span>
                      <span className="text-[10px] text-slate-400">Solar bollards and ambient perimeter LEDs</span>
                    </div>
                    <select
                      value={terraceConfig.outdoorLighting}
                      onChange={(e) =>
                        onUpdateTerraceConfig({
                          ...terraceConfig,
                          outdoorLighting: e.target.value as any,
                        })
                      }
                      className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="solar_bollards">Solar Bollards</option>
                      <option value="perimeter_led">Perimeter LED</option>
                      <option value="warm_sconces">Warm Sconces</option>
                      <option value="festoon">Festoon Lights</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXTERIOR & FACADE */}
          {activeTab === "exterior" && (
            <div className="space-y-6">
              {/* Facade Preset */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>🏛️</span> Architectural Exterior & Facade Presets
                  </h3>
                  <span className="text-xs text-slate-400">
                    Alters architectural volumes, entry portico, and facade accents
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FACADE_PRESETS.map((preset) => {
                    const isSelected = exteriorConfig.facadeStyle === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateExteriorConfig({
                            ...exteriorConfig,
                            facadeStyle: preset.id,
                            balconyRailing:
                              preset.id === "traditional_indian"
                                ? "jali"
                                : preset.id === "luxury"
                                ? "glass"
                                : exteriorConfig.balconyRailing,
                          })
                        }
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-indigo-950/70 border-amber-400 shadow-md ring-1 ring-amber-400"
                            : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{preset.name}</span>
                          <span
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: preset.accentColor }}
                          />
                        </div>
                        <div className="text-[10px] text-amber-300/80 mb-1 font-medium">{preset.tagline}</div>
                        <p className="text-[11px] text-slate-400 mb-2">{preset.description}</p>
                        <div className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 inline-block border border-slate-800">
                          {preset.cladding}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Site Landscaping & Front Entrance Features */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🏡</span> Front Entrance, Site & Landscaping Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Entrance Portico */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-white block">Entrance Portico & Canopy</span>
                      <span className="text-[10px] text-slate-400">Architectural drop-off porch with columns</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exteriorConfig.hasEntrancePortico}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          hasEntrancePortico: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </label>

                  {/* Boundary Wall */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-white block">Front Boundary Wall</span>
                      <span className="text-[10px] text-slate-400">Perimeter privacy wall with coping</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exteriorConfig.hasBoundaryWall}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          hasBoundaryWall: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </label>

                  {/* Main Gate */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-white block">Main Gate & Gate Pillars</span>
                      <span className="text-[10px] text-slate-400">Driveway sliding gate with lanterns</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exteriorConfig.hasMainGate}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          hasMainGate: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </label>

                  {/* Driveway Pavers */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-white block">Driveway Stone Pavers</span>
                      <span className="text-[10px] text-slate-400">Paved entrance driveway & parking slab</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exteriorConfig.hasDrivewayPavers}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          hasDrivewayPavers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </label>

                  {/* Front Garden */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-white block">Front Landscaping Lawn</span>
                      <span className="text-[10px] text-slate-400">Lush green setback grass with trees</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exteriorConfig.hasFrontGarden}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          hasFrontGarden: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-500 rounded bg-slate-700 border-slate-600 focus:ring-amber-400"
                    />
                  </label>

                  {/* Balcony Railing Style */}
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">Balcony Railings</span>
                      <span className="text-[10px] text-slate-400">Matches floor balconies</span>
                    </div>
                    <select
                      value={exteriorConfig.balconyRailing}
                      onChange={(e) =>
                        onUpdateExteriorConfig({
                          ...exteriorConfig,
                          balconyRailing: e.target.value as RailingStyle,
                        })
                      }
                      className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="glass">Frameless Glass</option>
                      <option value="metal_slats">Metal Slats</option>
                      <option value="jali">Terracotta Jali</option>
                      <option value="baluster">Cast Baluster</option>
                      <option value="solid_parapet">Solid Masonry</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FURNITURE & STAGING */}
          {activeTab === "furniture" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>🛋️</span> Rooftop & Outdoor Staging Catalog
                  </h3>
                  <p className="text-xs text-slate-400">
                    High-end weatherproof outdoor furniture, planters, solar arrays, and barbecue islands.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TERRACE_FURNITURE_CATALOG.map((item) => {
                  const isSelected = selectedFurniture === item.type;
                  return (
                    <div
                      key={item.type}
                      onClick={() => setSelectedFurniture(item.type)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-indigo-950/70 border-amber-400 shadow-md ring-1 ring-amber-400"
                          : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white">{item.name}</span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-tight mb-2">{item.description}</p>
                        <div className="text-[10px] text-slate-400">
                          Dimensions: {item.dimensions.width}W × {item.dimensions.depth}D × {item.dimensions.height}H ft
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: item.defaultColor }}
                        />
                        <span className="text-xs font-medium text-amber-300">
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: VARIATIONS */}
          {activeTab === "variations" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>📑</span> Saved Terrace & Facade Variations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compare multiple design schemes for the same house without losing interior furniture or layout data.
                  </p>
                </div>
              </div>

              {/* Create New Variation */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Enter variation name (e.g., Summer Garden Pavilion, Modern Solar Rooftop)..."
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSaveVariation}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm"
                >
                  Save Current Design
                </button>
              </div>

              {/* Variations List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {variations.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{v.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(v.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-300 mb-3">
                        <div>
                          • Layout: <strong className="text-amber-300">{v.terraceLayoutId}</strong>
                        </div>
                        <div>
                          • Railing: <strong className="text-slate-200">{v.terraceConfig.railingStyle}</strong>
                        </div>
                        <div>
                          • Shading: <strong className="text-slate-200">{v.terraceConfig.shadeStructure}</strong>
                        </div>
                        <div>
                          • Facade: <strong className="text-slate-200">{v.exteriorConfig.facadeStyle}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Snapshot preserved</span>
                      <button
                        type="button"
                        onClick={() => handleRestoreVariation(v)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                      >
                        Restore Variation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>💡</span>
            <span>All modifications update the 3D model immediately in real-time.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              Done & Return to 3D View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
