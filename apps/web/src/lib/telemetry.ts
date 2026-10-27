import { sendSupportMessage } from './api';

export interface UserFeedback {
  id: string;
  timestamp: number;
  category: 'bug' | 'feature' | 'drawing_export' | 'structural' | 'general';
  rating: number;
  title: string;
  message: string;
  email?: string;
  status: 'new' | 'reviewed' | 'resolved';
  diagnostics?: {
    userAgent: string;
    screenResolution: string;
    viewportSize: string;
    projectId?: string;
    roomCount?: number;
    levelCount?: number;
    units?: string;
    appVersion: string;
  };
}

export interface TelemetryEvent {
  id: string;
  name: string;
  timestamp: number;
  properties?: Record<string, string | number | boolean>;
}

const FEEDBACK_STORAGE_KEY = 'nexora_user_feedback_v1';
const TELEMETRY_STORAGE_KEY = 'nexora_telemetry_events_v1';
export const NEXORA_VERSION = 'v1.0.0-beta.1';

// In-memory fallback stores for SSR / test environments (no localStorage)
let _memFeedback: UserFeedback[] = [];
let _memEvents: TelemetryEvent[] = [];

function genId(prefix = 'fb'): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8);
  return prefix + '-' + rand;
}

export function captureDiagnostics(planStats?: { projectId?: string; roomCount?: number; levelCount?: number; units?: string }) {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'node',
      screenResolution: 'n/a',
      viewportSize: 'n/a',
      projectId: planStats?.projectId,
      roomCount: planStats?.roomCount,
      levelCount: planStats?.levelCount,
      units: planStats?.units,
      appVersion: NEXORA_VERSION,
    };
  }
  return {
    userAgent: navigator.userAgent.slice(0, 120),
    screenResolution: window.screen.width + ' x ' + window.screen.height,
    viewportSize: window.innerWidth + ' x ' + window.innerHeight,
    projectId: planStats?.projectId,
    roomCount: planStats?.roomCount,
    levelCount: planStats?.levelCount,
    units: planStats?.units,
    appVersion: NEXORA_VERSION,
  };
}

export async function submitUserFeedback(
  feedback: Omit<UserFeedback, 'id' | 'timestamp' | 'status'>
): Promise<UserFeedback> {
  const item: UserFeedback = {
    ...feedback,
    id: genId('fb'),
    timestamp: Date.now(),
    status: 'new',
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredFeedback();
      const updated = [item, ...existing];
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  } else {
    _memFeedback = [item, ..._memFeedback];
  }

  trackTelemetryEvent('feedback_submitted', { category: item.category, rating: item.rating });
  // Also reaches the team privately through the server; the inbox address is never known to the browser.
  await sendSupportMessage({
    kind: 'feedback',
    subject: item.title,
    message: `[${item.category}, rating ${item.rating}/5] ${item.message}`,
    email: item.email,
    details: item.diagnostics ? JSON.stringify(item.diagnostics, null, 2) : undefined,
  });
  return item;
}

export function getStoredFeedback(): UserFeedback[] {
  if (typeof window === 'undefined') return _memFeedback;
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function updateFeedbackStatus(id: string, status: 'new' | 'reviewed' | 'resolved'): void {
  if (typeof window === 'undefined') {
    _memFeedback = _memFeedback.map((f) => (f.id === id ? { ...f, status } : f));
    return;
  }
  const list = getStoredFeedback();
  const updated = list.map((f) => (f.id === id ? { ...f, status } : f));
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
}

export function clearAllFeedback(): void {
  _memFeedback = [];
  _memEvents = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
      localStorage.removeItem(TELEMETRY_STORAGE_KEY);
    } catch { /* ignore */ }
  }
}

export function trackTelemetryEvent(name: string, properties?: Record<string, string | number | boolean>): void {
  const event: TelemetryEvent = { id: genId('evt'), name, timestamp: Date.now(), properties };
  if (typeof window === 'undefined') {
    _memEvents = [event, ..._memEvents.slice(0, 149)];
    return;
  }
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    const events: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify([event, ...events.slice(0, 149)]));
  } catch { /* ignore */ }
}

export function getTelemetryEvents(): TelemetryEvent[] {
  if (typeof window === 'undefined') return _memEvents;
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
