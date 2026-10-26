"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, LifeBuoy, LogOut, MonitorSmartphone, Settings, UserCircle } from "lucide-react";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { ThemeSwitch } from "@/components/theme/ThemeProvider";
import { useAuth } from "./AuthProvider";

/** Avatar button that opens the signed-in account's menu. */
export function AccountMenu() {
  const { user, signOut, signOutEverywhere } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"out" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const label = user.displayName?.trim() || user.email.split("@")[0];
  const initial = label.charAt(0).toUpperCase();

  const run = async (kind: "out" | "all") => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === "out" ? signOut() : signOutEverywhere());
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(null);
    }
  };

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="avatar avatar-small account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        title={user.email}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>

      {open && (
        <div className="account-popover" role="menu" aria-label="Account">
          <p className="account-section">Account</p>
          <Link href="/account" role="menuitem" className="account-who" onClick={() => setOpen(false)} autoFocus>
            <span className="avatar avatar-small account-who-avatar" aria-hidden="true">{initial}</span>
            <div>
              <strong>{label}</strong>
              <small>{user.email}</small>
            </div>
            <ChevronRight size={16} className="account-chev" />
          </Link>

          <div className="account-group">
            <Link href="/account" role="menuitem" className="account-item" onClick={() => setOpen(false)}>
              <UserCircle size={17} /> Your account
            </Link>
            <Link href="/account#preferences" role="menuitem" className="account-item" onClick={() => setOpen(false)}>
              <Settings size={17} /> Settings
            </Link>
            <button type="button" role="menuitem" className="account-item" onClick={() => { setOpen(false); setFeedbackOpen(true); }}>
              <LifeBuoy size={17} /> Help and feedback
            </button>
          </div>

          <div className="account-group account-theme">
            <span className="account-theme-label">Theme</span>
            <ThemeSwitch />
          </div>

          <div className="account-group">
            {error && <p className="account-error" role="alert">{error}</p>}
            <button type="button" role="menuitem" className="account-item" onClick={() => run("out")} disabled={busy !== null}>
              <LogOut size={17} /> {busy === "out" ? "Signing out…" : "Sign out"}
            </button>
            <button type="button" role="menuitem" className="account-item" onClick={() => run("all")} disabled={busy !== null}>
              <MonitorSmartphone size={17} /> {busy === "all" ? "Signing out…" : "Sign out of all devices"}
            </button>
          </div>
        </div>
      )}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
