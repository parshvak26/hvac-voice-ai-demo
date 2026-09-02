import { describe, expect, it } from "vitest";
import { validateUsPhoneNumber } from "./phone";

describe("validateUsPhoneNumber", () => {
  it.each([
    ["5125551234", "+15125551234"],
    ["(512) 555-1234", "+15125551234"],
    ["512-555-1234", "+15125551234"],
    ["+1 512 555 1234", "+15125551234"],
  ])("normalizes %s to E.164", (input, expected) => {
    const result = validateUsPhoneNumber(input);

    expect(result.isValid).toBe(true);
    if (result.isValid) expect(result.e164).toBe(expected);
  });

  it.each(["", "555-1234", "+44 20 7946 0958", "+91 98765 43210"])(
    "rejects unsupported input %s",
    (input) => {
      expect(validateUsPhoneNumber(input).isValid).toBe(false);
    },
  );
});
