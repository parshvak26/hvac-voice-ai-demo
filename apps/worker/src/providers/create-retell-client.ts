import { isLocalHostname } from "./create-turnstile-verifier";
import { MockRetellClient } from "./mock-retell-client";
import { RealRetellClient } from "./real-retell-client";
import type { RetellClient } from "./retell-client";
import { RetellConfigurationError } from "./retell-errors";
import type { WorkerEnv } from "../types/env";

export function createConfiguredRetellClient(
  env: WorkerEnv,
  requestHostname: string,
): RetellClient {
  if (env.RETELL_MODE === "mock") {
    if (!isLocalHostname(requestHostname)) {
      throw new RetellConfigurationError();
    }
    return new MockRetellClient();
  }

  if (
    env.RETELL_MODE !== "retell" ||
    !env.RETELL_API_KEY ||
    !env.RETELL_AGENT_ID ||
    !env.RETELL_FROM_NUMBER
  ) {
    throw new RetellConfigurationError();
  }

  return new RealRetellClient({
    apiKey: env.RETELL_API_KEY,
    agentId: env.RETELL_AGENT_ID,
    fromNumberE164: env.RETELL_FROM_NUMBER,
    companyName: env.DEMO_COMPANY_NAME,
    serviceArea: "Austin, Texas",
  });
}
