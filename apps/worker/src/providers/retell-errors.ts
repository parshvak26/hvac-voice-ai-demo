export class RetellConfigurationError extends Error {
  constructor() {
    super("Retell calling is not configured correctly.");
    this.name = "RetellConfigurationError";
  }
}

export class RetellRejectedError extends Error {
  constructor() {
    super("Retell rejected the outbound call request.");
    this.name = "RetellRejectedError";
  }
}

import { OutboundCallOutcomeUnknownError } from "./retell-client";

export class RetellUnavailableError extends OutboundCallOutcomeUnknownError {
  constructor(readonly retryAfterSeconds?: number) {
    super("Retell calling is temporarily unavailable.");
    this.name = "RetellUnavailableError";
  }
}
