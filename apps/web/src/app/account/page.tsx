"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { ApiError, changePassword } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDefaultUnits, setDefaultUnits, type Units } from "@/lib/preferences";
import { ThemeSwitch } from "@/components/theme/ThemeProvider";

type Notice = { kind: "ok" | "error"; text: string } | null;

function Message({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className={notice.kind === "ok" ? "auth-success" : "auth-error"} role={notice.kind === "ok" ? "status" : "alert"}>
      {notice.text}
    </div>
  );
}

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong. Please try again.");

export default function AccountPage() {
  const { user, updateName, signOutEverywhere, removeAccount } = useAuth();

  // Profile
  const [name, setName] = useState(user?.displayName ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  // Password
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<Notice>(null);

  // Preferences
  const [units, setUnits] = useState<Units>("ft");
  useEffect(() => setUnits(getDefaultUnits()), []);

  // Security / danger
  const [everywhereBusy, setEverywhereBusy] = useState(false);
  const [securityNotice, setSecurityNotice] = useState<Notice>(null);
  const [confirmPw, setConfirmPw] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null);

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      await updateName(name.trim());
      setProfileNotice({ kind: "ok", text: "Your name has been saved." });
    } catch (err) {
      setProfileNotice({ kind: "error", text: errorText(err) });
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNotice(null);
    if (!current) return setPwNotice({ kind: "error", text: "Enter your current password." });
    if (next.length < 8) return setPwNotice({ kind: "error", text: "Use at least 8 characters for the new password." });
    setPwBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setPwNotice({ kind: "ok", text: "Password updated. Your other devices have been signed out." });
    } catch (err) {
      setPwNotice({ kind: "error", text: errorText(err) });
    } finally {
      setPwBusy(false);
    }
  };

  const chooseUnits = (u: Units) => {
    setUnits(u);
    setDefaultUnits(u);
  };

  const everywhere = async () => {
    setEverywhereBusy(true);
    setSecurityNotice(null);
    try {
      await signOutEverywhere();
    } catch (err) {
      setSecurityNotice({ kind: "error", text: errorText(err) });
      setEverywhereBusy(false);
    }
  };

  const del = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteNotice(null);
    setDeleteBusy(true);
    try {
      await removeAccount(confirmPw);
    } catch (err) {
      setDeleteNotice({ kind: "error", text: errorText(err) });
      setDeleteBusy(false);
    }
  };

  const since = user.createdAt ? new Date(user.createdAt + (user.createdAt.endsWith("Z") ? "" : "Z")).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
  const initial = (user.displayName?.trim() || user.email).charAt(0).toUpperCase();

  return (
    <main className="acct-page">
      <header className="acct-top">
        <Link href="/" className="acct-back"><ArrowLeft size={16} /> Back to workspace</Link>
        <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="acct-wordmark" priority />
      </header>

      <div className="acct-wrap">
        <div className="acct-hero">
          <span className="avatar acct-avatar" aria-hidden="true">{initial}</span>
          <div>
            <h1>{user.displayName?.trim() || user.email.split("@")[0]}</h1>
            <p>{user.email}{since ? ` · Member since ${since}` : ""}</p>
          </div>
        </div>

        <section className="acct-card" aria-labelledby="acct-profile">
          <h2 id="acct-profile">Profile</h2>
          <form onSubmit={saveProfile} noValidate>
            <div className="auth-field">
              <label htmlFor="acct-name">Name</label>
              <input id="acct-name" className="auth-input" type="text" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="acct-email">Email</label>
              <input id="acct-email" className="auth-input" type="email" value={user.email} readOnly aria-describedby="acct-email-note" />
              <p id="acct-email-note" className="auth-hint">Your email is your sign-in and can&apos;t be changed here.</p>
            </div>
            <Message notice={profileNotice} />
            <button className="auth-submit acct-btn" type="submit" disabled={profileBusy || name.trim() === (user.displayName ?? "")}>
              {profileBusy ? "Saving…" : "Save name"}
            </button>
          </form>
        </section>

        <section className="acct-card" aria-labelledby="acct-password">
          <h2 id="acct-password">Password</h2>
          <form onSubmit={savePassword} noValidate>
            <div className="auth-field">
              <label htmlFor="acct-current">Current password</label>
              <input id="acct-current" className="auth-input" type={showPw ? "text" : "password"} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="acct-new">New password</label>
              <div className="auth-password">
                <input id="acct-new" className="auth-input" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={next} onChange={(e) => setNext(e.target.value)} />
                <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide passwords" : "Show passwords"} aria-pressed={showPw}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <Message notice={pwNotice} />
            <button className="auth-submit acct-btn" type="submit" disabled={pwBusy}>{pwBusy ? "Updating…" : "Update password"}</button>
          </form>
        </section>

        <section className="acct-card" id="preferences" aria-labelledby="acct-prefs">
          <h2 id="acct-prefs">Preferences</h2>
          <p className="acct-note">Appearance. Saved in this browser.</p>
          <ThemeSwitch className="acct-theme" />
          <p className="acct-note acct-note-gap">Default unit for new designs.</p>
          <div className="acct-seg" role="radiogroup" aria-label="Default units">
            {(["ft", "m"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={units === u} className={units === u ? "active" : ""} onClick={() => chooseUnits(u)}>
                {u === "ft" ? "Feet" : "Meters"}
              </button>
            ))}
          </div>
        </section>

        <section className="acct-card" aria-labelledby="acct-security">
          <h2 id="acct-security">Security</h2>
          <p className="acct-note">Sign out of NEXORA on every phone and computer, including this one.</p>
          <Message notice={securityNotice} />
          <button type="button" className="auth-switch acct-btn" onClick={everywhere} disabled={everywhereBusy}>
            {everywhereBusy ? "Signing out…" : "Sign out of all devices"}
          </button>
        </section>

        <section className="acct-card acct-danger" aria-labelledby="acct-delete">
          <h2 id="acct-delete">Delete account</h2>
          <p className="acct-note">This permanently deletes your account and all of your projects and saved versions. It cannot be undone.</p>
          <form onSubmit={del} noValidate>
            <div className="auth-field">
              <label htmlFor="acct-del-pw">Your password</label>
              <input id="acct-del-pw" className="auth-input" type="password" autoComplete="current-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="acct-del-text">Type <strong>DELETE</strong> to confirm</label>
              <input id="acct-del-text" className="auth-input" type="text" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <Message notice={deleteNotice} />
            <button className="acct-btn acct-delete-btn" type="submit" disabled={deleteBusy || !confirmPw || confirmText !== "DELETE"}>
              {deleteBusy ? "Deleting…" : "Delete my account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
