import type { FloorPlan } from "@houseplan/design-schema";

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api`;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the NEXORA API. Is the backend running?");
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
