"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, MessageSquare } from "lucide-react";
import { submitUserFeedback, captureDiagnostics } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

export class StudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reported: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("NEXORA Studio Viewport Error:", error, errorInfo);
  }

  handleReport = async () => {
    if (!this.state.error) return;
    try {
      await submitUserFeedback({
        category: "bug",
        rating: 1,
        title: `Automatic Crash Report: ${this.state.error.name || "Runtime Error"}`,
        message: `${this.state.error.message}\n\nStack:\n${this.state.error.stack || "N/A"}`,
        diagnostics: captureDiagnostics(),
      });
      this.setState({ reported: true });
    } catch {
      // ignore
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, reported: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
          <div className="max-w-md space-y-3.5">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {this.props.fallbackTitle || "Studio Viewport Recovery"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {this.state.error?.message || "An unexpected rendering error occurred in the active viewport."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition"
              >
                <RotateCcw size={13} /> Reload Viewport
              </button>

              <button
                onClick={this.handleReport}
                disabled={this.state.reported}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
              >
                {this.state.reported ? "Report Sent" : "Report Bug"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
