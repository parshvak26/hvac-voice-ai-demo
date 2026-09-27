import type { SubmitBookingDetailsRequest } from "@hvac-demo/shared";
import { isBookableDate, isBookableTime } from "../services/booking-schedule";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ValidationResult =
  | { ok: true; value: SubmitBookingDetailsRequest }
  | { ok: false; code: "invalid_request"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const hasControlCharacter = [...trimmed].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  return hasControlCharacter ? null : trimmed.replace(/\s+/g, " ");
}

export function validateBookingDetailsBody(
  body: unknown,
  now: number = Date.now(),
): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, code: "invalid_request", message: "Enter the requested details." };
  }
  const allowedFields = new Set([
    "token",
    "email",
    "addressLine1",
    "city",
    "region",
    "postalCode",
    "requestedDate",
    "requestedTime",
  ]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    return { ok: false, code: "invalid_request", message: "The form contains an unsupported field." };
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = cleanText(body.email)?.toLowerCase() ?? "";
  const addressLine1 = cleanText(body.addressLine1) ?? "";
  const city = cleanText(body.city) ?? "";
  const region = (cleanText(body.region) ?? "").toUpperCase();
  const postalCode = cleanText(body.postalCode) ?? "";
  const requestedDate = cleanText(body.requestedDate) ?? "";
  const requestedTime = cleanText(body.requestedTime) ?? "";

  if (!token || token.length > 512) {
    return { ok: false, code: "invalid_request", message: "This form link is invalid." };
  }
  if (email.length < 3 || email.length > 254 || !emailPattern.test(email)) {
    return { ok: false, code: "invalid_request", message: "Enter a valid email address." };
  }
  if (addressLine1.length < 5 || addressLine1.length > 200) {
    return { ok: false, code: "invalid_request", message: "Enter a valid service address." };
  }
  if (city.length < 2 || city.length > 100) {
    return { ok: false, code: "invalid_request", message: "Enter a valid city." };
  }
  if (!/^[A-Z]{2}$/.test(region)) {
    return { ok: false, code: "invalid_request", message: "Enter a two-letter state code." };
  }
  if (!/^\d{5}$/.test(postalCode)) {
    return { ok: false, code: "invalid_request", message: "Enter a five-digit ZIP code." };
  }
  if (!isBookableDate(requestedDate, now)) {
    return { ok: false, code: "invalid_request", message: "Choose a date within the next 30 days." };
  }
  if (!isBookableTime(requestedTime)) {
    return { ok: false, code: "invalid_request", message: "Choose an available appointment start time from 8:00 AM to 8:00 PM." };
  }

  return {
    ok: true,
    value: {
      token,
      email,
      addressLine1,
      city,
      region,
      postalCode,
      requestedDate,
      requestedTime,
    },
  };
}
