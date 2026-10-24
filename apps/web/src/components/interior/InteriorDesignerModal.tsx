"use client";

import { useState, useMemo } from "react";
import {
  Armchair,
  Bath,
  BedDouble,
  Box,
  Check,
  ChevronDown,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  Flame,
  Home,
  Info,
  Layers,
  Lightbulb,
  Maximize2,
  Paintbrush,
  Palette,
  Plus,
  RefreshCw,
  RotateCw,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  Utensils,
  Wand2,
  X,
  AlertTriangle,
} from "lucide-react";
import type { FloorPlan, FurnitureItem, Room, RoomInterior } from "@houseplan/design-schema";
import {
  FURNITURE_CATALOG,
  WALL_FINISHES,
  FLOOR_MATERIALS,
  CEILING_STYLES,
  LIGHTING_OPTIONS,
  type FurnitureCatalogItem,
  type FurnitureCategory,
  autoFurnishRoom,
  validateRoomFurniture,
  getRoomBounds,
} from "@/lib/interior-catalog";
import { floorName } from "@/lib/floors";

export interface InteriorDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: FloorPlan | null;
  onUpdatePlan: (updatedPlan: FloorPlan) => void;
  initialRoomId?: string | null;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function InteriorDesignerModal({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
  initialRoomId,
  selectedFurnitureId: externalSelectedFurnitureId,
  onSelectFurniture: externalOnSelectFurniture,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: InteriorDesignerModalProps) {
  const [activeTab, setActiveTab] = useState<"furniture" | "style" | "smart">("furniture");
  const [categoryFilter, setCategoryFilter] = useState<FurnitureCategory | "all">("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || "");
  const [localSelectedFurnitureId, setLocalSelectedFurnitureId] = useState<string | null>(null);

  const selectedFurnitureId = externalSelectedFurnitureId ?? localSelectedFurnitureId;
  const setSelectedFurnitureId = (id: string | null) => {
    setLocalSelectedFurnitureId(id);
    externalOnSelectFurniture?.(id);
  };

  // Get all rooms from all levels
  const allRoomsWithLevel = useMemo(() => {
    if (!plan) return [];
    return plan.levels.flatMap((lv, lvIdx) =>
      lv.rooms.map((room) => ({
        room,
        levelId: lv.id,
        levelIndex: lvIdx,
        levelName: floorName(lvIdx),
      }))
    );
  }, [plan]);

  // Current active room object
  const currentRoomEntry = useMemo(() => {
    if (!allRoomsWithLevel.length) return null;
    if (selectedRoomId) {
      const found = allRoomsWithLevel.find((r) => r.room.id === selectedRoomId);
      if (found) return found;
    }
    return allRoomsWithLevel[0];
  }, [allRoomsWithLevel, selectedRoomId]);

  const activeRoom = currentRoomEntry?.room ?? null;
  const activeLevelId = currentRoomEntry?.levelId ?? "ground";
  const activeLevelIndex = currentRoomEntry?.levelIndex ?? 0;

  // Furniture items in current level and room
  const currentLevel = plan?.levels[activeLevelIndex];
  const roomFurniture = useMemo(() => {
    if (!currentLevel || !activeRoom) return [];
    const items = (currentLevel.furniture || []) as FurnitureItem[];
    return items.filter((f) => f.roomId === activeRoom.id);
  }, [currentLevel, activeRoom]);

  // Selected furniture item
  const selectedFurniture = useMemo(() => {
    return roomFurniture.find((f) => f.id === selectedFurnitureId) ?? null;
  }, [roomFurniture, selectedFurnitureId]);

  // Clearance and area analysis
  const clearanceAnalysis = useMemo(() => {
    if (!activeRoom) return null;
    return validateRoomFurniture(activeRoom, roomFurniture);
  }, [activeRoom, roomFurniture]);

  if (!isOpen || !plan || !activeRoom) return null;

  const roomBounds = getRoomBounds(activeRoom.polygon);

  // ── Mutators ────────────────────────────────────────────────────────

  const updateLevelFurniture = (newFurniture: FurnitureItem[]) => {
    const updatedLevels = plan.levels.map((lv, idx) => {
      if (idx !== activeLevelIndex) return lv;
      return {
        ...lv,
        furniture: newFurniture,
      };
    });
    onUpdatePlan({ ...plan, levels: updatedLevels });
  };

  const updateRoomInterior = (interiorPatch: Partial<RoomInterior>) => {
    const updatedLevels = plan.levels.map((lv, idx) => {
      if (idx !== activeLevelIndex) return lv;
      return {
        ...lv,
        rooms: lv.rooms.map((r) => {
          if (r.id !== activeRoom.id) return r;
          return {
            ...r,
            interior: {
              ...(r.interior || {}),
              ...interiorPatch,
            },
          };
        }),
      };
    });
    onUpdatePlan({ ...plan, levels: updatedLevels });
  };

  // Add furniture from catalog
  const handleAddFurniture = (catItem: FurnitureCatalogItem) => {
    const allLevelFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).slice();

    // Place near center with slight offset based on existing count
    const offset = (roomFurniture.length % 4) * 1.0;
    const posX = Math.min(roomBounds.maxX - catItem.dimensions.width / 2, Math.max(roomBounds.minX + catItem.dimensions.width / 2, roomBounds.centerX + offset - 1.5));
    const posY = Math.min(roomBounds.maxY - catItem.dimensions.depth / 2, Math.max(roomBounds.minY + catItem.dimensions.depth / 2, roomBounds.centerY + offset - 1.5));

    const newItem: FurnitureItem = {
      id: `furn-${catItem.type}-${Date.now()}`,
      name: catItem.name,
      category: catItem.category,
      type: catItem.type,
      roomId: activeRoom.id,
      levelId: activeLevelId,
      position: [posX, posY, 0],
      rotation: 0,
      scale: [1, 1, 1],
      dimensions: { ...catItem.dimensions },
      material: {
        color: catItem.defaultColor,
        secondaryColor: catItem.defaultSecondaryColor,
      },
    };

    allLevelFurniture.push(newItem);
    updateLevelFurniture(allLevelFurniture);
    setSelectedFurnitureId(newItem.id);
  };

  // Update specific furniture item
  const handleUpdateItem = (id: string, patch: Partial<FurnitureItem>) => {
    const allLevelFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).map((f) => {
      if (f.id !== id) return f;
      return { ...f, ...patch };
    });
    updateLevelFurniture(allLevelFurniture);
  };

  // Quick 90 deg rotation
  const handleRotate90 = (item: FurnitureItem) => {
    const nextRot = (item.rotation + Math.PI / 2) % (2 * Math.PI);
    handleUpdateItem(item.id, { rotation: nextRot });
  };

  // Duplicate furniture item
  const handleDuplicateItem = (item: FurnitureItem) => {
    const allLevelFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).slice();
    const cloned: FurnitureItem = {
      ...JSON.parse(JSON.stringify(item)),
      id: `furn-${item.type}-${Date.now()}`,
      name: `${item.name} (Copy)`,
      position: [
        Math.min(roomBounds.maxX - 1, item.position[0] + 1.2),
        Math.min(roomBounds.maxY - 1, item.position[1] + 1.2),
        item.position[2],
      ],
    };
    allLevelFurniture.push(cloned);
    updateLevelFurniture(allLevelFurniture);
    setSelectedFurnitureId(cloned.id);
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    const allLevelFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).filter((f) => f.id !== id);
    updateLevelFurniture(allLevelFurniture);
    if (selectedFurnitureId === id) setSelectedFurnitureId(null);
  };

  // Auto furnish room
  const handleAutoFurnish = () => {
    const generated = autoFurnishRoom(activeRoom, activeLevelId);
    // Replace current room's furniture with auto layout
    const otherRoomsFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).filter((f) => f.roomId !== activeRoom.id);
    updateLevelFurniture([...otherRoomsFurniture, ...generated]);
  };

  // Clear room furniture
  const handleClearRoom = () => {
    const otherRoomsFurniture = ((currentLevel?.furniture || []) as FurnitureItem[]).filter((f) => f.roomId !== activeRoom.id);
    updateLevelFurniture(otherRoomsFurniture);
    setSelectedFurnitureId(null);
  };

  // Filtered catalog items
  const catalogList = useMemo(() => {
    if (categoryFilter === "all") return FURNITURE_CATALOG;
    return FURNITURE_CATALOG.filter((item) => item.category === categoryFilter);
  }, [categoryFilter]);

  const currentInterior = activeRoom.interior || {};

  return (
    <div className="interior-modal-overlay" role="dialog" aria-modal="true">
      <div className="interior-modal">
        {/* ── Top Header ── */}
        <header className="interior-modal-header">
          <div className="interior-modal-title-group">
            <div className="interior-modal-badge">
              <Paintbrush size={13} style={{ color: "#7B68EE" }} />
              <span>Realistic Interior Designer</span>
            </div>
            <h2>Furnish & Style: {activeRoom.name}</h2>
            <p className="interior-modal-subtitle">
              Interactive 3D furniture placement, finishes, lighting, and smart clearance analysis for {currentRoomEntry?.levelName}.
            </p>
          </div>

          <div className="interior-modal-actions">
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
            <button type="button" className="button primary" onClick={onClose}>
              Done
            </button>
            <button type="button" className="interior-close-btn" onClick={onClose} title="Close Designer">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── Room Selector & Metric Bar ── */}
        <div className="interior-room-bar">
          <div className="interior-room-select-group">
            <label className="interior-label">Active Room:</label>
            <div className="interior-select-wrap">
              <select
                className="interior-room-select"
                value={activeRoom.id}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  setSelectedFurnitureId(null);
                }}
              >
                {allRoomsWithLevel.map(({ room, levelName }) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({levelName} · {room.type})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="interior-select-chevron" />
            </div>
          </div>

          <div className="interior-metrics">
            <span className="interior-metric-pill">
              <strong>Dimensions:</strong> {roomBounds.width.toFixed(1)} × {roomBounds.depth.toFixed(1)} {plan.units}
            </span>
            <span className="interior-metric-pill">
              <strong>Floor Area:</strong> {clearanceAnalysis?.roomArea} {plan.units}²
            </span>
            <span className="interior-metric-pill">
              <strong>Items:</strong> {roomFurniture.length}
            </span>
            <span
              className={`interior-metric-pill rating-${clearanceAnalysis?.circulationRating}`}
              title={`${clearanceAnalysis?.freeSpacePercent}% of floor space is open for walking`}
            >
              <strong>Walkway Space:</strong> {clearanceAnalysis?.freeSpacePercent}% ({clearanceAnalysis?.circulationRating})
            </span>
          </div>
        </div>

        {/* ── Main Two-Column Body ── */}
        <div className="interior-modal-body">
          {/* Left Column: Navigation Tabs & Furniture Catalog */}
          <div className="interior-catalog-pane">
            <div className="interior-tabs">
              <button
                type="button"
                className={`interior-tab${activeTab === "furniture" ? " active" : ""}`}
                onClick={() => setActiveTab("furniture")}
              >
                <Box size={14} style={{ marginRight: 6 }} /> Furniture Library
              </button>
              <button
                type="button"
                className={`interior-tab${activeTab === "style" ? " active" : ""}`}
                onClick={() => setActiveTab("style")}
              >
                <Palette size={14} style={{ marginRight: 6 }} /> Room Finishes & Style
              </button>
              <button
                type="button"
                className={`interior-tab${activeTab === "smart" ? " active" : ""}`}
                onClick={() => setActiveTab("smart")}
              >
                <Wand2 size={14} style={{ marginRight: 6 }} /> Smart Layout & Clearance
              </button>
            </div>

            {/* TAB 1: FURNITURE LIBRARY */}
            {activeTab === "furniture" && (
              <div className="interior-catalog-content">
                {/* Category filters */}
                <div className="interior-cat-pills">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "bedroom", label: "Bedroom" },
                      { id: "living_room", label: "Living" },
                      { id: "kitchen", label: "Kitchen" },
                      { id: "bathroom", label: "Bathroom" },
                      { id: "dining_room", label: "Dining" },
                      { id: "other", label: "Decor & Office" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`interior-cat-btn${categoryFilter === cat.id ? " active" : ""}`}
                      onClick={() => setCategoryFilter(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Catalog Grid */}
                <div className="interior-grid">
                  {catalogList.map((item) => (
                    <div key={item.type} className="interior-card">
                      <div className="interior-card-head">
                        <span className="interior-card-title">{item.name}</span>
                        <span className="interior-card-dim">
                          {item.dimensions.width}×{item.dimensions.depth} {plan.units}
                        </span>
                      </div>
                      <p className="interior-card-desc">{item.description}</p>
                      <div className="interior-card-foot">
                        <span className="interior-card-mat">{item.materials.join(" · ")}</span>
                        <button
                          type="button"
                          className="button primary small"
                          onClick={() => handleAddFurniture(item)}
                          title={`Add ${item.name} into ${activeRoom.name}`}
                        >
                          <Plus size={12} style={{ marginRight: 4 }} /> Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ROOM FINISHES & STYLING */}
            {activeTab === "style" && (
              <div className="interior-style-content">
                {/* Wall Finishes */}
                <div className="interior-section">
                  <h4>Wall Color & Finish</h4>
                  <p className="interior-section-desc">Select designer paint colors and wall textures for {activeRoom.name}.</p>
                  <div className="interior-swatch-grid">
                    {WALL_FINISHES.map((wf) => {
                      const isSelected = currentInterior.wallColor === wf.color;
                      return (
                        <button
                          key={wf.id}
                          type="button"
                          className={`interior-swatch-card${isSelected ? " active" : ""}`}
                          onClick={() => updateRoomInterior({ wallColor: wf.color, wallFinish: wf.name })}
                        >
                          <span className="interior-color-circle" style={{ backgroundColor: wf.color }} />
                          <div className="interior-swatch-info">
                            <span className="interior-swatch-name">{wf.name}</span>
                            <span className="interior-swatch-sub">{wf.description}</span>
                          </div>
                          {isSelected && <Check size={14} className="interior-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Floor Materials */}
                <div className="interior-section">
                  <h4>Floor Material & Pattern</h4>
                  <p className="interior-section-desc">Choose luxury hardwoods, Italian marble, honed terrazzo, or tile.</p>
                  <div className="interior-swatch-grid">
                    {FLOOR_MATERIALS.map((fm) => {
                      const isSelected = currentInterior.floorColor === fm.color;
                      return (
                        <button
                          key={fm.id}
                          type="button"
                          className={`interior-swatch-card${isSelected ? " active" : ""}`}
                          onClick={() => updateRoomInterior({ floorColor: fm.color, floorMaterial: fm.name })}
                        >
                          <span className="interior-color-circle" style={{ backgroundColor: fm.color }} />
                          <div className="interior-swatch-info">
                            <span className="interior-swatch-name">{fm.name}</span>
                            <span className="interior-swatch-sub">{fm.description}</span>
                          </div>
                          {isSelected && <Check size={14} className="interior-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ceiling Design */}
                <div className="interior-section">
                  <h4>Ceiling Design</h4>
                  <div className="interior-swatch-grid">
                    {CEILING_STYLES.map((cs) => {
                      const isSelected = currentInterior.ceilingStyle === cs.name;
                      return (
                        <button
                          key={cs.id}
                          type="button"
                          className={`interior-swatch-card${isSelected ? " active" : ""}`}
                          onClick={() => updateRoomInterior({ ceilingStyle: cs.name })}
                        >
                          <div className="interior-swatch-info">
                            <span className="interior-swatch-name">{cs.name}</span>
                            <span className="interior-swatch-sub">{cs.description}</span>
                          </div>
                          {isSelected && <Check size={14} className="interior-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lighting Ambiance */}
                <div className="interior-section">
                  <h4>Lighting & Ambiance</h4>
                  <div className="interior-swatch-grid">
                    {LIGHTING_OPTIONS.map((lo) => {
                      const isSelected = currentInterior.lightingColor === lo.color;
                      return (
                        <button
                          key={lo.id}
                          type="button"
                          className={`interior-swatch-card${isSelected ? " active" : ""}`}
                          onClick={() => updateRoomInterior({ lightingType: lo.name, lightingColor: lo.color })}
                        >
                          <span className="interior-color-circle" style={{ backgroundColor: lo.color, border: "1px solid #CCC" }} />
                          <div className="interior-swatch-info">
                            <span className="interior-swatch-name">{lo.name}</span>
                            <span className="interior-swatch-sub">{lo.description}</span>
                          </div>
                          {isSelected && <Check size={14} className="interior-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SMART AUTO-FURNISH & CLEARANCE */}
            {activeTab === "smart" && (
              <div className="interior-smart-content">
                <div className="interior-smart-hero">
                  <div className="interior-smart-icon">
                    <Sparkles size={24} style={{ color: "#7B68EE" }} />
                  </div>
                  <div>
                    <h3>Smart AI Room Staging</h3>
                    <p>
                      Automatically place a coordinated, dimensionally verified set of furniture optimized for this{" "}
                      <strong>{activeRoom.type.replace("_", " ")}</strong>.
                    </p>
                  </div>
                  <button type="button" className="button primary" onClick={handleAutoFurnish}>
                    <Wand2 size={13} style={{ marginRight: 6 }} /> Auto-Furnish Room
                  </button>
                </div>

                <div className="interior-section">
                  <h4>Walkway & Door Clearance Health</h4>
                  {clearanceAnalysis && clearanceAnalysis.warnings.length === 0 ? (
                    <div className="interior-health-ok">
                      <Check size={18} style={{ color: "#2E7D32", marginRight: 8 }} />
                      <span>
                        <strong>All clearances satisfied!</strong> All furniture pieces fit within room walls with ample walkway space ({clearanceAnalysis.freeSpacePercent}% free).
                      </span>
                    </div>
                  ) : (
                    <div className="interior-health-warnings">
                      {clearanceAnalysis?.warnings.map((w, idx) => (
                        <div key={idx} className="interior-warning-item">
                          <AlertTriangle size={15} style={{ color: "#D97706", flexShrink: 0, marginTop: 2 }} />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="interior-section">
                  <h4>Quick Room Actions</h4>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="button" onClick={handleAutoFurnish}>
                      <RefreshCw size={13} style={{ marginRight: 6 }} /> Reset with Smart Layout
                    </button>
                    <button type="button" className="button danger" onClick={handleClearRoom}>
                      <Trash2 size={13} style={{ marginRight: 6 }} /> Clear All Furniture
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Room's Placed Furniture & Selected Item Inspector */}
          <div className="interior-inspector-pane">
            <div className="interior-inspector-head">
              <h3>Placed Objects ({roomFurniture.length})</h3>
              {roomFurniture.length > 0 && (
                <button type="button" className="interior-text-btn" onClick={handleClearRoom}>
                  Clear all
                </button>
              )}
            </div>

            {/* List of placed furniture items */}
            <div className="interior-items-list">
              {roomFurniture.length === 0 ? (
                <div className="interior-empty-room">
                  <Box size={32} style={{ color: "#9E9E9E", marginBottom: 8 }} />
                  <p>No furniture in this room yet.</p>
                  <button type="button" className="button small primary" onClick={handleAutoFurnish} style={{ marginTop: 8 }}>
                    <Wand2 size={12} style={{ marginRight: 4 }} /> Auto-Furnish Now
                  </button>
                </div>
              ) : (
                roomFurniture.map((item) => {
                  const isSelected = selectedFurnitureId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`interior-item-row${isSelected ? " active" : ""}`}
                      onClick={() => setSelectedFurnitureId(item.id)}
                    >
                      <div className="interior-item-info">
                        <span className="interior-item-name">{item.name}</span>
                        <span className="interior-item-pos">
                          Pos: ({item.position[0].toFixed(1)}, {item.position[1].toFixed(1)}) · Rot: {Math.round((item.rotation * 180) / Math.PI)}°
                        </span>
                      </div>

                      <div className="interior-item-actions">
                        <button
                          type="button"
                          className="interior-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotate90(item);
                          }}
                          title="Rotate 90 degrees"
                        >
                          <RotateCw size={12} />
                        </button>
                        <button
                          type="button"
                          className="interior-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateItem(item);
                          }}
                          title="Duplicate item"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          className="interior-mini-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          title="Delete item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Item Detail Inspector */}
            {selectedFurniture && (
              <div className="interior-detail-inspector">
                <h4>Edit Object: {selectedFurniture.name}</h4>

                {/* Transform controls */}
                <div className="interior-field-group">
                  <label>Position X ({plan.units})</label>
                  <div className="interior-num-control">
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(selectedFurniture.id, { position: [selectedFurniture.position[0] - 0.5, selectedFurniture.position[1], 0] })}
                    >
                      -
                    </button>
                    <span>{selectedFurniture.position[0].toFixed(1)}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(selectedFurniture.id, { position: [selectedFurniture.position[0] + 0.5, selectedFurniture.position[1], 0] })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="interior-field-group">
                  <label>Position Y ({plan.units})</label>
                  <div className="interior-num-control">
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(selectedFurniture.id, { position: [selectedFurniture.position[0], selectedFurniture.position[1] - 0.5, 0] })}
                    >
                      -
                    </button>
                    <span>{selectedFurniture.position[1].toFixed(1)}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(selectedFurniture.id, { position: [selectedFurniture.position[0], selectedFurniture.position[1] + 0.5, 0] })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="interior-field-group">
                  <label>Rotation Angle</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="range"
                      min="0"
                      max={Math.PI * 2}
                      step={Math.PI / 12}
                      value={selectedFurniture.rotation}
                      onChange={(e) => handleUpdateItem(selectedFurniture.id, { rotation: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, minWidth: 36 }}>
                      {Math.round((selectedFurniture.rotation * 180) / Math.PI)}°
                    </span>
                    <button
                      type="button"
                      className="button outline small"
                      onClick={() => handleRotate90(selectedFurniture)}
                      title="Quick rotate 90°"
                    >
                      <RotateCw size={12} />
                    </button>
                  </div>
                </div>

                {/* Material color swatch */}
                <div className="interior-field-group">
                  <label>Material Color</label>
                  <div className="interior-color-picker-row">
                    {[
                      "#3E342F", // dark wood
                      "#6B584D", // warm walnut
                      "#D7B58A", // oak
                      "#394350", // slate navy
                      "#586273", // denim
                      "#C27854", // terracotta
                      "#3B693A", // botanical green
                      "#E8E4DD", // ivory linen
                      "#25272A", // graphite
                    ].map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={`interior-color-dot${selectedFurniture.material?.color === col ? " active" : ""}`}
                        style={{ backgroundColor: col }}
                        onClick={() =>
                          handleUpdateItem(selectedFurniture.id, {
                            material: { ...(selectedFurniture.material || {}), color: col },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* Resizing controls */}
                <div className="interior-field-group">
                  <label>Dimensions ({plan.units})</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: "#888" }}>Width</span>
                      <input
                        className="field"
                        type="number"
                        step="0.2"
                        value={selectedFurniture.dimensions.width}
                        onChange={(e) =>
                          handleUpdateItem(selectedFurniture.id, {
                            dimensions: { ...selectedFurniture.dimensions, width: Math.max(0.5, Number(e.target.value) || 1) },
                          })
                        }
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#888" }}>Depth</span>
                      <input
                        className="field"
                        type="number"
                        step="0.2"
                        value={selectedFurniture.dimensions.depth}
                        onChange={(e) =>
                          handleUpdateItem(selectedFurniture.id, {
                            dimensions: { ...selectedFurniture.dimensions, depth: Math.max(0.5, Number(e.target.value) || 1) },
                          })
                        }
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#888" }}>Height</span>
                      <input
                        className="field"
                        type="number"
                        step="0.2"
                        value={selectedFurniture.dimensions.height}
                        onChange={(e) =>
                          handleUpdateItem(selectedFurniture.id, {
                            dimensions: { ...selectedFurniture.dimensions, height: Math.max(0.5, Number(e.target.value) || 1) },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="button"
                    style={{ flex: 1 }}
                    onClick={() => handleDuplicateItem(selectedFurniture)}
                  >
                    <Copy size={12} style={{ marginRight: 4 }} /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => handleDeleteItem(selectedFurniture.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
