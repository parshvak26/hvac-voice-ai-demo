import type {
  TurnstileVerificationInput,
  TurnstileVerifier,
} from "./turnstile-verifier";
import { TurnstileUnavailableError } from "./turnstile-verifier";

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: unknown;
}

function safeErrorCodes(result: SiteverifyResponse): string[] {
  const codes = result?.["error-codes"];
  if (!Array.isArray(codes)) return [];
  return codes
    .filter((code): code is string => typeof code === "string")
    .slice(0, 5)
    .map((code) => code.slice(0, 64));
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly expectedHostname: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async verify(input: TurnstileVerificationInput): Promise<boolean> {
    const form = new URLSearchParams({
      secret: this.secretKey,
      response: input.token,
      remoteip: input.remoteIp,
    });

    let response: Response;
    try {
      const request = this.request;
      response = await request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        },
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? `${error.name}:${error.message}`.slice(0, 128)
          : "unknown";
      throw new TurnstileUnavailableError(
        "network_error",
        null,
        [],
        detail,
      );
    }

    let result: SiteverifyResponse;
    try {
      result = (await response.json()) as SiteverifyResponse;
    } catch {
      throw new TurnstileUnavailableError(
        "invalid_response",
        response.status,
      );
    }
    if (!response.ok) {
      throw new TurnstileUnavailableError(
        "http_error",
        response.status,
        safeErrorCodes(result),
      );
    }

    return (
      result.success === true &&
      result.hostname === this.expectedHostname &&
      result.action === "demo_call"
    );
  }
}
