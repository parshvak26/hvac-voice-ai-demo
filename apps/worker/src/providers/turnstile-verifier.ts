export interface TurnstileVerificationInput {
  token: string;
  remoteIp: string;
}

export interface TurnstileVerifier {
  verify(input: TurnstileVerificationInput): Promise<boolean>;
}

export class TurnstileConfigurationError extends Error {
  constructor() {
    super("Turnstile is not configured correctly.");
    this.name = "TurnstileConfigurationError";
  }
}

export class TurnstileUnavailableError extends Error {
  constructor() {
    super("Turnstile verification is temporarily unavailable.");
    this.name = "TurnstileUnavailableError";
  }
}
