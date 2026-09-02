import type {
  TurnstileVerificationInput,
  TurnstileVerifier,
} from "./turnstile-verifier";
import { TurnstileUnavailableError } from "./turnstile-verifier";

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly expectedHostname: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async verify(input: TurnstileVerificationInput): Promise<boolean> {
    const form = new FormData();
    form.set("secret", this.secretKey);
    form.set("response", input.token);
    form.set("remoteip", input.remoteIp);
    form.set("idempotency_key", crypto.randomUUID());

    let response: Response;
    try {
      response = await this.request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: form },
      );
    } catch {
      throw new TurnstileUnavailableError();
    }
    if (!response.ok) throw new TurnstileUnavailableError();

    let result: SiteverifyResponse;
    try {
      result = (await response.json()) as SiteverifyResponse;
    } catch {
      throw new TurnstileUnavailableError();
    }

    return (
      result.success === true &&
      result.hostname === this.expectedHostname &&
      result.action === "demo_call"
    );
  }
}
