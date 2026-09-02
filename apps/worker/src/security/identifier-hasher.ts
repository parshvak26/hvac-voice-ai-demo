import { isLocalHostname } from "../providers/create-turnstile-verifier";
import type { WorkerEnv } from "../types/env";

export class HashConfigurationError extends Error {
  constructor() {
    super("Private identifier hashing is not configured correctly.");
    this.name = "HashConfigurationError";
  }
}

const localEphemeralSalt = crypto.randomUUID();

export class IdentifierHasher {
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(private readonly salt: string) {}

  async hash(value: string): Promise<string> {
    this.keyPromise ??= crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.salt),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.keyPromise,
      new TextEncoder().encode(value),
    );
    return [...new Uint8Array(signature)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}

export function createIdentifierHasher(
  env: WorkerEnv,
  requestHostname: string,
): IdentifierHasher {
  if (env.HASH_SALT) return new IdentifierHasher(env.HASH_SALT);
  if (env.PERSISTENCE_MODE === "memory" && isLocalHostname(requestHostname)) {
    return new IdentifierHasher(localEphemeralSalt);
  }
  throw new HashConfigurationError();
}
