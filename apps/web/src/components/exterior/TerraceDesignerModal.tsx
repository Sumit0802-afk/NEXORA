"use client";

import React, { useState } from "react";
import { TerraceLayoutEditor } from "./TerraceLayoutEditor";
import { TerraceArt, type TerraceArtKind } from "./TerraceArt";
import { CARD_PHOTOS, LAYOUT_PHOTOS, TERRACE_PHOTOS, terracePhotoSrc } from "@/lib/terrace-photos";
import { Armchair, Bookmark, Images, Building2, Check, Home, LayoutGrid, Redo2, RotateCcw, ShieldCheck, Telescope, Undo2, Warehouse, X } from "lucide-react";
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

type TabKey = "layouts" | "editor" | "gallery" | "structure" | "exterior" | "furniture" | "variations";

function CardMedia({ kind, label }: { kind: TerraceArtKind; label: string }) {
  const layoutId = kind.startsWith("layout:") ? kind.slice(7) : null;
  const photo = CARD_PHOTOS[kind] ?? (layoutId && LAYOUT_PHOTOS[layoutId] ? TERRACE_PHOTOS.find((p) => p.id === LAYOUT_PHOTOS[layoutId]) : undefined);
  if (!photo) return <TerraceArt kind={kind} label={label} />;
  return (
    <figure className="tdm-media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tdm-photo" src={terracePhotoSrc(photo.id)} alt={label} loading="lazy" width={photo.width} height={photo.height} />
      <span className="tdm-credit" title={`${photo.caption} (${photo.source})`}>
        Photo: {photo.author} · {photo.license}
      </span>
    </figure>
  );
}

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

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    { id: "layouts", label: "Terrace Layouts", icon: <LayoutGrid size={14} /> },
    { id: "editor", label: "Edit Terrace", icon: <Armchair size={14} /> },
    { id: "gallery", label: "Inspiration", icon: <Images size={14} /> },
    { id: "structure", label: "Structure & Railings", icon: <ShieldCheck size={14} /> },
    { id: "exterior", label: "Facade & Estate", icon: <Building2 size={14} /> },
    { id: "furniture", label: "Outdoor Decor", icon: <Armchair size={14} /> },
    { id: "variations", label: "Save & Compare", icon: <Bookmark size={14} /> },
  ];

  const setTerrace = (patch: Partial<TerraceConfig>) => onUpdateTerraceConfig({ ...terraceConfig, ...patch });
  const setExterior = (patch: Partial<ExteriorConfig>) => onUpdateExteriorConfig({ ...exteriorConfig, ...patch });

  const exteriorToggles: { key: keyof ExteriorConfig; title: string; hint: string }[] = [
    { key: "hasEntrancePortico", title: "Entrance Portico & Canopy", hint: "Drop-off porch with columns" },
    { key: "hasBoundaryWall", title: "Front Boundary Wall", hint: "Perimeter privacy wall with coping" },
    { key: "hasMainGate", title: "Main Gate & Pillars", hint: "Driveway sliding gate with lanterns" },
    { key: "hasDrivewayPavers", title: "Driveway Stone Pavers", hint: "Paved entrance and parking slab" },
    { key: "hasFrontGarden", title: "Front Landscaping Lawn", hint: "Setback grass with trees" },
  ];

  return (
    <div className="tdm-overlay" role="dialog" aria-modal="true" aria-label="Terrace & Exterior Designer">
      <div className="tdm">
        <header className="tdm-header">
          <div className="tdm-title">
            <span className="tdm-title-icon"><Warehouse size={20} /></span>
            <div>
              <h2>Terrace & Exterior Designer</h2>
              <p>Rooftop structures, railings, outdoor furniture and facade styling</p>
            </div>
          </div>
          <div className="tdm-actions">
            {onViewTerrace && (
              <button type="button" className="button outline small" onClick={onViewTerrace} title="Orient the 3D camera onto the rooftop terrace">
                <Telescope size={13} /> View Terrace
              </button>
            )}
            {onUndo && (
              <button type="button" className="button outline icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
                <Undo2 size={13} />
              </button>
            )}
            {onRedo && (
              <button type="button" className="button outline icon-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
                <Redo2 size={13} />
              </button>
            )}
            <button type="button" className="button outline small" onClick={handleResetToDefault} title="Reset terrace and facade to defaults">
              <RotateCcw size={13} /> Reset
            </button>
            <button type="button" className="interior-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="tdm-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={`tdm-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="tdm-body">
          {activeTab === "layouts" && (
            <section>
              <div className="tdm-section-head">
                <h3>Terrace Layouts</h3>
                <p>Each layout rebuilds the rooftop rooms and geometry in the 3D model.</p>
              </div>
              <div className="tdm-grid tdm-grid-3">
                {TERRACE_DESIGNS_LIST.map((design) => {
                  const isSelected = terraceConfig.layoutId === design.id;
                  return (
                    <div key={design.id} className={`tdm-card tdm-has-art${isSelected ? " selected" : ""}`}>
                      <CardMedia kind={`layout:${design.id}`} label={`${design.name} example`} />
                      <div>
                        <h4>{isSelected && <Check size={14} />} {design.name}</h4>
                        <div className="tdm-card-tag">{design.tagline}</div>
                        <p className="tdm-card-desc">{design.description}</p>
                        <ul className="tdm-chips">
                          {design.features.map((feat) => (
                            <li key={feat}>{feat}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="tdm-card-foot">
                        <button
                          type="button"
                          className={`button small${isSelected ? " primary" : " outline"}`}
                          onClick={() => handleApplyLayout(design.id)}
                          disabled={isSelected}
                        >
                          {isSelected ? "Applied" : "Apply Layout"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "editor" && <TerraceLayoutEditor plan={plan} onUpdatePlan={onUpdatePlan} />}

          {activeTab === "gallery" && (
            <section>
              <div className="tdm-section-head">
                <h3>Terrace Inspiration</h3>
                <p>Real rooftop terraces and roof gardens for reference. Pick a matching layout under Terrace Layouts to build it in 3D.</p>
              </div>
              <div className="tdm-gallery">
                {TERRACE_PHOTOS.map((ph) => (
                  <figure key={ph.id} className="tdm-figure">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={terracePhotoSrc(ph.id)} alt={ph.caption} loading="lazy" width={ph.width} height={ph.height} />
                    <figcaption>
                      <strong>{ph.caption}</strong>
                      <a href={ph.source} target="_blank" rel="noopener noreferrer">{ph.author} · {ph.license}</a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {activeTab === "structure" && (
            <section className="tdm-stack">
              <div>
                <div className="tdm-section-head">
                  <h3>Perimeter Railing & Parapet</h3>
                  <p>Safety and look of the terrace edge</p>
                </div>
                <div className="tdm-grid tdm-grid-5">
                  {RAILING_STYLES.map((style) => {
                    const isSelected = terraceConfig.railingStyle === style.id;
                    return (
                      <button key={style.id} type="button" className={`tdm-card tdm-option tdm-has-art${isSelected ? " selected" : ""}`} onClick={() => setTerrace({ railingStyle: style.id })} aria-pressed={isSelected}>
                        <CardMedia kind={`rail:${style.id}`} label={`${style.name} example`} />
                        <strong>{style.name}</strong>
                        <small>{style.description}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="tdm-section-head">
                  <h3>Shading & Shelter</h3>
                  <p>Canopies, pergolas, solar racks and gazebos</p>
                </div>
                <div className="tdm-grid tdm-grid-3">
                  {SHADING_STRUCTURES.map((shade) => {
                    const isSelected = terraceConfig.shadeStructure === shade.id;
                    return (
                      <button key={shade.id} type="button" className={`tdm-card tdm-option tdm-has-art${isSelected ? " selected" : ""}`} onClick={() => setTerrace({ shadeStructure: shade.id })} aria-pressed={isSelected}>
                        <CardMedia kind={`shade:${shade.id}`} label={`${shade.name} example`} />
                        <strong>{isSelected && <Check size={13} />} {shade.name}</strong>
                        <span className="tdm-card-tag">{shade.tagline}</span>
                        <small>{shade.description}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tdm-grid tdm-grid-3 tdm-settings">
                <div className="tdm-field">
                  <label htmlFor="tdm-flooring">Terrace Flooring</label>
                  <select id="tdm-flooring" value={terraceConfig.flooring} onChange={(e) => setTerrace({ flooring: e.target.value as TerraceFlooring })}>
                    {TERRACE_FLOOR_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <small>Waterproof pavers, teak or turf.</small>
                </div>

                <div className="tdm-field">
                  <label>Parapet Height: <strong>{terraceConfig.parapetHeight} ft</strong></label>
                  <div className="tdm-seg">
                    {[3.0, 3.5, 4.0, 4.5].map((h) => (
                      <button key={h} type="button" className={terraceConfig.parapetHeight === h ? "active" : ""} onClick={() => setTerrace({ parapetHeight: h })}>
                        {h} ft
                      </button>
                    ))}
                  </div>
                  <small>Residential code is typically 3.5 – 4.0 ft.</small>
                </div>

                <div className="tdm-field">
                  <label className="tdm-toggle">
                    <span><strong>Staircase Headhouse</strong><small>Weather-tight roof access cabin</small></span>
                    <input type="checkbox" checked={terraceConfig.hasMumty} onChange={(e) => setTerrace({ hasMumty: e.target.checked })} />
                  </label>
                  <label className="tdm-toggle">
                    <span><strong>Outdoor Lighting</strong></span>
                    <select value={terraceConfig.outdoorLighting} onChange={(e) => setTerrace({ outdoorLighting: e.target.value as TerraceConfig["outdoorLighting"] })}>
                      <option value="solar_bollards">Solar Bollards</option>
                      <option value="perimeter_led">Perimeter LED</option>
                      <option value="warm_sconces">Warm Sconces</option>
                      <option value="festoon">Festoon Lights</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === "exterior" && (
            <section className="tdm-stack">
              <div>
                <div className="tdm-section-head">
                  <h3>Facade Presets</h3>
                  <p>Changes volumes, entry portico and facade accents</p>
                </div>
                <div className="tdm-grid tdm-grid-3">
                  {FACADE_PRESETS.map((preset) => {
                    const isSelected = exteriorConfig.facadeStyle === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        className={`tdm-card tdm-option tdm-has-art${isSelected ? " selected" : ""}`}
                        onClick={() =>
                          setExterior({
                            facadeStyle: preset.id as FacadeStyleId,
                            balconyRailing:
                              preset.id === "traditional_indian" ? "jali" : preset.id === "luxury" ? "glass" : exteriorConfig.balconyRailing,
                          })
                        }
                      >
                        <CardMedia kind={`facade:${preset.id}`} label={`${preset.name} example`} />
                        <strong>
                          {isSelected && <Check size={13} />} {preset.name}
                          <span className="tdm-dot" style={{ backgroundColor: preset.accentColor }} />
                        </strong>
                        <span className="tdm-card-tag">{preset.tagline}</span>
                        <small>{preset.description}</small>
                        <em className="tdm-pill">{preset.cladding}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="tdm-section-head">
                  <h3>Entrance, Site & Landscaping</h3>
                </div>
                <div className="tdm-grid tdm-grid-3">
                  {exteriorToggles.map((t) => (
                    <label key={t.key} className="tdm-toggle tdm-card">
                      <span><strong>{t.title}</strong><small>{t.hint}</small></span>
                      <input type="checkbox" checked={Boolean(exteriorConfig[t.key])} onChange={(e) => setExterior({ [t.key]: e.target.checked } as Partial<ExteriorConfig>)} />
                    </label>
                  ))}
                  <label className="tdm-toggle tdm-card">
                    <span><strong>Balcony Railings</strong><small>Matches floor balconies</small></span>
                    <select value={exteriorConfig.balconyRailing} onChange={(e) => setExterior({ balconyRailing: e.target.value as RailingStyle })}>
                      <option value="glass">Frameless Glass</option>
                      <option value="metal_slats">Metal Slats</option>
                      <option value="jali">Terracotta Jali</option>
                      <option value="baluster">Cast Baluster</option>
                      <option value="solid_parapet">Solid Masonry</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === "furniture" && (
            <section>
              <div className="tdm-section-head">
                <h3>Outdoor Staging Catalog</h3>
                <p>Weatherproof furniture, planters, solar arrays and barbecue islands</p>
              </div>
              <div className="tdm-grid tdm-grid-3">
                {TERRACE_FURNITURE_CATALOG.map((item) => {
                  const isSelected = selectedFurniture === item.type;
                  return (
                    <button key={item.type} type="button" aria-pressed={isSelected} className={`tdm-card tdm-option tdm-has-art${isSelected ? " selected" : ""}`} onClick={() => setSelectedFurniture(item.type)}>
                      <CardMedia kind={`furn:${item.type}`} label={`${item.name} example`} />
                      <strong>
                        <span className="tdm-dot" style={{ backgroundColor: item.defaultColor }} /> {item.name}
                      </strong>
                      <span className="tdm-card-tag">{item.category}</span>
                      <small>{item.description}</small>
                      <em className="tdm-pill">{item.dimensions.width}W × {item.dimensions.depth}D × {item.dimensions.height}H ft</em>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "variations" && (
            <section className="tdm-stack">
              <div className="tdm-section-head">
                <h3>Saved Variations</h3>
                <p>Compare terrace and facade schemes without touching interiors or layout.</p>
              </div>
              <div className="tdm-save-row">
                <input type="text" placeholder="Variation name, e.g. Summer Garden Pavilion" value={newVarName} onChange={(e) => setNewVarName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveVariation()} />
                <button type="button" className="button primary" onClick={handleSaveVariation}>Save Current Design</button>
              </div>
              <div className="tdm-grid tdm-grid-2">
                {variations.map((v) => (
                  <div key={v.id} className="tdm-card">
                    <div>
                      <div className="tdm-card-head">
                        <h4>{v.name}</h4>
                        <small>{new Date(v.timestamp).toLocaleDateString()}</small>
                      </div>
                      <dl className="tdm-facts">
                        <dt>Layout</dt><dd>{v.terraceLayoutId}</dd>
                        <dt>Railing</dt><dd>{v.terraceConfig.railingStyle}</dd>
                        <dt>Shading</dt><dd>{v.terraceConfig.shadeStructure}</dd>
                        <dt>Facade</dt><dd>{v.exteriorConfig.facadeStyle}</dd>
                      </dl>
                    </div>
                    <div className="tdm-card-foot">
                      <button type="button" className="button outline small" onClick={() => handleRestoreVariation(v)}>Restore Variation</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="tdm-footer">
          <span><Home size={13} /> Changes update the 3D model immediately.</span>
          <button type="button" className="button primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}
