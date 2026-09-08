const tokenVersion = "v1";
const tokenLifetimeMilliseconds = 60 * 60 * 1_000;
const tokenPurpose = "hvac-demo-booking-details";
const publicTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BookingTokenValidation =
  | { ok: true; publicToken: string; expiresAt: string }
  | { ok: false; reason: "invalid" | "expired" };

function encodeBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}=`;
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export class BookingTokenService {
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  private getKey(): Promise<CryptoKey> {
    this.keyPromise ??= crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    return this.keyPromise;
  }

  private signingInput(publicToken: string, expiresAtSeconds: number): string {
    return `${tokenPurpose}:${tokenVersion}:${publicToken}:${expiresAtSeconds}`;
  }

  async issue(
    publicToken: string,
    completedAtMilliseconds: number,
  ): Promise<{ token: string; expiresAt: string } | null> {
    if (!publicTokenPattern.test(publicToken)) return null;
    const expiresAtMilliseconds = completedAtMilliseconds + tokenLifetimeMilliseconds;
    if (!Number.isFinite(expiresAtMilliseconds) || expiresAtMilliseconds <= this.now()) {
      return null;
    }
    const expiresAtSeconds = Math.floor(expiresAtMilliseconds / 1_000);
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.getKey(),
      new TextEncoder().encode(this.signingInput(publicToken, expiresAtSeconds)),
    );
    return {
      token: `${tokenVersion}.${publicToken}.${expiresAtSeconds}.${encodeBase64Url(signature)}`,
      expiresAt: new Date(expiresAtSeconds * 1_000).toISOString(),
    };
  }

  async validate(token: string): Promise<BookingTokenValidation> {
    if (token.length > 512) return { ok: false, reason: "invalid" };
    const [version, publicToken, expiresAtText, signatureText, extra] = token.split(".");
    if (
      version !== tokenVersion ||
      !publicTokenPattern.test(publicToken ?? "") ||
      !/^\d{10}$/.test(expiresAtText ?? "") ||
      !signatureText ||
      extra !== undefined
    ) {
      return { ok: false, reason: "invalid" };
    }
    const signature = decodeBase64Url(signatureText);
    if (!signature) return { ok: false, reason: "invalid" };
    const expiresAtSeconds = Number(expiresAtText);
    const authentic = await crypto.subtle.verify(
      "HMAC",
      await this.getKey(),
      signature,
      new TextEncoder().encode(this.signingInput(publicToken, expiresAtSeconds)),
    );
    if (!authentic) return { ok: false, reason: "invalid" };
    if (expiresAtSeconds * 1_000 <= this.now()) {
      return { ok: false, reason: "expired" };
    }
    return {
      ok: true,
      publicToken,
      expiresAt: new Date(expiresAtSeconds * 1_000).toISOString(),
    };
  }
}
