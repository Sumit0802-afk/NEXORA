"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Shield,
  KeyRound,
  MessageSquare,
  Bug,
  Lightbulb,
  FileText,
  Building2,
  Star,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  Search,
  Filter,
  Activity,
  Layers,
} from "lucide-react";
import {
  getStoredFeedback,
  updateFeedbackStatus,
  clearAllFeedback,
  getTelemetryEvents,
  NEXORA_VERSION,
  type UserFeedback,
  type TelemetryEvent,
} from "@/lib/telemetry";

export default function AdminFeedbackDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState(false);

  const [feedbackList, setFeedbackList] = useState<UserFeedback[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"feedback" | "telemetry">("feedback");

  const loadData = () => {
    setFeedbackList(getStoredFeedback());
    setTelemetryEvents(getTelemetryEvents());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple admin passkey for development/beta protection
    if (passkeyInput === "nexora2026" || passkeyInput === "admin" || passkeyInput === "beta") {
      setIsUnlocked(true);
      setPasskeyError(false);
    } else {
      setPasskeyError(true);
    }
  };

  const handleStatusChange = (id: string, newStatus: "new" | "reviewed" | "resolved") => {
    updateFeedbackStatus(id, newStatus);
    loadData();
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all feedback submissions? This cannot be undone.")) {
      clearAllFeedback();
      loadData();
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify({ feedback: feedbackList, telemetry: telemetryEvents }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexora-beta-feedback-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered feedback
  const filteredFeedback = feedbackList.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        (item.email && item.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const avgRating =
    feedbackList.length > 0
      ? (feedbackList.reduce((acc, f) => acc + (f.rating || 5), 0) / feedbackList.length).toFixed(1)
      : "5.0";

  return (
    <main className="app-shell min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <header className="px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition text-xs font-semibold">
            <ArrowLeft size={16} /> Back to Studio
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-600" />
            <h1 className="text-sm font-bold">NEXORA Beta Telemetry & Feedback Administration</h1>
            <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
              {NEXORA_VERSION}
            </span>
          </div>
        </div>

        {isUnlocked && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1.5"
            >
              <Download size={13} /> Export Data
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {!isUnlocked ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 mx-auto flex items-center justify-center">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Protected Beta Admin Panel</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Enter your administrative developer passkey to view user bug reports, feedback, and telemetry logs.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-3">
              <input
                type="password"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                placeholder="Passkey (default: nexora2026)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                autoFocus
              />
              {passkeyError && (
                <div className="text-[11px] text-rose-600 font-semibold">
                  Incorrect passkey. (Hint: use &quot;nexora2026&quot; or &quot;beta&quot;)
                </div>
              )}
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
              >
                Unlock Dashboard
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">Total Submissions</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">{feedbackList.length}</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {feedbackList.filter((f) => f.status === "new").length} pending review
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">Average Rating</div>
              <div className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1.5">
                <Star size={20} className="fill-amber-400 text-amber-400" />
                {avgRating} <span className="text-xs font-normal text-zinc-400">/ 5.0</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Across all categories</div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">Reported Bugs</div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {feedbackList.filter((f) => f.category === "bug").length}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Requires bug triage</div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">Recorded Events</div>
              <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200 mt-1">
                {telemetryEvents.length}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Anonymous telemetry points</div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("feedback")}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "feedback"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <MessageSquare size={14} /> User Feedback & Bug Submissions ({filteredFeedback.length})
            </button>
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "telemetry"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Activity size={14} /> Telemetry Activity Log ({telemetryEvents.length})
            </button>
          </div>

          {activeTab === "feedback" ? (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-sm bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Search size={14} className="text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, message, or email..."
                    className="bg-transparent border-none outline-none text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-medium">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  >
                    <option value="all">All Categories</option>
                    <option value="bug">Bug Reports</option>
                    <option value="feature">Feature Ideas</option>
                    <option value="drawing_export">Drawing / PDF</option>
                    <option value="structural">Structural</option>
                    <option value="general">General</option>
                  </select>

                  <span className="text-zinc-400 font-medium ml-2">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Submissions List */}
              <div className="space-y-3">
                {filteredFeedback.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.category === "bug"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : item.category === "feature"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {item.category}
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex text-amber-400">
                          {Array.from({ length: item.rating }).map((_, i) => (
                            <Star key={i} size={12} className="fill-amber-400" />
                          ))}
                        </div>
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : item.status === "reviewed"
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-zinc-100 text-zinc-700 border-zinc-300"
                          }`}
                        >
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                      {item.message}
                    </p>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                      <div>
                        {item.email && <span className="font-medium text-zinc-600 dark:text-zinc-300 mr-3">Contact: {item.email}</span>}
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>

                      {item.diagnostics && (
                        <div className="font-mono text-[10px] bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">
                          {item.diagnostics.screenResolution} · {item.diagnostics.roomCount ?? 0} rooms · {item.diagnostics.appVersion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {filteredFeedback.length === 0 && (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    No feedback entries found matching current filter.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TELEMETRY EVENTS TAB */
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                    <th className="py-2.5 px-4">Event</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Properties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {telemetryEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {evt.name}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                        {evt.properties ? JSON.stringify(evt.properties) : "—"}
                      </td>
                    </tr>
                  ))}
                  {telemetryEvents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-400">
                        No telemetry events recorded in current browser session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
