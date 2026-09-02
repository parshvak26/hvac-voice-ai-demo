import { describe, expect, it } from "vitest";
import { validateCreateDemoCallBody } from "./demo-call";

describe("validateCreateDemoCallBody", () => {
  it("normalizes a valid US number", () => {
    const result = validateCreateDemoCallBody({
      phoneNumber: "(512) 555-1234",
      consentToAiCall: true,
      consentToRecording: true,
      turnstileToken: "verified-token",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { phoneE164: "+15125551234" },
    });
  });

  it.each(["+44 20 7946 0958", "+91 98765 43210", "555-1234"])(
    "rejects unsupported number %s",
    (phoneNumber) => {
      expect(
        validateCreateDemoCallBody({
          phoneNumber,
          consentToAiCall: true,
          consentToRecording: true,
          turnstileToken: "verified-token",
        }),
      ).toMatchObject({ ok: false, code: "invalid_phone_number" });
    },
  );

  it("requires both consent choices", () => {
    expect(
      validateCreateDemoCallBody({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: false,
        turnstileToken: "verified-token",
      }),
    ).toMatchObject({ ok: false, code: "consent_required" });
  });

  it("rejects unexpected fields", () => {
    expect(
      validateCreateDemoCallBody({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
        turnstileToken: "verified-token",
        apiKey: "not-allowed",
      }),
    ).toMatchObject({ ok: false, code: "invalid_request" });
  });

  it("requires an anti-abuse token", () => {
    expect(
      validateCreateDemoCallBody({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
    ).toMatchObject({ ok: false, code: "invalid_request" });
  });
});
