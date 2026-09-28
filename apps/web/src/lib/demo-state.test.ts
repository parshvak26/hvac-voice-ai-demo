import { describe, expect, it } from "vitest";
import {
  canTransition,
  demoReducer,
  initialDemoState,
  type DemoState,
} from "./demo-state";

describe("demo call state", () => {
  it("allows the complete happy-path sequence", () => {
    const sequence = [
      "verification_pending",
      "submitting",
      "call_requested",
      "calling",
      "connected",
      "call_ended",
      "analysis_pending",
      "analysis_ready",
    ] as const;

    expect(
      sequence.every((status, index) =>
        canTransition(index === 0 ? "idle" : sequence[index - 1], status),
      ),
    ).toBe(true);
  });

  it("blocks an impossible jump from idle to connected", () => {
    const next = demoReducer(initialDemoState, {
      type: "set_status",
      status: "connected",
    });

    expect(next).toBe(initialDemoState);
  });

  it("resets an error state cleanly", () => {
    const failed: DemoState = {
      status: "failed",
      result: null,
      errorMessage: "Demo failure",
    };

    expect(demoReducer(failed, { type: "reset" })).toEqual(initialDemoState);
  });

  it("adds a form offer that arrives after the call analysis", () => {
    const analysis = {
      issueCategory: "cooling",
      urgency: "medium" as const,
      leadQualified: true,
      appointmentInterest: true,
      humanRequested: false,
      serviceLocation: "Austin",
      preferredTiming: "Friday at 7 PM",
      summary: "The caller requested service.",
    };
    const result = {
      analysis,
      transcript: [{ speaker: "Demo caller" as const, text: "The AC is not cooling." }],
    };
    const ready: DemoState = { status: "analysis_ready", result, errorMessage: null };
    const offer = {
      token: "signed-token",
      expiresAt: "2026-10-02T12:00:00.000Z",
      timezone: "America/Chicago" as const,
      calendarBookingEnabled: true,
      suggestedDate: "2026-10-02",
      suggestedTime: "19:00",
    };

    expect(demoReducer(ready, {
      type: "complete",
      result: { ...result, bookingForm: offer },
    }).result?.bookingForm).toEqual(offer);
  });
});
