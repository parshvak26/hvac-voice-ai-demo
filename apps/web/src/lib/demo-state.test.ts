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
});
