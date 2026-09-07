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
  constructor(
    readonly reason: "network_error" | "http_error" | "invalid_response" =
      "network_error",
    readonly httpStatus: number | null = null,
    readonly errorCodes: readonly string[] = [],
    readonly detail: string | null = null,
  ) {
    super("Turnstile verification is temporarily unavailable.");
    this.name = "TurnstileUnavailableError";
  }
}
