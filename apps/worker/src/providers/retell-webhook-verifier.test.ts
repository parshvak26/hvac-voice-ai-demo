import { describe, expect, it } from "vitest";
import { HmacRetellWebhookVerifier } from "./retell-webhook-verifier";

async function signatureFor(body: string, timestamp: number, key: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${body}${timestamp}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `v=${timestamp},d=${hex}`;
}

describe("HmacRetellWebhookVerifier", () => {
  it("accepts an authentic, fresh raw body", async () => {
    const now = 1_800_000_000_000;
    const body = '{"event":"call_started"}';
    const verifier = new HmacRetellWebhookVerifier("secret-key", () => now);

    expect(await verifier.verify(body, await signatureFor(body, now, "secret-key"))).toBe(true);
  });

  it("rejects changed bodies, stale timestamps, and malformed signatures", async () => {
    const now = 1_800_000_000_000;
    const body = '{"event":"call_started"}';
    const verifier = new HmacRetellWebhookVerifier("secret-key", () => now);
    const valid = await signatureFor(body, now, "secret-key");
    const stale = await signatureFor(body, now - 300_001, "secret-key");

    expect(await verifier.verify(`${body} `, valid)).toBe(false);
    expect(await verifier.verify(body, stale)).toBe(false);
    expect(await verifier.verify(body, "bad-value")).toBe(false);
    expect(await verifier.verify(body, null)).toBe(false);
  });
});
