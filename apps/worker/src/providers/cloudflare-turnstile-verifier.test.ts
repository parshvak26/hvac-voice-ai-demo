import { describe, expect, it } from "vitest";
import { CloudflareTurnstileVerifier } from "./cloudflare-turnstile-verifier";
import { TurnstileUnavailableError } from "./turnstile-verifier";

describe("CloudflareTurnstileVerifier", () => {
  it("checks the token on Cloudflare and validates hostname and action", async () => {
    const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      );
      const form = init?.body as FormData;
      expect(form.get("secret")).toBe("private-secret");
      expect(form.get("response")).toBe("browser-token");
      expect(form.get("remoteip")).toBe("203.0.113.10");
      return Response.json({
        success: true,
        hostname: "demo.example.test",
        action: "demo_call",
      });
    }) as typeof fetch;
    const verifier = new CloudflareTurnstileVerifier(
      "private-secret",
      "demo.example.test",
      request,
    );

    await expect(
      verifier.verify({
        token: "browser-token",
        remoteIp: "203.0.113.10",
      }),
    ).resolves.toBe(true);
  });

  it("rejects a valid token issued for the wrong hostname", async () => {
    const request = (async () =>
      Response.json({
        success: true,
        hostname: "wrong.example.test",
        action: "demo_call",
      })) as typeof fetch;
    const verifier = new CloudflareTurnstileVerifier(
      "private-secret",
      "demo.example.test",
      request,
    );

    await expect(
      verifier.verify({ token: "browser-token", remoteIp: "203.0.113.10" }),
    ).resolves.toBe(false);
  });

  it("returns a safe unavailable error when Cloudflare cannot be reached", async () => {
    const request = (async () => {
      throw new Error("private network detail");
    }) as typeof fetch;
    const verifier = new CloudflareTurnstileVerifier(
      "private-secret",
      "demo.example.test",
      request,
    );

    await expect(
      verifier.verify({ token: "browser-token", remoteIp: "203.0.113.10" }),
    ).rejects.toBeInstanceOf(TurnstileUnavailableError);
  });
});
