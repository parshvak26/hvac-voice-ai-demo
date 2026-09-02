import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../types/env";
import { createConfiguredRetellClient } from "./create-retell-client";
import { MockRetellClient } from "./mock-retell-client";
import { RealRetellClient } from "./real-retell-client";
import { RetellConfigurationError } from "./retell-errors";

const baseEnv = {
  RETELL_MODE: "mock",
  DEMO_COMPANY_NAME: "Austin Comfort HVAC",
} as WorkerEnv;

describe("createConfiguredRetellClient", () => {
  it("allows the mock provider only on a local hostname", () => {
    expect(
      createConfiguredRetellClient(baseEnv, "localhost"),
    ).toBeInstanceOf(MockRetellClient);
    expect(() =>
      createConfiguredRetellClient(baseEnv, "worker.example.test"),
    ).toThrow(RetellConfigurationError);
  });

  it("fails closed when real mode is missing private settings", () => {
    expect(() =>
      createConfiguredRetellClient(
        { ...baseEnv, RETELL_MODE: "retell" },
        "worker.example.test",
      ),
    ).toThrow(RetellConfigurationError);
  });

  it("creates the real adapter only with complete valid settings", () => {
    expect(
      createConfiguredRetellClient(
        {
          ...baseEnv,
          RETELL_MODE: "retell",
          RETELL_API_KEY: "private-test-key",
          RETELL_AGENT_ID: "agent_test_123",
          RETELL_FROM_NUMBER: "+15125550000",
        },
        "worker.example.test",
      ),
    ).toBeInstanceOf(RealRetellClient);
  });
});
