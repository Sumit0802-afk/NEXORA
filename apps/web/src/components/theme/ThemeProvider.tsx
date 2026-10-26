"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "nexora.theme";

/** Runs in <head> before first paint so the page never flashes the wrong theme. Keep in sync with resolve(). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"light";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref;
}

function readPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

type ThemeState = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>("light");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Pick up the saved choice after hydration (the init script has already painted the right theme).
  useEffect(() => {
    const p = readPreference();
    setPref(p);
    setResolved(resolve(p));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  // "System" follows the operating system while the page is open.
  useEffect(() => {
    if (preference !== "system") return;
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setResolved(q.matches ? "dark" : "light");
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [preference]);

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      const p = readPreference();
      setPref(p);
      setResolved(resolve(p));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* private mode: the choice applies for this visit only */
    }
    setPref(p);
    setResolved(resolve(p));
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Three-way Light / Dark / System switch. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className={`theme-switch ${className}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={preference === id}
          className={preference === id ? "active" : ""}
          onClick={() => setPreference(id)}
          title={label}
        >
          <Icon size={15} /> <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Single round button that flips between light and dark (used where there is little room, e.g. sign-in). */
export function ThemeIconButton({ className = "" }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={`theme-icon-btn ${className}`}
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {resolved === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
