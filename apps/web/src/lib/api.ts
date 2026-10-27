import type { FloorPlan } from "@houseplan/design-schema";

// Local development talks to the API on :8000. On any other host (the deployed site) the browser calls this site's own
// /api, which Next forwards to the API (API_PROXY_TARGET in next.config.mjs), keeping the login cookie first-party.
// NEXT_PUBLIC_API_BASE_URL still overrides both when it is set.
function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured !== undefined) return configured;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" ? "http://localhost:8000" : "";
  }
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";
}
const API_BASE = `${apiOrigin()}/api`;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** Fired when any request comes back 401, so the app can return to the login screen. */
export const UNAUTHORIZED_EVENT = "nexora:unauthorized";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      // The session lives in an httpOnly cookie set by the API.
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the NEXORA API. Is the backend running?");
  }
  if (res.status === 401 && !path.startsWith("/auth/login") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? res.statusText);
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type ProjectSummary = {
  id: string;
  name: string;
  units: "ft" | "m";
  status: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  roomCount: number;
  plotWidth: number;
  plotLength: number;
};

export type ProjectDetail = {
  id: string;
  name: string;
  units: "ft" | "m";
  status: string;
  currentVersion: number;
  design: FloorPlan;
};

export function listProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>("/projects");
}

export function getProject(id: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${id}`);
}

export function createProject(payload: { name: string; units: "ft" | "m"; plotWidth: number; plotLength: number }): Promise<ProjectSummary> {
  return request<ProjectSummary>("/projects", { method: "POST", body: JSON.stringify(payload) });
}

export function saveDesign(id: string, design: FloorPlan): Promise<{ projectId: string; version: number; status: string }> {
  return request(`/projects/${id}/design`, { method: "PUT", body: JSON.stringify(design) });
}

export function renameProject(id: string, name: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function duplicateProject(id: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${id}/duplicate`, { method: "POST" });
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export type LayoutCandidate = {
  id: string;
  template: string;
  label: string;
  summary: string;
  score: number;
  scores: Record<string, number>;
  highlights: string[];
  warnings: string[];
  stats: { roomCount: number; builtUpArea: number; plotArea: number; floors?: number };
  design: FloorPlan;
  /** Present only when Claude is enabled on the API and the explanation call succeeded. */
  explanation?: { headline: string; pros: string[]; cons: string[] } | null;
};

export type AiStatus = { enabled: boolean; provider: string; model: string | null };

export type LayoutResult = {
  requirements: { counts: Record<string, number>; notes: string[]; floors?: number };
  /** Room counts per floor, ground first; one entry for single-floor homes. */
  floors?: { name: string; counts: Record<string, number> }[];
  candidates: LayoutCandidate[];
  rejectedCount: number;
  message: string | null;
  ai?: AiStatus & { used: boolean; error: string | null };
  disclaimer: string;
};

export function getAiStatus(): Promise<AiStatus> {
  return request<AiStatus>("/layouts/ai-status");
}

export function generateLayouts(payload: {
  roomList: string;
  description: string;
  plotWidth: number;
  plotLength: number;
  units: "ft" | "m";
  seed?: number;
  /** 0 = read from the brief ("G+1", "duplex"…). */
  floors?: number;
}): Promise<LayoutResult> {
  return request<LayoutResult>("/layouts/generate", { method: "POST", body: JSON.stringify(payload) });
}

/** Sends feedback / contact / support text to the team. The destination inbox is configured on the server only. */
export function sendSupportMessage(msg: { kind: "feedback" | "contact" | "support"; subject?: string; message: string; email?: string; details?: string }): Promise<{ status: string }> {
  return request("/support/messages", { method: "POST", body: JSON.stringify(msg) });
}

export type AuthUser = { id: string; email: string; displayName: string | null; createdAt?: string | null };

export function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

/** Step 1 of every sign-in: checks the password and emails a code. No session exists until loginVerify(). */
export function login(email: string, password: string): Promise<{ otpRequired: true; email: string }> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

/** Step 2: the emailed code completes the sign-in and starts the session. */
export function loginVerify(email: string, code: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/login/verify", { method: "POST", body: JSON.stringify({ email, code }) });
}

export function loginResend(email: string): Promise<{ status: string }> {
  return request("/auth/login/resend", { method: "POST", body: JSON.stringify({ email }) });
}

/** Registering sends a one-time code by email; the account is only signed in after verifyEmail(). */
export function register(email: string, password: string, displayName?: string): Promise<{ verificationRequired: true; email: string }> {
  return request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
}

