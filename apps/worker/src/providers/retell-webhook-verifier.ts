const signaturePattern = /^v=(\d{10,16}),d=([0-9a-fA-F]{64})$/;
const maximumSignatureAgeMilliseconds = 5 * 60_000;

export interface RetellWebhookVerifier {
  verify(rawBody: string, signatureHeader: string | null): Promise<boolean>;
}

export class RetellWebhookConfigurationError extends Error {
  constructor() {
    super("Retell webhook verification is not configured.");
    this.name = "RetellWebhookConfigurationError";
  }
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export class HmacRetellWebhookVerifier implements RetellWebhookVerifier {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(
    apiKey: string,
    private readonly now: () => number = Date.now,
  ) {
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey) throw new RetellWebhookConfigurationError();
    this.keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(normalizedApiKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }

  async verify(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<boolean> {
    const match = signatureHeader?.match(signaturePattern);
    if (!match) return false;

    const timestamp = Number(match[1]);
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(this.now() - timestamp) > maximumSignatureAgeMilliseconds
    ) {
      return false;
    }

    const signature = decodeHex(match[2]);
    if (!signature) return false;
    const key = await this.keyPromise;
    return crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(`${rawBody}${match[1]}`),
    );
  }
}

export function createRetellWebhookVerifier(
  apiKey: string | undefined,
  now: () => number = Date.now,
): RetellWebhookVerifier {
  if (!apiKey) throw new RetellWebhookConfigurationError();
  return new HmacRetellWebhookVerifier(apiKey, now);
}
