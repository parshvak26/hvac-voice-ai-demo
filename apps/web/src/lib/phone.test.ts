import { describe, expect, it } from "vitest";
import { validateSupportedPhoneNumber } from "./phone";

describe("validateSupportedPhoneNumber", () => {
  it.each([
    ["5125551234", "+15125551234"],
    ["(512) 555-1234", "+15125551234"],
    ["512-555-1234", "+15125551234"],
    ["+1 512 555 1234", "+15125551234"],
    ["+91 98765 43210", "+919876543210"],
  ])("normalizes %s to E.164", (input, expected) => {
    const result = validateSupportedPhoneNumber(input);

    expect(result.isValid).toBe(true);
    if (result.isValid) expect(result.e164).toBe(expected);
  });

  it.each(["", "555-1234", "+44 20 7946 0958", "+91 1234"])(
    "rejects unsupported input %s",
    (input) => {
      expect(validateSupportedPhoneNumber(input).isValid).toBe(false);
    },
  );
});
