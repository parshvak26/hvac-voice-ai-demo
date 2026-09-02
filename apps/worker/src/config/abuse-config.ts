import type { AbuseLimits } from "../types/demo-request";
import type { WorkerEnv } from "../types/env";

export class AbuseConfigurationError extends Error {
  constructor() {
    super("Abuse protection is not configured correctly.");
    this.name = "AbuseConfigurationError";
  }
}

function parseBoundedInteger(
  value: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(value)) throw new AbuseConfigurationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AbuseConfigurationError();
  }
  return parsed;
}

export function getAbuseLimits(env: WorkerEnv): AbuseLimits {
  return {
    maxCallsPerDay: parseBoundedInteger(env.MAX_CALLS_PER_DAY, 1, 10_000),
    maxCallsPerIpPerDay: parseBoundedInteger(
      env.MAX_CALLS_PER_IP_PER_DAY,
      1,
      100,
    ),
    phoneCooldownMinutes: parseBoundedInteger(
      env.PHONE_COOLDOWN_MINUTES,
      1,
      1_440,
    ),
    maxCallDurationSeconds: parseBoundedInteger(
      env.MAX_CALL_DURATION_SECONDS,
      60,
      3_600,
    ),
  };
}
