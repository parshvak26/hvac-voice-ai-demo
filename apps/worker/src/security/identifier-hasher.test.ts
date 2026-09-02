import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../types/env";
import {
  createIdentifierHasher,
  HashConfigurationError,
  IdentifierHasher,
} from "./identifier-hasher";

const persistentEnv = {
  PERSISTENCE_MODE: "supabase",
} as WorkerEnv;

describe("IdentifierHasher", () => {
  it("creates deterministic private hashes without exposing the input", async () => {
    const hasher = new IdentifierHasher("server-only-test-salt");
    const first = await hasher.hash("+15125551234");
    const second = await hasher.hash("+15125551234");
    const different = await hasher.hash("+15125550000");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("5125551234");
    expect(different).not.toBe(first);
  });

  it("fails closed when persistent storage has no secret salt", () => {
    expect(() =>
      createIdentifierHasher(persistentEnv, "worker.example.test"),
    ).toThrow(HashConfigurationError);
  });
});
