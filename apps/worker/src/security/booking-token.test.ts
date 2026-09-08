import { describe, expect, it } from "vitest";
import { BookingTokenService } from "./booking-token";

const publicToken = "00000000-0000-4000-8000-000000000123";

describe("BookingTokenService", () => {
  it("issues and validates a token tied to one completed call", async () => {
    const now = 1_800_000_000_000;
    const service = new BookingTokenService("test-secret-with-enough-entropy", () => now);
    const issued = await service.issue(publicToken, now - 5_000);

    expect(issued).not.toBeNull();
    await expect(service.validate(issued!.token)).resolves.toEqual({
      ok: true,
      publicToken,
      expiresAt: issued!.expiresAt,
    });
  });

  it("rejects a tampered call id or signature", async () => {
    const now = 1_800_000_000_000;
    const service = new BookingTokenService("test-secret-with-enough-entropy", () => now);
    const issued = await service.issue(publicToken, now);
    const tampered = issued!.token.replace("000123", "000124");

    await expect(service.validate(tampered)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an authentic token after its one-hour lifetime", async () => {
    let now = 1_800_000_000_000;
    const service = new BookingTokenService("test-secret-with-enough-entropy", () => now);
    const issued = await service.issue(publicToken, now);
    now += 60 * 60 * 1_000 + 1_000;

    await expect(service.validate(issued!.token)).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