/** Confirms the email only; the person still has to sign in afterwards. */
export function verifyEmail(email: string, code: string): Promise<{ verified: true; email: string }> {
  return request("/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
}

export function resendCode(email: string): Promise<{ status: string }> {
  return request("/auth/resend", { method: "POST", body: JSON.stringify({ email }) });
}

/** Login answers 403 with this message when the account's email has not been verified yet. */
export const EMAIL_NOT_VERIFIED = "email_not_verified";

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

/** Emails a password-reset code. Always answers the same, whether or not the address has an account. */
export function forgotPassword(email: string): Promise<{ status: string }> {
  return request("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetPassword(email: string, code: string, password: string): Promise<{ status: string }> {
  return request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code, password }) });
}

export function updateProfile(displayName: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/me", { method: "PATCH", body: JSON.stringify({ displayName }) });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ status: string }> {
  return request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
}

export function logoutEverywhere(): Promise<void> {
  return request<void>("/auth/logout-all", { method: "POST" });
}

/** Permanently deletes the account and all of its projects. */
export function deleteAccount(password: string): Promise<void> {
  return request<void>("/auth/delete-account", { method: "POST", body: JSON.stringify({ password }) });
}

// ── House design library ─────────────────────────────────────────────────────

export type LibraryPreviewRoom = [type: string, x0: number, y0: number, x1: number, y1: number, name: string];

export type LibraryEntry = {
  id: string;
  name: string;
  template: string;
  templateLabel: string;
  summary: string;
  plot: { width: number; length: number; units: "ft" | "m" };
  plotArea: number;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  builtUp: number;
  hasTerrace: boolean;
  tags: string[];
  score: number;
  highlights: string[];
  preview: { id: string; rooms: LibraryPreviewRoom[] }[];
  recipe: { width: number; length: number; units: "ft" | "m"; counts: Record<string, number>; floors: number; seed: number; candidateId: string };
};

export type LibraryPage = {
  ready: boolean;
  progress?: number;
  target?: number;
  error?: string | null;
  total: number;
  items: LibraryEntry[];
  favourites: string[];
};

export type LibraryFacets = {
  ready: boolean;
  total?: number;
  floors?: Record<string, number>;
  bedrooms?: Record<string, number>;
  tags?: Record<string, number>;
  plotAreaRange?: [number, number];
};

export type LibraryQuery = {
  q?: string;
  tags?: string[];
  floors?: number[];
  bedrooms?: number[];
  minArea?: number;
  maxArea?: number;
  favourites?: boolean;
  sort?: "score" | "area_asc" | "area_desc" | "bedrooms";
  limit?: number;
  offset?: number;
};

export function listLibrary(query: LibraryQuery): Promise<LibraryPage> {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.tags?.length) p.set("tags", query.tags.join(","));
  if (query.floors?.length) p.set("floors", query.floors.join(","));
  if (query.bedrooms?.length) p.set("bedrooms", query.bedrooms.join(","));
  if (query.minArea) p.set("minArea", String(query.minArea));
  if (query.maxArea) p.set("maxArea", String(query.maxArea));
  if (query.favourites) p.set("favourites", "true");
  if (query.sort) p.set("sort", query.sort);
  p.set("limit", String(query.limit ?? 24));
  p.set("offset", String(query.offset ?? 0));
  return request<LibraryPage>(`/library?${p.toString()}`);
}

export function getLibraryFacets(): Promise<LibraryFacets> {
  return request<LibraryFacets>("/library/facets");
}

export type LibraryDetail = {
  entry: LibraryEntry;
  design: FloorPlan;
  highlights: string[];
  warnings: string[];
  checks: { spatial: { code: string; message: string }[]; circulation: { code: string; message: string }[] };
  favourite: boolean;
  origin: string;
};

export function getLibraryDesign(id: string): Promise<LibraryDetail> {
  return request<LibraryDetail>(`/library/${encodeURIComponent(id)}`);
}

export function setLibraryFavourite(id: string, on: boolean): Promise<void> {
  return request<void>(`/library/favourites/${encodeURIComponent(id)}`, { method: on ? "PUT" : "DELETE" });
}

/** Creates a project from a plan and saves the plan as its first design. */
export async function createProjectFromPlan(name: string, plan: FloorPlan): Promise<string> {
  const project = await createProject({ name, units: plan.units, plotWidth: plan.plot.width, plotLength: plan.plot.length });
  await saveDesign(project.id, { ...plan, projectId: project.id });
  return project.id;
}
