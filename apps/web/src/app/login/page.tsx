"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, EMAIL_NOT_VERIFIED, forgotPassword, loginResend, resendCode, resetPassword } from "@/lib/api";
import { safeNext } from "@/lib/auth-redirect";
import { cleanCode, validateAuth, validateCode, validateReset, type AuthFieldErrors, type AuthMode, type ResetErrors } from "@/lib/auth-validation";
import { useAuth } from "@/components/auth/AuthProvider";
import { SwingHeading } from "@/components/auth/SwingHeading";
import { ThemeIconButton } from "@/components/theme/ThemeProvider";

const COPY: Record<AuthMode, { title: string; sub: string; submit: string; busy: string }> = {
  signin: { title: "Welcome back", sub: "Sign in to open your projects.", submit: "Sign in", busy: "Signing in…" },
  signup: { title: "Create your account", sub: "Save your designs and return to them anywhere.", submit: "Create account", busy: "Creating account…" },
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, signIn, completeSignIn, signUp, verify } = useAuth();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Email verification step: shown after sign-up, or after sign-in with an unverified account.
  const [step, setStep] = useState<"form" | "verify" | "forgot" | "reset">("form");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [pendingEmail, setPendingEmail] = useState("");
  // True when the code screen is the second step of signing in (as opposed to verifying a new account).
  const [signingIn, setSigningIn] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const startVerify = (addr: string, note: string) => {
    setPendingEmail(addr);
    setCode("");
    setCodeError(undefined);
    setFormError(null);
    setSuccess(note);
    setCooldown(60);
    setBusy(false);
    setStep("verify");
  };

  useEffect(() => {
    if (status === "signedIn" && !busy) router.replace(next);
  }, [status, busy, next, router]);

  const switchMode = (m: AuthMode) => {
    if (m === mode) return;
    // Email and password are kept so a mistyped tab does not cost the user their input.
    setMode(m);
    setFieldErrors({});
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors = validateAuth(mode, email, password);
    setFieldErrors(errors);
    setFormError(null);
    setSuccess(null);
    if (errors.email || errors.password) {
      document.getElementById(errors.email ? "auth-email" : "auth-password")?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        setSigningIn(true);
        startVerify(email.trim().toLowerCase(), "Password accepted. We emailed a 6-digit sign-in code.");
      } else {
        await signUp(email.trim(), password, name.trim() || undefined);
        setSigningIn(false);
        startVerify(email.trim().toLowerCase(), "We sent a 6-digit code to your email.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === EMAIL_NOT_VERIFIED) {
        setSigningIn(false);
        startVerify(email.trim().toLowerCase(), "Your email isn't verified yet. Enter the code we emailed you.");
        return;
      }
      setFormError(friendlyError(err));
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = validateCode(code);
    setCodeError(problem);
    setFormError(null);
    if (problem) {
      document.getElementById("auth-code")?.focus();
      return;
    }
    setBusy(true);
    try {
      if (signingIn) {
        await completeSignIn(pendingEmail, code);
        setSuccess("Signed in. Opening your workspace…");
        router.replace(next);
        return;
      }
      await verify(pendingEmail, code);
      // Account is ready; ask for a normal sign-in instead of logging the person straight in.
      setEmail(pendingEmail);
      setPassword("");
      setShowPassword(false);
      setMode("signin");
      setStep("form");
      setCode("");
      setFormError(null);
      setFieldErrors({});
      setSuccess("Your email is verified. Sign in to continue.");
      setBusy(false);
    } catch (err) {
      setFormError(friendlyError(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || cooldown > 0) return;
    setFormError(null);
    try {
      if (step === "reset") await forgotPassword(pendingEmail);
      else if (signingIn) await loginResend(pendingEmail);
      else await resendCode(pendingEmail);
      setSuccess("A new code is on its way.");
      setCode("");
      setCooldown(60);
    } catch (err) {
      setSuccess(null);
      setFormError(friendlyError(err));
      if (err instanceof ApiError && err.status === 429) setCooldown(60);
    }
  };

  const startForgot = () => {
    setStep("forgot");
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors = validateAuth("signin", email, "x");
    setFieldErrors({ email: errors.email });
    setFormError(null);
    if (errors.email) {
      document.getElementById("auth-email")?.focus();
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setPendingEmail(email.trim().toLowerCase());
      setCode("");
      setNewPassword("");
      setShowNew(false);
      setCodeError(undefined);
      setResetErrors({});
      setCooldown(60);
      setSuccess("If that email has an account, we sent a 6-digit code to it.");
      setBusy(false);
      setStep("reset");
    } catch (err) {
      setFormError(friendlyError(err));
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors = validateReset(code, newPassword);
    setResetErrors(errors);
    setFormError(null);
    if (errors.code || errors.password) {
      document.getElementById(errors.code ? "auth-code" : "auth-new-password")?.focus();
      return;
    }
    setBusy(true);
    try {
      await resetPassword(pendingEmail, code, newPassword);
      setEmail(pendingEmail);
      setPassword("");
      setShowPassword(false);
      setNewPassword("");
      setCode("");
      setMode("signin");
      setStep("form");
      setFieldErrors({});
      setSuccess("Password updated. Sign in with your new password.");
      setBusy(false);
    } catch (err) {
      setFormError(friendlyError(err));
      setBusy(false);
    }
  };

  const backToForm = () => {
    setSigningIn(false);
    setStep("form");
    setSuccess(null);
    setFormError(null);
    setCode("");
  };

  const copy = COPY[mode];

  // Pointer parallax for the photo/cube; written to CSS variables so React does not re-render on every move.
  const tilt = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--tilt-x", (x * 2).toFixed(3));
    e.currentTarget.style.setProperty("--tilt-y", (y * 2).toFixed(3));
  };
  const resetTilt = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--tilt-x", "0");
    e.currentTarget.style.setProperty("--tilt-y", "0");
  };

  const other: AuthMode = mode === "signin" ? "signup" : "signin";

  return (
    <main className="auth-page">
      <ThemeIconButton className="auth-theme-btn" />
      <div className="auth-bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
      </div>
      <div className="auth-card">
        <aside className="auth-brand" onPointerMove={tilt} onPointerLeave={resetTilt}>
          <Image className="auth-photo" src="/images/login-house.jpg" alt="" fill sizes="(max-width: 760px) 640px, 900px" quality={90} priority />
          <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="auth-wordmark" priority />
          <div className="auth-brand-copy">
            <p className="auth-welcome">Welcome to</p>
            <SwingHeading tag="h2">Design homes you can walk through.</SwingHeading>
            <p>Draw floor plans, furnish every room, and explore your design in 3D, all in one workspace.</p>
            <ul className="auth-points"><li>2D floor plans</li><li>3D walkthrough</li><li>Interior design</li></ul>
          </div>
          <svg className="auth-wave auth-wave-v" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M100 0 C58 10 84 26 50 42 C22 56 66 74 38 100 L100 100 Z" fill="#8B80DC" opacity="0.38" />
            <path d="M100 0 C66 12 90 28 60 44 C32 58 74 76 50 100 L100 100 Z" fill="#B3AAF0" opacity="0.5" />
            <path d="M100 0 C74 14 94 30 70 46 C44 62 82 78 64 100 L100 100 Z" fill="#fff" />
          </svg>
          <svg className="auth-wave auth-wave-h" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 6 C14 0 22 12 40 8 C58 4 70 14 100 6 L100 20 L0 20 Z" fill="#8B80DC" opacity="0.38" />
            <path d="M0 10 C16 4 26 15 44 11 C62 7 76 16 100 10 L100 20 L0 20 Z" fill="#B3AAF0" opacity="0.5" />
            <path d="M0 14 C18 9 30 18 48 15 C66 12 80 18 100 14 L100 20 L0 20 Z" fill="#fff" />
          </svg>
        </aside>

        <section className="auth-panel">
          {step === "verify" ? (
            <>
          <SwingHeading tag="h1">{signingIn ? "Confirm it’s you" : "Check your email"}</SwingHeading>
          <p className="auth-sub">
            Enter the 6-digit code we sent to <strong className="auth-email-strong">{pendingEmail}</strong>. It expires in 10 minutes.
          </p>

          <form key="verify" className="auth-form" id="auth-verify" onSubmit={submitCode} noValidate aria-label={signingIn ? "Confirm sign-in" : "Verify email"}>
            <div className="auth-field">
              <label htmlFor="auth-code">{signingIn ? "Sign-in code" : "Verification code"}</label>
              <input
                id="auth-code"
                className={`auth-input auth-code${codeError ? " invalid" : ""}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => { setCode(cleanCode(e.target.value)); if (codeError) setCodeError(undefined); }}
                aria-invalid={Boolean(codeError)}
                aria-describedby={codeError ? "auth-code-error" : undefined}
                autoFocus
              />
              {codeError && <p id="auth-code-error" className="auth-inline-error">{codeError}</p>}
            </div>

            <div className="auth-status" aria-live="polite">
              {formError && <div className="auth-error" role="alert">{formError}</div>}
              {success && !formError && <div className="auth-success" role="status">{success}</div>}
            </div>

            <div className="auth-actions">
              <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? <><span className="auth-spinner" aria-hidden="true" />Verifying…</> : signingIn ? "Sign in" : "Verify email"}
              </button>
              <button className="auth-switch" type="button" onClick={resend} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
            <button type="button" className="auth-link" onClick={backToForm} disabled={busy}>{signingIn ? "Back to sign in" : "Use a different email"}</button>
          </form>
            </>
          ) : step === "forgot" ? (
            <>
              <SwingHeading tag="h1">Reset your password</SwingHeading>
              <p className="auth-sub">Enter your account email and we will send you a 6-digit code to set a new password.</p>

              <form key="forgot" className="auth-form" id="auth-forgot" onSubmit={submitForgot} noValidate aria-label="Reset password">
                <div className="auth-field">
                  <label htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    className={`auth-input${fieldErrors.email ? " invalid" : ""}`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors({}); }}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                    autoFocus
                  />
                  {fieldErrors.email && <p id="auth-email-error" className="auth-inline-error">{fieldErrors.email}</p>}
                </div>

                <div className="auth-status" aria-live="polite">
                  {formError && <div className="auth-error" role="alert">{formError}</div>}
                </div>

                <div className="auth-actions">
                  <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
                    {busy ? <><span className="auth-spinner" aria-hidden="true" />Sending…</> : "Send code"}
                  </button>
                  <button className="auth-switch" type="button" onClick={backToForm} disabled={busy}>Back to sign in</button>
                </div>
              </form>
            </>
          ) : step === "reset" ? (
            <>
              <SwingHeading tag="h1">Set a new password</SwingHeading>
              <p className="auth-sub">
                Enter the 6-digit code sent to <strong className="auth-email-strong">{pendingEmail}</strong> and choose a new password.
              </p>

              <form key="reset" className="auth-form" id="auth-reset" onSubmit={submitReset} noValidate aria-label="Set a new password">
                <div className="auth-field">
                  <label htmlFor="auth-code">Reset code</label>
                  <input
                    id="auth-code"
                    className={`auth-input auth-code${resetErrors.code ? " invalid" : ""}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    value={code}
                    onChange={(e) => { setCode(cleanCode(e.target.value)); if (resetErrors.code) setResetErrors((r) => ({ ...r, code: undefined })); }}
                    aria-invalid={Boolean(resetErrors.code)}
                    aria-describedby={resetErrors.code ? "auth-reset-code-error" : undefined}
                    autoFocus
                  />
                  {resetErrors.code && <p id="auth-reset-code-error" className="auth-inline-error">{resetErrors.code}</p>}
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-new-password">New password</label>
                  <div className="auth-password">
                    <input
                      id="auth-new-password"
                      className={`auth-input${resetErrors.password ? " invalid" : ""}`}
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); if (resetErrors.password) setResetErrors((r) => ({ ...r, password: undefined })); }}
                      aria-invalid={Boolean(resetErrors.password)}
                      aria-describedby={resetErrors.password ? "auth-new-password-error" : undefined}
                    />
                    <button type="button" className="auth-eye" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "Hide password" : "Show password"} aria-pressed={showNew}>
                      {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {resetErrors.password && <p id="auth-new-password-error" className="auth-inline-error">{resetErrors.password}</p>}
                </div>

                <div className="auth-status" aria-live="polite">
                  {formError && <div className="auth-error" role="alert">{formError}</div>}
                  {success && !formError && <div className="auth-success" role="status">{success}</div>}
                </div>

                <div className="auth-actions">
                  <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
                    {busy ? <><span className="auth-spinner" aria-hidden="true" />Updating…</> : "Update password"}
                  </button>
                  <button className="auth-switch" type="button" onClick={resend} disabled={busy || cooldown > 0}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
                <button type="button" className="auth-link" onClick={backToForm} disabled={busy}>Back to sign in</button>
              </form>
            </>
          ) : (
            <>
          <SwingHeading tag="h1">{copy.title}</SwingHeading>
          <p className="auth-sub">{copy.sub}</p>

          <form key={mode} className="auth-form" id="auth-panel" onSubmit={submit} noValidate aria-label={copy.submit}>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Name</label>
                <input id="auth-name" className="auth-input" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className={`auth-input${fieldErrors.email ? " invalid" : ""}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })); }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
              />
              {fieldErrors.email && <p id="auth-email-error" className="auth-inline-error">{fieldErrors.email}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <input
                  id="auth-password"
                  className={`auth-input${fieldErrors.password ? " invalid" : ""}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {fieldErrors.password && <p id="auth-password-error" className="auth-inline-error">{fieldErrors.password}</p>}
              {mode === "signin" && (
                <button type="button" className="auth-forgot" onClick={startForgot}>Forgot password?</button>
              )}
            </div>

            <div className="auth-status" aria-live="polite">
              {formError && <div className="auth-error" role="alert">{formError}</div>}
              {success && !formError && <div className="auth-success" role="status">{success}</div>}
            </div>

            <div className="auth-actions">
              <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? <><span className="auth-spinner" aria-hidden="true" />{copy.busy}</> : copy.submit}
              </button>
              <button className="auth-switch" type="button" onClick={() => switchMode(other)} disabled={busy}>
                {COPY[other].submit}
              </button>
            </div>
          </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === undefined) return err.message; // backend unreachable
    if (err.status === 422) return "Please check your email address and password and try again.";
    if (err.status === 409) return "An account with this email already exists. Try signing in instead.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
