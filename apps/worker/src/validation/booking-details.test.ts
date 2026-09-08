import { describe, expect, it } from "vitest";
import { validateBookingDetailsBody } from "./booking-details";

const now = Date.parse("2026-09-08T18:00:00.000Z");
const validBody = {
  token: "signed-token",
  email: "Customer@Example.com",
  addressLine1: "100 Congress Avenue",
  city: "Austin",
  region: "tx",
  postalCode: "78701",
  requestedDate: "2026-09-09",
  requestedTime: "15:30",
};

describe("validateBookingDetailsBody", () => {
  it("normalizes valid contact and scheduling details", () => {
    expect(validateBookingDetailsBody(validBody, now)).toEqual({
      ok: true,
      value: {
        ...validBody,
        email: "customer@example.com",
        region: "TX",
      },
    });
  });

  it.each([
    ["email", "not-an-email"],
    ["postalCode", "7870"],
    ["requestedDate", "2026-10-20"],
    ["requestedTime", "15:15"],
  ])("rejects an invalid %s", (field, value) => {
    const result = validateBookingDetailsBody({ ...validBody, [field]: value }, now);
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields instead of silently accepting them", () => {
    const result = validateBookingDetailsBody({ ...validBody, role: "admin" }, now);
    expect(result.ok).toBe(false);
  });
});
