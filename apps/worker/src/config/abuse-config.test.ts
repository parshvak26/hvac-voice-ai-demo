import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../types/env";
import { AbuseConfigurationError, getAbuseLimits } from "./abuse-config";

const env = {
  MAX_CALLS_PER_DAY: "25",
  MAX_CALLS_PER_IP_PER_DAY: "3",
  PHONE_COOLDOWN_MINUTES: "15",
  MAX_CALL_DURATION_SECONDS: "300",
} as WorkerEnv;

describe("getAbuseLimits", () => {
  it("parses the approved default guardrails", () => {
    expect(getAbuseLimits(env)).toEqual({
      maxCallsPerDay: 25,
      maxCallsPerIpPerDay: 3,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    });
  });

  it.each([
    ["MAX_CALLS_PER_DAY", "0"],
    ["MAX_CALLS_PER_IP_PER_DAY", "3.5"],
    ["PHONE_COOLDOWN_MINUTES", ""],
    ["MAX_CALL_DURATION_SECONDS", "99999"],
    ["MAX_CALL_DURATION_SECONDS", "30"],
  ] as const)("fails closed for invalid %s", (key, value) => {
    expect(() => getAbuseLimits({ ...env, [key]: value })).toThrow(
      AbuseConfigurationError,
    );
  });
});
