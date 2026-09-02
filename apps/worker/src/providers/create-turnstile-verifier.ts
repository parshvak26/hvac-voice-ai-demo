import type { WorkerEnv } from "../types/env";
import { CloudflareTurnstileVerifier } from "./cloudflare-turnstile-verifier";
import { LocalTurnstileVerifier } from "./local-turnstile-verifier";
import type { TurnstileVerifier } from "./turnstile-verifier";
import { TurnstileConfigurationError } from "./turnstile-verifier";

export function isLocalHostname(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function createTurnstileVerifier(
  env: WorkerEnv,
  requestHostname: string,
): TurnstileVerifier {
  if (env.TURNSTILE_MODE === "local_mock") {
    if (!isLocalHostname(requestHostname)) {
      throw new TurnstileConfigurationError();
    }
    return new LocalTurnstileVerifier();
  }

  if (
    env.TURNSTILE_MODE !== "cloudflare" ||
    !env.TURNSTILE_SECRET_KEY ||
    !env.TURNSTILE_EXPECTED_HOSTNAME
  ) {
    throw new TurnstileConfigurationError();
  }
  return new CloudflareTurnstileVerifier(
    env.TURNSTILE_SECRET_KEY,
    env.TURNSTILE_EXPECTED_HOSTNAME,
  );
}
