"use client";

import { X, Sparkles, CheckCircle2, ShieldAlert, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { NEXORA_VERSION } from "@/lib/telemetry";

export interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VersionModal({ isOpen, onClose }: VersionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ zIndex: 9999 }}>
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">NEXORA Studio</h2>
                <span className="text-[11px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                  {NEXORA_VERSION}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Architectural Floor Plan & 3D Building Studio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Changelog */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Release Highlights */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Latest Beta Release Highlights
            </h4>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5">
              <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={14} /> Step 10: Professional Drawing Sheets
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Generate dimensioned floor plans, 4-facade building elevations (Front, Rear, Left, Right), cross-sections (Section A-A & B-B), and door/window finish schedules with printable multi-page architectural PDFs.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5">
              <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={14} /> Step 11: Structural Planning & Alignment
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Automated load-bearing column grids, primary beams, foundation footings, and multi-floor vertical alignment audits to identify unsupported upper columns and excessive beam spans.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5">
              <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={14} /> Step 12: Production Quality & Synchronization
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Real-time 2D/3D synchronized state updates, genuine binary GLB and Wavefront OBJ exports, high-res 3000px PNG rasterization, and comprehensive automated test suites.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5">
              <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={14} /> Step 13: Beta Feedback & Telemetry
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Integrated feedback and bug reporting modal with rating, crash recovery error boundaries, and a protected administration telemetry dashboard.
              </p>
            </div>
          </div>

          {/* Legal / Engineering Disclaimer */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
            <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Disclaimer:</strong> NEXORA Studio provides architectural design and conceptual coordination aids. All drawings, structural calculations, and building layouts must be reviewed and certified by a licensed professional architect or structural engineer prior to construction.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs">
          <Link
            href="/admin/feedback"
            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
          >
            Admin Dashboard <ArrowRight size={12} />
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
