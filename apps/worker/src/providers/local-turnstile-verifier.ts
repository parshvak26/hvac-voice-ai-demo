import type {
  TurnstileVerificationInput,
  TurnstileVerifier,
} from "./turnstile-verifier";

export const localTurnstileToken = "local-mock-turnstile-token";

export class LocalTurnstileVerifier implements TurnstileVerifier {
  async verify(input: TurnstileVerificationInput): Promise<boolean> {
    return input.token === localTurnstileToken;
  }
}
