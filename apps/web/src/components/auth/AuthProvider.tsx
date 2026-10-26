"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  verifyEmail as apiVerifyEmail,
  logoutEverywhere as apiLogoutEverywhere,
  deleteAccount as apiDeleteAccount,
  updateProfile as apiUpdateProfile,
  type AuthUser,
} from "@/lib/api";
import { loginUrl } from "@/lib/auth-redirect";

type AuthState = {
  user: AuthUser | null;
  status: "loading" | "signedIn" | "signedOut";
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account and emails a code. Neither signUp() nor verify() signs the user in. */
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Ends this session on every device. */
  signOutEverywhere: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  /** Permanently deletes the account (and its projects), then returns to the sign-in page. */
  removeAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  // After a deliberate sign-out the next sign-in should start at the default page, not return to where they were.
  const leftOnPurpose = useRef(false);

  // Restore the session from the httpOnly cookie on every full page load.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus("signedIn");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("signedOut");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any API call that comes back 401 (expired or revoked session) drops us back to the login screen.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus("signedOut");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (status === "signedOut" && !isPublic) {
      const search = typeof window === "undefined" ? "" : window.location.search;
      router.replace(leftOnPurpose.current ? "/login" : loginUrl(pathname + search));
      leftOnPurpose.current = false;
    }
  }, [status, isPublic, pathname, router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setStatus("signedIn");
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    await apiRegister(email, password, displayName);
  }, []);

  const verify = useCallback(async (email: string, code: string) => {
    // Verifying does not sign anyone in: the person goes back to the sign-in form.
    await apiVerifyEmail(email, code);
  }, []);

  const signOut = useCallback(async () => {
    leftOnPurpose.current = true;
    try {
      await apiLogout();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
    }
    setUser(null);
    setStatus("signedOut");
    router.replace("/login");
  }, [router]);

  const signOutEverywhere = useCallback(async () => {
    leftOnPurpose.current = true;
    await apiLogoutEverywhere();
    setUser(null);
    setStatus("signedOut");
    router.replace("/login");
  }, [router]);

  const updateName = useCallback(async (name: string) => {
    setUser(await apiUpdateProfile(name));
  }, []);

  const removeAccount = useCallback(async (password: string) => {
    await apiDeleteAccount(password);
    leftOnPurpose.current = true;
    setUser(null);
    setStatus("signedOut");
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, status, signIn, signUp, verify, signOut, signOutEverywhere, updateName, removeAccount }),
    [user, status, signIn, signUp, verify, signOut, signOutEverywhere, updateName, removeAccount],
  );

  // Don't flash protected pages (or fire their API calls) before we know who is signed in.
  const blocked = !isPublic && status !== "signedIn";

  return (
    <AuthContext.Provider value={value}>
      {blocked ? <div className="auth-splash" role="status" aria-live="polite">Loading…</div> : children}
    </AuthContext.Provider>
  );
}
