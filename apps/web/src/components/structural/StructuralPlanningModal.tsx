"use client";

import { useMemo, useState } from "react";
import {
  X,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Info,
  RotateCcw,
  Plus,
  Trash2,
  Building2,
  ArrowRight,
  Download,
} from "lucide-react";
import type { FloorPlan, Column, Beam } from "@houseplan/design-schema";
import {
  generateOptimalStructuralGrid,
  auditStructuralSystem,
  STRUCTURAL_DISCLAIMER,
  type StructuralReport,
  type StructuralAlignmentWarning,
} from "@/lib/structural";
import { floorName } from "@/lib/floors";

export interface StructuralPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: FloorPlan;
  onUpdatePlan: (updatedPlan: FloorPlan) => void;
}

export function StructuralPlanningModal({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
}: StructuralPlanningModalProps) {
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "columns" | "audit">("overview");

  const report: StructuralReport = useMemo(() => {
    return auditStructuralSystem(plan);
  }, [plan]);

  if (!isOpen) return null;

  const currentLevel = plan.levels[selectedLevelIndex] || plan.levels[0];
  const columns = (currentLevel.columns || []) as Column[];
  const beams = (currentLevel.beams || []) as Beam[];
  const units = plan.units || "ft";

  const handleAutoGenerate = () => {
    const updated = generateOptimalStructuralGrid(plan);
    onUpdatePlan(updated);
  };

  const handleClearStructure = () => {
    const cleared = {
      ...plan,
      levels: plan.levels.map((lvl) => ({
        ...lvl,
        columns: [],
        beams: [],
        foundations: [],
      })),
    };
    onUpdatePlan(cleared);
  };

  const handleDeleteColumn = (colId: string) => {
    const updated = {
      ...plan,
      levels: plan.levels.map((lvl, idx) =>
        idx === selectedLevelIndex
          ? {
              ...lvl,
              columns: (lvl.columns || []).filter((c) => c.id !== colId),
            }
          : lvl
      ),
    };
    onUpdatePlan(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }}>
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Structural Planning & Column Alignment
                <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                  Preliminary
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Plan load-bearing column grids, tie beams, and multi-floor vertical alignment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Disclaimer Alert */}
        <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span className="leading-relaxed">
            <strong>Preliminary Architectural Planning Aid:</strong> All structural elements (column sizes, beam depths, foundations) are conceptual estimates for spatial coordination. A certified structural engineer must perform engineering load calculations and foundation designs before construction.
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 pt-3 gap-6 bg-white dark:bg-zinc-900">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Layers size={16} />
            <span>Structural Overview & Stats</span>
          </button>
          <button
            onClick={() => setActiveTab("columns")}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === "columns"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Building2 size={16} />
            <span>Column Grid & Beams</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <AlertTriangle size={16} />
            <span>Alignment & Safety Audit ({report.warnings.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    Smart Column Grid Generator
                  </h4>
                  <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
                    Automatically aligns columns across room corners, wall intersections, and divides long spans.
                  </p>
                </div>
                <div className="flex gap-2">
                  {report.totalColumns > 0 && (
                    <button
                      onClick={handleClearStructure}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 text-rose-600 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 transition"
                    >
                      Clear Structure
                    </button>
                  )}
                  <button
                    onClick={handleAutoGenerate}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition flex items-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    {report.totalColumns > 0 ? "Regenerate Grid" : "Generate Column Grid"}
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Columns</div>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {report.totalColumns}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Across {plan.levels.length} floors</div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Max Beam Span</div>
                  <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200 mt-1">
                    {report.maxBeamSpan > 0 ? `${report.maxBeamSpan.toFixed(1)} ${units}` : "—"}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Recommended max &lt; 18 {units}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Beams</div>
                  <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200 mt-1">
                    {report.totalBeams}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Primary & plinth ties</div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Vertical Alignment</div>
                  <div className="text-2xl font-black mt-1 flex items-center gap-1.5">
                    {report.isAligned ? (
                      <span className="text-emerald-600 text-lg font-bold flex items-center gap-1">
                        <CheckCircle2 size={18} /> Aligned
                      </span>
                    ) : (
                      <span className="text-rose-600 text-lg font-bold flex items-center gap-1">
                        <AlertTriangle size={18} /> Warning
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Continuous column stacks</div>
                </div>
              </div>

              {/* Multi-Floor Alignment Status Card */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Structural System Health
                </h4>
                {report.warnings.length === 0 ? (
                  <div className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 size={18} />
                    All columns align vertically without floating cantilevers, and all beam spans satisfy preliminary residential deflection limits.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {report.warnings.slice(0, 3).map((w) => (
                      <div
                        key={w.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                          w.severity === "error"
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200"
                            : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200"
                        }`}
                      >
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <div>
                          <strong>{w.message}:</strong> {w.details}
                        </div>
                      </div>
                    ))}
                    {report.warnings.length > 3 && (
                      <button
                        onClick={() => setActiveTab("audit")}
                        className="text-xs font-semibold text-indigo-600 hover:underline pt-1 inline-block"
                      >
                        View all {report.warnings.length} warnings in the Audit tab →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COLUMNS & BEAMS LIST */}
          {activeTab === "columns" && (
            <div className="space-y-4">
              {/* Floor Level Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">Select Floor:</span>
                {plan.levels.map((lvl, idx) => (
                  <button
                    key={lvl.id}
                    onClick={() => setSelectedLevelIndex(idx)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                      selectedLevelIndex === idx
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {floorName(idx)} ({((lvl.columns || []) as Column[]).length} cols)
                  </button>
                ))}
              </div>

              {/* Column Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                      <th className="py-2.5 px-3">Column ID</th>
                      <th className="py-2.5 px-3">Position (X, Y)</th>
                      <th className="py-2.5 px-3">Dimensions</th>
                      <th className="py-2.5 px-3">Material</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {columns.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">{c.id}</td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300">
                          ({c.position[0].toFixed(1)}, {c.position[1].toFixed(1)}) {units}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300">
                          {c.width} × {c.depth} {units}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500">Reinforced Concrete</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDeleteColumn(c.id)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete column"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {columns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-400">
                          No columns on {floorName(selectedLevelIndex)}. Click &ldquo;Generate Column Grid&rdquo; above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT & WARNINGS */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-500">
                Architectural structural rules-of-thumb evaluate vertical continuous load paths, maximum recommended residential beam spans, and footing adequacy.
              </div>

              {report.warnings.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-600" />
                  <div className="text-sm font-bold">Structural System Checks Passed</div>
                  <p className="text-xs mt-1 text-emerald-700/80">
                    No unsupported columns or excessive beam spans detected across any floor levels.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {report.warnings.map((w) => (
                    <div
                      key={w.id}
                      className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                        w.severity === "error"
                          ? "bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900"
                          : "bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900"
                      }`}
                    >
                      <AlertTriangle
                        size={16}
                        className={`shrink-0 mt-0.5 ${w.severity === "error" ? "text-rose-600" : "text-amber-600"}`}
                      />
                      <div>
                        <div className="font-bold">{w.message}</div>
                        <div className="mt-0.5 text-zinc-700 dark:text-zinc-300">{w.details}</div>
                        {w.location && (
                          <div className="mt-1 text-[11px] font-mono text-zinc-500">
                            Location: ({w.location[0].toFixed(1)}, {w.location[1].toFixed(1)}) {units} · Floor: {floorName(w.levelIndex)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-500">
          <div>
            Total: <strong>{report.totalColumns} Columns</strong> · <strong>{report.totalBeams} Beams</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
