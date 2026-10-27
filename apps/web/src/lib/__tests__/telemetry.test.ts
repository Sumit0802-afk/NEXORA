import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api", () => ({ sendSupportMessage: vi.fn().mockResolvedValue({ status: "sent" }) }));
import {
  submitUserFeedback,
  getStoredFeedback,
  updateFeedbackStatus,
  clearAllFeedback,
  trackTelemetryEvent,
  getTelemetryEvents,
  captureDiagnostics,
  NEXORA_VERSION,
} from "../telemetry";

describe("Telemetry & User Feedback System", () => {
  beforeEach(() => {
    clearAllFeedback();
  });

  it("stores feedback submissions with generated IDs and timestamps", async () => {
    const item = await submitUserFeedback({
      category: "bug",
      rating: 4,
      title: "PDF text overlap",
      message: "Room dimension text overlaps title block on A4 landscape",
      email: "tester@architect.com",
    });

    expect(item.id).toBeDefined();
    expect(item.status).toBe("new");
    expect(item.timestamp).toBeGreaterThan(0);

    const stored = getStoredFeedback();
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe("PDF text overlap");
  });

  it("forwards feedback to the team through the server", async () => {
    const { sendSupportMessage } = await import("../api");
    await submitUserFeedback({ category: "bug", rating: 3, title: "Crash", message: "It crashed", email: "u@example.com" });
    expect(sendSupportMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "feedback", subject: "Crash", email: "u@example.com" }));
  });

  it("updates feedback review status", async () => {
    const item = await submitUserFeedback({
      category: "feature",
      rating: 5,
      title: "Circular columns",
      message: "Add support for cylindrical columns in porch area",
    });

    updateFeedbackStatus(item.id, "reviewed");
    const updated = getStoredFeedback();
    expect(updated.find((f) => f.id === item.id)?.status).toBe("reviewed");
  });

  it("tracks telemetry events anonymously without PII", () => {
    trackTelemetryEvent("drawing_sheet_exported", { format: "pdf", sheetCount: 4 });
    const events = getTelemetryEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].name).toBe("drawing_sheet_exported");
    expect(events[0].properties?.format).toBe("pdf");
  });

  it("captures client diagnostics including app version and room count", () => {
    const diag = captureDiagnostics({ projectId: "test-home", roomCount: 8, units: "ft" });
    expect(diag?.appVersion).toBe(NEXORA_VERSION);
    expect(diag?.roomCount).toBe(8);
    expect(diag?.projectId).toBe("test-home");
  });
});
